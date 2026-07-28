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
const temporaryRoot = await mkdtemp(path.join(tmpdir(), "kd-remote-firefox-"));
const appRoot = path.join(temporaryRoot, "app");
const profileRoot = path.join(temporaryRoot, "firefox-profile");
const tokenFile = path.join(temporaryRoot, "access-token.txt");

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

async function findFirefox() {
  const candidates = [
    process.env.KD_FIREFOX_EXECUTABLE,
    process.env.ProgramFiles &&
      path.join(process.env.ProgramFiles, "Mozilla Firefox", "firefox.exe"),
    process.env["ProgramFiles(x86)"] &&
      path.join(
        process.env["ProgramFiles(x86)"],
        "Mozilla Firefox",
        "firefox.exe",
      ),
    "/usr/bin/firefox",
    "/Applications/Firefox.app/Contents/MacOS/firefox",
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next known Firefox location.
    }
  }
  throw new Error(
    "Firefox was not found; set KD_FIREFOX_EXECUTABLE to its executable",
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

async function waitForBidi(firefox, output, port) {
  const marker = `WebDriver BiDi listening on ws://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (firefox.exitCode !== null) {
      throw new Error(`Firefox exited early with code ${firefox.exitCode}`);
    }
    if (output.value.includes(marker)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("Timed out waiting for Firefox WebDriver BiDi");
}

async function connectBidi(url) {
  return await new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const timeout = setTimeout(() => {
      socket.close();
      reject(new Error("Timed out connecting to Firefox WebDriver BiDi"));
    }, 5000);
    socket.addEventListener(
      "open",
      () => {
        clearTimeout(timeout);
        resolve(socket);
      },
      { once: true },
    );
    socket.addEventListener(
      "error",
      () => {
        clearTimeout(timeout);
        reject(new Error("Could not connect to Firefox WebDriver BiDi"));
      },
      { once: true },
    );
  });
}

function createBidiClient(socket) {
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
    clearTimeout(request.timeout);
    if (message.type === "error") {
      request.reject(
        new Error(
          `${request.method}: ${message.error}: ${message.message ?? ""}`,
        ),
      );
    } else {
      request.resolve(message.result);
    }
  });
  socket.addEventListener("close", () => {
    for (const request of pending.values()) {
      clearTimeout(request.timeout);
      request.reject(new Error(`Firefox closed during ${request.method}`));
    }
    pending.clear();
  });

  return {
    send(method, params = {}) {
      requestId += 1;
      const id = requestId;
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`Timed out during ${method}`));
        }, 15000);
        pending.set(id, { method, resolve, reject, timeout });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
  };
}

async function evaluateJson(client, context, expression) {
  const response = await client.send("script.evaluate", {
    expression,
    target: { context },
    awaitPromise: true,
    resultOwnership: "none",
  });
  if (response.type === "exception") {
    throw new Error(
      response.exceptionDetails?.exception?.value ??
        response.exceptionDetails?.text ??
        "Firefox evaluation failed",
    );
  }
  const value = response.result?.value;
  if (typeof value !== "string") {
    throw new Error("Firefox evaluation did not return serialized JSON");
  }
  return JSON.parse(value);
}

async function waitForCache(client, context) {
  for (let attempt = 0; attempt < 300; attempt += 1) {
    const state = await evaluateJson(
      client,
      context,
      `JSON.stringify(globalThis.KDRemoteCache ? ({
        phase: KDRemoteCache.state.phase,
        mode: KDRemoteCache.state.mode,
        completedFiles: KDRemoteCache.state.completedFiles,
        totalFiles: KDRemoteCache.state.totalFiles,
        resumedFiles: KDRemoteCache.state.resumedFiles,
        error: KDRemoteCache.state.error
      }) : null)`,
    );
    if (state?.phase === "error") {
      throw new Error(`Firefox cache warm failed: ${state.error}`);
    }
    if (state?.phase === "ready") {
      return state;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Timed out waiting for the Firefox cache warm");
}

async function stopChild(child, processTree = false) {
  if (!child) {
    return;
  }
  if (process.platform === "win32" && processTree && child.pid) {
    await new Promise((resolve) => {
      const killer = spawn(
        "taskkill.exe",
        ["/PID", String(child.pid), "/T", "/F"],
        { stdio: "ignore", windowsHide: true },
      );
      killer.once("exit", resolve);
      killer.once("error", resolve);
    });
    await new Promise((resolve) => setTimeout(resolve, 500));
    return;
  }
  if (child.exitCode !== null) {
    return;
  }
  const exited = new Promise((resolve) => child.once("exit", resolve));
  child.kill("SIGTERM");
  await Promise.race([
    exited,
    new Promise((resolve) => setTimeout(resolve, 5000)),
  ]);
}

async function removeTemporaryRoot() {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      await rm(temporaryRoot, { recursive: true, force: true });
      return;
    } catch (error) {
      if (attempt === 19) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
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
  <main id="fixture">KD remote Firefox cache fixture</main>
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

const firefoxExecutable = await findFirefox();
const serverPort = await reservePort();
const bidiPort = await reservePort();
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

let firefox;
let socket;
let client;
try {
  await waitForServer(`${baseUrl}/`, server);
  const token = (await readFile(tokenFile, "utf8")).trim();
  assert(token.length >= 16, "Remote server did not create its token file");

  const firefoxOutput = { value: "" };
  firefox = spawn(
    firefoxExecutable,
    [
      "--headless",
      "--no-remote",
      "--profile",
      profileRoot,
      "--remote-debugging-port",
      String(bidiPort),
      "about:blank",
    ],
    {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  );
  for (const stream of [firefox.stdout, firefox.stderr]) {
    stream.setEncoding("utf8");
    stream.on("data", (chunk) => {
      firefoxOutput.value += chunk;
    });
  }
  await waitForBidi(firefox, firefoxOutput, bidiPort);
  socket = await connectBidi(`ws://127.0.0.1:${bidiPort}/session`);
  client = createBidiClient(socket);

  const session = await client.send("session.new", { capabilities: {} });
  assert(
    session.capabilities?.browserName === "firefox",
    "WebDriver BiDi did not create a Firefox session",
  );
  const tree = await client.send("browsingContext.getTree");
  const context = tree.contexts?.[0]?.context;
  assert(context, "Firefox did not expose an initial browsing context");
  await client.send("browsingContext.navigate", {
    context,
    url: `${baseUrl}/?token=${encodeURIComponent(token)}`,
    wait: "complete",
  });

  const firstWarm = await waitForCache(client, context);
  assert(
    firstWarm.mode === "cache-storage",
    `Firefox selected unexpected cache mode: ${firstWarm.mode}`,
  );
  assert(
    firstWarm.completedFiles === firstWarm.totalFiles &&
      firstWarm.totalFiles >= 4,
    "Firefox did not cache the complete fixture",
  );
  assert(
    await evaluateJson(
      client,
      context,
      "JSON.stringify(globalThis.kdRemoteBrowserFixtureLoaded === true)",
    ),
    "Fixture JavaScript did not execute in Firefox",
  );
  const cacheNames = await evaluateJson(
    client,
    context,
    "(async () => JSON.stringify(await caches.keys()))()",
  );
  assert(
    Array.isArray(cacheNames) &&
      cacheNames.some((name) => name.startsWith("kd-remote-")),
    "Firefox did not create the versioned Cache Storage entry",
  );

  await evaluateJson(
    client,
    context,
    "(async () => { await KDRemoteCache.warm(true); return JSON.stringify(true); })()",
  );
  const resumedWarm = await waitForCache(client, context);
  assert(
    resumedWarm.resumedFiles === resumedWarm.totalFiles,
    "Firefox did not reuse every cached file during a forced warm",
  );

  process.stdout.write(
    `Remote Firefox smoke passed in ${path.basename(firefoxExecutable)}: ` +
      `${resumedWarm.totalFiles} files cached and resumed\n`,
  );
} catch (error) {
  process.stderr.write(serverOutput);
  throw error;
} finally {
  try {
    await client?.send("browser.close");
  } catch {
    // The process-tree fallback below handles failed or closed sessions.
  }
  socket?.close();
  await stopChild(firefox, true);
  await stopChild(server);
  await removeTemporaryRoot();
}
