import { spawn } from "node:child_process";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import net from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptRoot, "..");
const temporaryRoot = await mkdtemp(path.join(tmpdir(), "kd-remote-browser-"));
const appRoot = path.join(temporaryRoot, "app");
const profileRoot = path.join(temporaryRoot, "chrome-profile");
const tokenFile = path.join(temporaryRoot, "access-token.txt");
const devToolsFile = path.join(profileRoot, "DevToolsActivePort");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function reservePort() {
  return await new Promise((resolve, reject) => {
    const reservation = net.createServer();
    reservation.once("error", reject);
    reservation.listen(0, "127.0.0.1", () => {
      const address = reservation.address();
      const port = typeof address === "object" && address ? address.port : 0;
      reservation.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

async function findBrowser() {
  const candidates = [
    process.env.KD_BROWSER_EXECUTABLE,
    process.env.ProgramFiles &&
      path.join(
        process.env.ProgramFiles,
        "Google",
        "Chrome",
        "Application",
        "chrome.exe",
      ),
    process.env["ProgramFiles(x86)"] &&
      path.join(
        process.env["ProgramFiles(x86)"],
        "Google",
        "Chrome",
        "Application",
        "chrome.exe",
      ),
    process.env.ProgramFiles &&
      path.join(
        process.env.ProgramFiles,
        "Microsoft",
        "Edge",
        "Application",
        "msedge.exe",
      ),
    process.env["ProgramFiles(x86)"] &&
      path.join(
        process.env["ProgramFiles(x86)"],
        "Microsoft",
        "Edge",
        "Application",
        "msedge.exe",
      ),
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next known browser location.
    }
  }
  throw new Error(
    "Chrome or Edge was not found; set KD_BROWSER_EXECUTABLE to a Chromium browser",
  );
}

async function waitForServer(url, child) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`Remote server exited early with code ${child.exitCode}`);
    }
    try {
      const response = await fetch(url);
      if (response.status === 401) {
        return;
      }
    } catch {
      // The listening socket is not ready yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("Timed out waiting for the remote server");
}

async function waitForDevTools(chrome) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (chrome.exitCode !== null) {
      throw new Error(`Browser exited early with code ${chrome.exitCode}`);
    }
    try {
      const [portLine] = (await readFile(devToolsFile, "utf8")).split(/\r?\n/);
      const port = Number(portLine);
      if (Number.isInteger(port) && port > 0) {
        const response = await fetch(`http://127.0.0.1:${port}/json/version`);
        if (response.ok) {
          return port;
        }
      }
    } catch {
      // Chrome creates DevToolsActivePort after its profile is ready.
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("Timed out waiting for the browser debugging endpoint");
}

async function openPage(devToolsPort, url) {
  const response = await fetch(
    `http://127.0.0.1:${devToolsPort}/json/new?${encodeURIComponent(url)}`,
    { method: "PUT" },
  );
  if (!response.ok) {
    throw new Error(`Could not create browser target: HTTP ${response.status}`);
  }
  return await response.json();
}

async function connectCdp(url) {
  return await new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    socket.addEventListener("open", () => resolve(socket), { once: true });
    socket.addEventListener(
      "error",
      () => reject(new Error("Could not connect to the browser target")),
      { once: true },
    );
  });
}

function createCdpClient(socket) {
  let requestId = 0;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (!message.id) {
      return;
    }
    const request = pending.get(message.id);
    if (!request) {
      return;
    }
    pending.delete(message.id);
    if (message.error) {
      request.reject(
        new Error(`${request.method}: ${message.error.message}`),
      );
    } else {
      request.resolve(message.result);
    }
  });
  socket.addEventListener("close", () => {
    for (const request of pending.values()) {
      request.reject(new Error(`Browser closed during ${request.method}`));
    }
    pending.clear();
  });

  return {
    send(method, params = {}) {
      requestId += 1;
      return new Promise((resolve, reject) => {
        pending.set(requestId, { method, resolve, reject });
        socket.send(JSON.stringify({ id: requestId, method, params }));
      });
    },
  };
}

async function evaluate(client, expression, awaitPromise = false) {
  const result = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(
      result.exceptionDetails.exception?.description ??
        result.exceptionDetails.text ??
        "Browser evaluation failed",
    );
  }
  return result.result.value;
}

