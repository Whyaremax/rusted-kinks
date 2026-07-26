import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptRoot, "..");
const token = "kd-remote-smoke-token-2026";

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
    "--host",
    "127.0.0.1",
    "--port",
    String(port),
    "--token",
    token,
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

try {
  await waitForServer(`${baseUrl}/`, child);

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

  const range = await fetch(`${baseUrl}/index.html`, {
    headers: { ...authenticatedHeaders, Range: "bytes=0-31" },
  });
  assert(range.status === 206, "Byte-range request failed");
  assert((await range.arrayBuffer()).byteLength === 32, "Byte range was wrong");

  const traversal = await fetch(`${baseUrl}/%2e%2e%2fpackage.json`, {
    headers: authenticatedHeaders,
  });
  assert(traversal.status === 404, "Dot-segment traversal was not blocked");

  process.stdout.write(`Remote server smoke test passed on port ${port}\n`);
} catch (error) {
  process.stderr.write(stdout);
  process.stderr.write(stderr);
  throw error;
} finally {
  child.kill("SIGTERM");
}
