import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import net from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptRoot, "..");
const temporaryRoot = await mkdtemp(path.join(tmpdir(), "kd-remote-smoke-"));
const tokenFile = path.join(temporaryRoot, "access-token.txt");

function reservePort() {
  return new Promise((resolve, reject) => {
    const reservation = net.createServer();
    reservation.once("error", reject);
    reservation.listen(0, "127.0.0.1", () => {
      const address = reservation.address();
      const port = typeof address === "object" && address ? address.port : 0;
      reservation.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function waitForServer(url, child) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
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
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Timed out waiting for the remote server");
}

const port = await reservePort();
const baseUrl = `http://127.0.0.1:${port}`;
const child = spawn(
  process.execPath,
  [
    "scripts/remote-test-server.mjs",
    "--lan",
    "--port",
    String(port),
    "--token-file",
    tokenFile,
  ],
  {
    cwd: repoRoot,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  },
);

let stdout = "";
let stderr = "";
child.stdout.setEncoding("utf8");
child.stderr.setEncoding("utf8");
child.stdout.on("data", (chunk) => {
  stdout += chunk;
});
child.stderr.on("data", (chunk) => {
  stderr += chunk;
});
let reuseChild;

try {
  await waitForServer(`${baseUrl}/`, child);
  const token = (await readFile(tokenFile, "utf8")).trim();
  assert(
    token.length >= 16,
    "Server did not create a reusable token file",
  );

  const unauthorized = await fetch(`${baseUrl}/`);
  assert(unauthorized.status === 401, "Unauthenticated request was not rejected");

  const login = await fetch(`${baseUrl}/?token=${token}`, {
    redirect: "manual",
  });
  assert(login.status === 303, "Token login did not redirect");
  assert(login.headers.get("location") === "/", "Token remained in redirect URL");
  const cookie = login.headers.get("set-cookie")?.split(";", 1)[0];
  assert(cookie, "Token login did not set an authentication cookie");

  const authenticatedHeaders = { Cookie: cookie };
  const index = await fetch(`${baseUrl}/`, { headers: authenticatedHeaders });
  assert(index.status === 200, "Authenticated index request failed");
  const indexHtml = await index.text();
  assert(
    indexHtml.includes("<title>Kinky Dungeon</title>"),
    "Served index is not the isolated KD test application",
  );
  assert(
    indexHtml.includes('atlas.src = "TextureAtlas/game3.png"'),
    "Ball-gag favicon extraction was not injected",
  );
  assert(
    !indexHtml.includes('href="Game/Locks/Red.png"'),
    "Missing upstream favicon reference was not replaced",
  );
  assert(
    indexHtml.includes("/_kd-remote/cache-client.js?v="),
    "Remote cache client was not injected",
  );

  const manifest = await fetch(
    `${baseUrl}/_kd-remote/cache-manifest.json`,
    { headers: authenticatedHeaders },
  );
  assert(manifest.status === 200, "Cache manifest request failed");
  const manifestBody = await manifest.json();
  assert(manifestBody.files.length > 100, "Cache manifest is unexpectedly small");
  assert(manifestBody.totalBytes > 0, "Cache manifest has no content");

  const cacheClient = await fetch(`${baseUrl}/_kd-remote/cache-client.js`, {
    headers: authenticatedHeaders,
  });
  assert(cacheClient.status === 200, "Cache client request failed");
  assert(
    cacheClient.headers.get("cache-control") === "no-store",
    "Cache client must not be stored with a stale manifest",
  );
  assert(
    (await cacheClient.text()).includes("state.resumedFiles"),
    "Cache client does not report resumed Cache Storage files",
  );

  const cacheWorker = await fetch(
    `${baseUrl}/_kd-remote/cache-worker.js`,
    { headers: authenticatedHeaders },
  );
  assert(cacheWorker.status === 200, "Cache worker request failed");
  assert(
    cacheWorker.headers.get("service-worker-allowed") === "/",
    "Cache worker did not receive the root scope permission",
  );
  const cacheWorkerBody = await cacheWorker.text();
  assert(
    cacheWorkerBody.includes("const cached = await cache.match(file.path)"),
    "Cache worker does not resume a partially completed warm",
  );
  assert(
    cacheWorkerBody.includes("resumedFiles"),
    "Cache worker does not report resumed file progress",
  );
  assert(
    cacheWorkerBody.includes("self.navigator?.storage?.estimate?.()"),
    "Cache worker does not inspect available browser storage",
  );
  assert(
    cacheWorkerBody.includes("storageRequiredBytes"),
    "Cache worker does not report its storage budget",
  );
  assert(
    cacheWorkerBody.includes("Not enough browser storage"),
    "Cache worker does not provide a useful storage-pressure error",
  );

  const atlas = await fetch(`${baseUrl}/TextureAtlas/game3.png`, {
    method: "HEAD",
    headers: authenticatedHeaders,
  });
  assert(atlas.status === 200, "Cacheable asset HEAD request failed");
  assert(
    atlas.headers.get("cache-control")?.includes("max-age=31536000"),
    "Asset does not have a long-lived cache rule",
  );
  const atlasTag = atlas.headers.get("etag");
  assert(atlasTag, "Cacheable asset did not receive an ETag");
  const unchangedAtlas = await fetch(`${baseUrl}/TextureAtlas/game3.png`, {
    headers: { ...authenticatedHeaders, "If-None-Match": atlasTag },
  });
  assert(unchangedAtlas.status === 304, "ETag validation did not return 304");

  const health = await fetch(`${baseUrl}/_kd-remote/health`, {
    headers: authenticatedHeaders,
  });
  assert(health.status === 200, "Health request failed");
  assert((await health.json()).status === "ok", "Health response was invalid");

  const wasm = await fetch(
    `${baseUrl}/kd-hybrid/wasm/kd_hybrid_core_bg.wasm`,
    { method: "HEAD", headers: authenticatedHeaders },
  );
  assert(wasm.status === 200, "WASM HEAD request failed");
  assert(
    wasm.headers.get("content-type") === "application/wasm",
    "WASM MIME type was incorrect",
  );
  const wasmSize = Number(wasm.headers.get("content-length"));
  const wasmTag = wasm.headers.get("etag");
  const wasmLastModified = wasm.headers.get("last-modified");
  assert(
    Number.isInteger(wasmSize) && wasmSize > 64,
    "WASM response did not expose a useful content length",
  );
  assert(
    wasmTag?.startsWith('W/"'),
    "Static asset did not expose its weak cache validator",
  );
  assert(wasmLastModified, "Static asset did not expose Last-Modified");

  const wasmUrl = `${baseUrl}/kd-hybrid/wasm/kd_hybrid_core_bg.wasm`;
  const prefixEnd = Math.min(4095, wasmSize - 2);
  const prefix = await fetch(wasmUrl, {
    headers: {
      ...authenticatedHeaders,
      Range: `bytes=0-${prefixEnd}`,
    },
  });
  assert(prefix.status === 206, "Initial partial asset request failed");
  assert(
    prefix.headers.get("content-range") ===
      `bytes 0-${prefixEnd}/${wasmSize}`,
    "Initial partial asset response had the wrong Content-Range",
  );
  const prefixBody = Buffer.from(await prefix.arrayBuffer());

  const resumed = await fetch(wasmUrl, {
    headers: {
      ...authenticatedHeaders,
      Range: `bytes=${prefixEnd + 1}-`,
      "If-Range": wasmLastModified,
    },
  });
  assert(resumed.status === 206, "Validated asset resume request failed");
  assert(
    resumed.headers.get("content-range") ===
      `bytes ${prefixEnd + 1}-${wasmSize - 1}/${wasmSize}`,
    "Resumed asset response had the wrong Content-Range",
  );
  const resumedBody = Buffer.from(await resumed.arrayBuffer());

  const fullWasm = await fetch(wasmUrl, { headers: authenticatedHeaders });
  assert(fullWasm.status === 200, "Full WASM comparison request failed");
  const fullWasmBody = Buffer.from(await fullWasm.arrayBuffer());
  assert(
    Buffer.concat([prefixBody, resumedBody]).equals(fullWasmBody),
    "Resumed asset bytes did not reconstruct the original file",
  );

  const staleResume = await fetch(wasmUrl, {
    headers: {
      ...authenticatedHeaders,
      Range: `bytes=${prefixEnd + 1}-`,
      "If-Range": "Thu, 01 Jan 1970 00:00:00 GMT",
    },
  });
  assert(
    staleResume.status === 200,
    "Stale If-Range validator did not force a complete response",
  );
  assert(
    (await staleResume.arrayBuffer()).byteLength === wasmSize,
    "Stale resume response was not the complete asset",
  );

  const weakTagResume = await fetch(wasmUrl, {
    headers: {
      ...authenticatedHeaders,
      Range: `bytes=${prefixEnd + 1}-`,
      "If-Range": wasmTag,
    },
  });
  assert(
    weakTagResume.status === 200,
    "Weak ETag incorrectly authorized a partial If-Range response",
  );
  await weakTagResume.arrayBuffer();

  const unsatisfiedRange = await fetch(wasmUrl, {
    headers: {
      ...authenticatedHeaders,
      Range: `bytes=${wasmSize}-`,
    },
  });
  assert(
    unsatisfiedRange.status === 416,
    "Unsatisfied byte range was not rejected",
  );
  assert(
    unsatisfiedRange.headers.get("content-range") === `bytes */${wasmSize}`,
    "Unsatisfied range response did not expose the complete size",
  );

  const range = await fetch(`${baseUrl}/index.html`, {
    headers: { ...authenticatedHeaders, Range: "bytes=0-31" },
  });
  assert(range.status === 206, "Byte-range request failed");
  assert((await range.arrayBuffer()).byteLength === 32, "Byte range was wrong");

  const traversal = await fetch(`${baseUrl}/%2e%2e%2fpackage.json`, {
    headers: authenticatedHeaders,
  });
  assert(traversal.status === 404, "Dot-segment traversal was not blocked");
  assert(
    stdout.includes(`Reusable token file: ${path.resolve(tokenFile)}`),
    "Server did not confirm that it loaded the reusable token file",
  );

  const stopped = new Promise((resolve) => child.once("exit", resolve));
  child.kill("SIGTERM");
  await stopped;

  const reusePort = await reservePort();
  const reuseBaseUrl = `http://127.0.0.1:${reusePort}`;
  reuseChild = spawn(
    process.execPath,
    [
      "scripts/remote-test-server.mjs",
      "--host",
      "127.0.0.1",
      "--port",
      String(reusePort),
      "--token-file",
      tokenFile,
    ],
    {
      cwd: repoRoot,
      stdio: "ignore",
      windowsHide: true,
    },
  );
  await waitForServer(`${reuseBaseUrl}/`, reuseChild);
  const reusedLogin = await fetch(`${reuseBaseUrl}/?token=${token}`, {
    redirect: "manual",
  });
  assert(
    reusedLogin.status === 303,
    "A restarted server did not accept the token file's existing value",
  );

  process.stdout.write(
    `Remote server smoke test passed on ports ${port} and ${reusePort}\n`,
  );
} catch (error) {
  process.stderr.write(stdout);
  process.stderr.write(stderr);
  throw error;
} finally {
  child.kill("SIGTERM");
  reuseChild?.kill("SIGTERM");
  await rm(temporaryRoot, { recursive: true, force: true });
}