async function waitForCache(client) {
  for (let attempt = 0; attempt < 300; attempt += 1) {
    const state = await evaluate(
      client,
      `globalThis.KDRemoteCache ? ({
        phase: KDRemoteCache.state.phase,
        mode: KDRemoteCache.state.mode,
        completedFiles: KDRemoteCache.state.completedFiles,
        totalFiles: KDRemoteCache.state.totalFiles,
        resumedFiles: KDRemoteCache.state.resumedFiles,
        error: KDRemoteCache.state.error
      }) : null`,
    );
    if (state?.phase === "error") {
      throw new Error(`Browser cache warm failed: ${state.error}`);
    }
    if (state?.phase === "ready") {
      return state;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Timed out waiting for the real browser cache warm");
}

async function stopChild(child) {
  if (!child || child.exitCode !== null) {
    return;
  }
  const exited = new Promise((resolve) => child.once("exit", resolve));
  child.kill("SIGTERM");
  await Promise.race([
    exited,
    new Promise((resolve) => setTimeout(resolve, 5000)),
  ]);
}

await mkdir(path.join(appRoot, "TextureAtlas"), { recursive: true });
await Promise.all([
  writeFile(
    path.join(appRoot, "index.html"),
    `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Kinky Dungeon</title>
  <link rel="icon" id="favicon" href="TextureAtlas/game3.png">
  <link rel="stylesheet" href="fixture.css">
</head>
<body>
  <main id="fixture">KD remote browser cache fixture</main>
  <script src="fixture.js"></script>
</body>
</html>
`,
  ),
  writeFile(
    path.join(appRoot, "fixture.css"),
    "body { background: #111; color: #eee; }\n",
  ),
  writeFile(
    path.join(appRoot, "fixture.js"),
    "globalThis.kdRemoteBrowserFixtureLoaded = true;\n",
  ),
  writeFile(
    path.join(appRoot, "TextureAtlas", "game3.png"),
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+3iS8WQAAAABJRU5ErkJggg==",
      "base64",
    ),
  ),
]);

const browserExecutable = await findBrowser();
const serverPort = await reservePort();
const baseUrl = `http://127.0.0.1:${serverPort}`;
const server = spawn(
  process.execPath,
  [
    "scripts/remote-test-server.mjs",
    "--host",
    "127.0.0.1",
    "--port",
    String(serverPort),
    "--app-root",
    appRoot,
    "--token-file",
    tokenFile,
  ],
  {
    cwd: repoRoot,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  },
);
let serverOutput = "";
server.stdout.setEncoding("utf8");
server.stderr.setEncoding("utf8");
server.stdout.on("data", (chunk) => {
  serverOutput += chunk;
});
server.stderr.on("data", (chunk) => {
  serverOutput += chunk;
});

let chrome;
let socket;
try {
  await waitForServer(`${baseUrl}/`, server);
  const token = (await readFile(tokenFile, "utf8")).trim();
  assert(token.length >= 16, "Remote server did not create its token file");

  const chromeArguments = [
    "--headless=new",
    "--disable-gpu",
    "--disable-background-networking",
    "--no-first-run",
    "--no-default-browser-check",
    `--user-data-dir=${profileRoot}`,
    "--remote-debugging-port=0",
    "about:blank",
  ];
  if (process.platform !== "win32") {
    chromeArguments.unshift("--no-sandbox");
  }
  chrome = spawn(browserExecutable, chromeArguments, {
    stdio: "ignore",
    windowsHide: true,
  });

  const devToolsPort = await waitForDevTools(chrome);
  const page = await openPage(
    devToolsPort,
    `${baseUrl}/?token=${encodeURIComponent(token)}`,
  );
  socket = await connectCdp(page.webSocketDebuggerUrl);
  const client = createCdpClient(socket);
  await client.send("Runtime.enable");

  const firstWarm = await waitForCache(client);
  assert(
    firstWarm.mode === "cache-storage",
    `Real browser selected unexpected cache mode: ${firstWarm.mode}`,
  );
  assert(
    firstWarm.completedFiles === firstWarm.totalFiles &&
      firstWarm.totalFiles >= 4,
    "Real browser did not cache the complete fixture",
  );
  assert(
    await evaluate(client, "globalThis.kdRemoteBrowserFixtureLoaded === true"),
    "Fixture JavaScript did not execute in the real browser",
  );
  const cacheNames = await evaluate(
    client,
    "caches.keys()",
    true,
  );
  assert(
    Array.isArray(cacheNames) &&
      cacheNames.some((name) => name.startsWith("kd-remote-")),
    "Real browser did not create the versioned Cache Storage entry",
  );

  await evaluate(client, "KDRemoteCache.warm(true)", true);
  const resumedWarm = await waitForCache(client);
  assert(
    resumedWarm.resumedFiles === resumedWarm.totalFiles,
    "Real browser did not reuse every cached file during a forced warm",
  );

  process.stdout.write(
    `Remote browser smoke passed in ${path.basename(browserExecutable)}: ` +
      `${resumedWarm.totalFiles} files cached and resumed\n`,
  );
} catch (error) {
  process.stderr.write(serverOutput);
  throw error;
} finally {
  socket?.close();
  await stopChild(chrome);
  await stopChild(server);
  await rm(temporaryRoot, { recursive: true, force: true });
}
