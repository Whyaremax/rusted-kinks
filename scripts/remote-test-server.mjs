import { createReadStream } from "node:fs";
import { readFile, readdir, realpath, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { networkInterfaces } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptRoot, "..");
const liveGameRoot = path.resolve(repoRoot, "..", "..");
const defaultTestRoot = path.join(
  path.dirname(liveGameRoot),
  `${path.basename(liveGameRoot)}-kd-hybrid-test`,
);

function fail(message) {
  process.stderr.write(`Error: ${message}\n`);
  process.exit(1);
}

function parseArguments(argv) {
  const options = {
    host: process.env.KD_REMOTE_HOST ?? "127.0.0.1",
    port: Number(process.env.KD_REMOTE_PORT ?? 8787),
    testRoot: process.env.KD_REMOTE_TEST_ROOT ?? defaultTestRoot,
    appRoot: process.env.KD_REMOTE_APP_ROOT,
    token: process.env.KD_REMOTE_TOKEN,
    tokenFile: process.env.KD_REMOTE_TOKEN_FILE,
    noAuth: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--no-auth") {
      options.noAuth = true;
      continue;
    }
    if (argument === "--lan") {
      options.host = "0.0.0.0";
      continue;
    }
    if (argument === "--help" || argument === "-h") {
      process.stdout.write(`Usage: node scripts/remote-test-server.mjs [options]

Options:
  --host <address>   Address to bind (default: 127.0.0.1)
  --lan              Listen on every IPv4 interface (same as --host 0.0.0.0)
  --port <number>    TCP port to listen on (default: 8787)
  --test-root <path> Isolated KD test installation
  --app-root <path>  resources/app directory to serve directly
  --token <value>    Reusable access token (otherwise generated at startup)
  --token-file <path>
                     Load a reusable token, creating the file if it is missing
  --no-auth          Disable token authentication (private networks only)
  --help             Show this help

Equivalent environment variables: KD_REMOTE_HOST, KD_REMOTE_PORT,
KD_REMOTE_TEST_ROOT, KD_REMOTE_APP_ROOT, KD_REMOTE_TOKEN, and
KD_REMOTE_TOKEN_FILE.
`);
      process.exit(0);
    }

    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      fail(`Missing value for ${argument}`);
    }
    index += 1;
    switch (argument) {
      case "--host":
        options.host = value;
        break;
      case "--port":
        options.port = Number(value);
        break;
      case "--test-root":
        options.testRoot = value;
        break;
      case "--app-root":
        options.appRoot = value;
        break;
      case "--token":
        options.token = value;
        break;
      case "--token-file":
        options.tokenFile = value;
        break;
      default:
        fail(`Unknown option: ${argument}`);
    }
  }

  if (
    !Number.isInteger(options.port) ||
    options.port < 1 ||
    options.port > 65535
  ) {
    fail(`Port must be an integer from 1 through 65535: ${options.port}`);
  }
  if (options.token !== undefined && options.token.length < 16) {
    fail("Access tokens must contain at least 16 characters");
  }
  if (options.token !== undefined && options.tokenFile !== undefined) {
    fail("Use either --token or --token-file, not both");
  }
  return options;
}

async function loadOrCreateAccessToken(tokenFile) {
  if (!tokenFile) {
    return {
      token: randomBytes(24).toString("base64url"),
      tokenFile: undefined,
    };
  }

  const resolvedTokenFile = path.resolve(tokenFile);
  let tokenText;
  try {
    tokenText = await readFile(resolvedTokenFile, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") {
      fail(`Could not read token file ${resolvedTokenFile}: ${error.message}`);
    }
    const generatedToken = randomBytes(24).toString("base64url");
    try {
      await writeFile(resolvedTokenFile, `${generatedToken}\n`, {
        encoding: "utf8",
        flag: "wx",
        mode: 0o600,
      });
      tokenText = generatedToken;
    } catch (writeError) {
      if (writeError.code !== "EEXIST") {
        fail(
          `Could not create token file ${resolvedTokenFile}: ${writeError.message}`,
        );
      }
      tokenText = await readFile(resolvedTokenFile, "utf8");
    }
  }

  const token = tokenText.trim();
  if (token.length < 16) {
    fail(`Token file must contain at least 16 characters: ${resolvedTokenFile}`);
  }
  return { token, tokenFile: resolvedTokenFile };
}

const mimeTypes = new Map([
  [".aac", "audio/aac"],
  [".avif", "image/avif"],
  [".bin", "application/octet-stream"],
  [".css", "text/css; charset=utf-8"],
  [".csv", "text/csv; charset=utf-8"],
  [".gif", "image/gif"],
  [".glsl", "text/plain; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".m4a", "audio/mp4"],
  [".map", "application/json; charset=utf-8"],
  [".mp3", "audio/mpeg"],
  [".mp4", "video/mp4"],
  [".ogg", "audio/ogg"],
  [".otf", "font/otf"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".ttf", "font/ttf"],
  [".txt", "text/plain; charset=utf-8"],
  [".wasm", "application/wasm"],
  [".wav", "audio/wav"],
  [".webm", "video/webm"],
  [".webp", "image/webp"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
  [".xml", "application/xml; charset=utf-8"],
  [".zip", "application/zip"],
]);

function tokenMatches(candidate, expected) {
  if (typeof candidate !== "string") {
    return false;
  }
  const candidateBytes = Buffer.from(candidate);
  const expectedBytes = Buffer.from(expected);
  return (
    candidateBytes.length === expectedBytes.length &&
    timingSafeEqual(candidateBytes, expectedBytes)
  );
}

function cookieToken(request) {
  const cookies = request.headers.cookie?.split(";") ?? [];
  for (const cookie of cookies) {
    const [name, ...value] = cookie.trim().split("=");
    if (name === "kd_remote_token") {
      return decodeURIComponent(value.join("="));
    }
  }
  return undefined;
}

function bearerToken(request) {
  const header = request.headers.authorization;
  return header?.startsWith("Bearer ") ? header.slice(7) : undefined;
}

function sendText(response, statusCode, message, headers = {}) {
  const body = Buffer.from(`${message}\n`);
  response.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "Content-Length": body.length,
    "X-Content-Type-Options": "nosniff",
    ...headers,
  });
  response.end(body);
}

function parseRange(header, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header ?? "");
  if (!match) {
    return undefined;
  }
  let start;
  let end;
  if (match[1] === "") {
    const suffixLength = Number(match[2]);
    if (!Number.isInteger(suffixLength) || suffixLength <= 0) {
      return undefined;
    }
    start = Math.max(size - suffixLength, 0);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] === "" ? size - 1 : Number(match[2]);
  }
  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    start >= size ||
    end < start
  ) {
    return undefined;
  }
  return { start, end: Math.min(end, size - 1) };
}

function ifRangeAllowsRange(header, entityTag, lastModified) {
  if (header === undefined) {
    return true;
  }
  if (typeof header !== "string") {
    return false;
  }
  if (header.startsWith('"') || header.startsWith("W/")) {
    return !entityTag.startsWith("W/") && header === entityTag;
  }
  if (!(lastModified instanceof Date)) {
    return false;
  }
  const validatorTime = Date.parse(header);
  if (!Number.isFinite(validatorTime)) {
    return false;
  }
  return (
    Math.trunc(lastModified.getTime() / 1000) <=
    Math.trunc(validatorTime / 1000)
  );
}

const browserCacheExtensions = new Set([
  ".css",
  ".csv",
  ".gif",
  ".html",
  ".jpeg",
  ".jpg",
  ".js",
  ".json",
  ".m4a",
  ".mp3",
  ".mp4",
  ".ogg",
  ".otf",
  ".png",
  ".svg",
  ".ttf",
  ".wasm",
  ".wav",
  ".webm",
  ".webp",
  ".woff",
  ".woff2",
]);

async function buildBrowserCacheManifest(appRoot) {
  const files = [];
  const versionHash = createHash("sha256");

  const walk = async (directory, relativeDirectory = "") => {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      if (entry.name.startsWith(".")) {
        continue;
      }
      const relativePath = path.join(relativeDirectory, entry.name);
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (
          relativePath === path.join("kd-hybrid", "source") ||
          relativePath === path.join("kd-hybrid", "LICENSES")
        ) {
          continue;
        }
        await walk(absolutePath, relativePath);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      const extension = path.extname(entry.name).toLowerCase();
      if (!browserCacheExtensions.has(extension)) {
        continue;
      }
      if (
        relativeDirectory === "" &&
        ["electron.js", "preload.js", "package.json"].includes(entry.name)
      ) {
        continue;
      }
      const info = await stat(absolutePath);
      const urlPath = `/${relativePath
        .split(path.sep)
        .map(encodeURIComponent)
        .join("/")}`;
      files.push({ path: urlPath, bytes: info.size });
      versionHash.update(relativePath);
      versionHash.update("\0");
      versionHash.update(String(info.size));
      versionHash.update("\0");
      versionHash.update(String(Math.trunc(info.mtimeMs)));
      versionHash.update("\0");
    }
  };

  await walk(appRoot);
  return {
    schema: 1,
    version: versionHash.digest("hex").slice(0, 20),
    files,
    totalBytes: files.reduce((total, file) => total + file.bytes, 0),
  };
}

function cacheClientScript() {
  return String.raw`(() => {
  "use strict";
  const manifestUrl = "/_kd-remote/cache-manifest.json";
  const markerPrefix = "kd-remote-cache:";
  const state = {
    phase: "idle",
    completedFiles: 0,
    totalFiles: 0,
    completedBytes: 0,
    totalBytes: 0,
    resumedFiles: 0,
    storageQuotaBytes: null,
    storageUsageBytes: null,
    storageRequiredBytes: null,
    version: null,
    mode: null,
    error: null
  };
  let panel;

  function formatBytes(bytes) {
    return (bytes / 1048576).toFixed(bytes >= 104857600 ? 0 : 1) + " MiB";
  }

  function showStatus(message, failure = false) {
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "kd-remote-cache-status";
      Object.assign(panel.style, {
        position: "fixed",
        left: "12px",
        bottom: "12px",
        zIndex: "2147483647",
        maxWidth: "min(440px, calc(100vw - 24px))",
        padding: "9px 12px",
        borderRadius: "7px",
        color: "#fff",
        background: "rgba(18, 18, 22, 0.92)",
        font: "13px/1.35 system-ui, sans-serif",
        boxShadow: "0 2px 12px rgba(0, 0, 0, 0.5)",
        pointerEvents: "none"
      });
      document.body.appendChild(panel);
    }
    panel.style.background = failure
      ? "rgba(120, 24, 24, 0.94)"
      : "rgba(18, 18, 22, 0.92)";
    panel.textContent = message;
  }

  function progressMessage() {
    const percent = state.totalBytes
      ? Math.min(100, Math.round(state.completedBytes / state.totalBytes * 100))
      : 0;
    const resumed = state.resumedFiles
      ? " · " + state.resumedFiles + " already saved"
      : "";
    return "Saving game assets for slow connections: " + percent + "% · " +
      state.completedFiles + "/" + state.totalFiles + " files · " +
      formatBytes(state.completedBytes) + "/" + formatBytes(state.totalBytes) +
      resumed;
  }

  function updateProgress(file) {
    state.completedFiles += 1;
    state.completedBytes += file.bytes;
    showStatus(progressMessage());
  }

  async function warmWithBrowserCache(manifest) {
    state.mode = "http-disk-cache";
    let cursor = 0;
    const failures = [];
    const workers = Array.from({ length: 12 }, async () => {
      while (cursor < manifest.files.length) {
        const file = manifest.files[cursor++];
        if (file.path === "/index.html") {
          updateProgress(file);
          continue;
        }
        try {
          const response = await fetch(file.path, {
            cache: "no-cache",
            credentials: "same-origin"
          });
          if (!response.ok) {
            throw new Error("HTTP " + response.status);
          }
          await response.arrayBuffer();
        } catch (error) {
          failures.push(file.path + ": " + error.message);
        }
        updateProgress(file);
      }
    });
    await Promise.all(workers);
    if (failures.length) {
      throw new Error(
        failures.length + " assets failed; first failure: " + failures[0]
      );
    }
  }

  async function warmWithServiceWorker(manifest) {
    state.mode = "cache-storage";
    const registration = await navigator.serviceWorker.register(
      "/_kd-remote/cache-worker.js?v=" + encodeURIComponent(manifest.version),
      { scope: "/" }
    );
    await navigator.serviceWorker.ready;
    const worker =
      registration.active || registration.waiting || registration.installing;
    if (!worker) {
      throw new Error("Cache worker did not become active");
    }
    await new Promise((resolve, reject) => {
      const channel = new MessageChannel();
      channel.port1.onmessage = (event) => {
        if (event.data?.type === "progress") {
          state.completedFiles = event.data.completedFiles;
          state.completedBytes = event.data.completedBytes;
          state.resumedFiles = event.data.resumedFiles || 0;
          state.storageQuotaBytes = event.data.storageQuotaBytes ?? null;
          state.storageUsageBytes = event.data.storageUsageBytes ?? null;
          state.storageRequiredBytes = event.data.storageRequiredBytes ?? null;
          showStatus(progressMessage());
        } else if (event.data?.type === "complete") {
          resolve();
        } else if (event.data?.type === "error") {
          reject(new Error(event.data.message));
        }
      };
      worker.postMessage(
        { type: "warm", manifest },
        [channel.port2]
      );
    });
  }

  async function warm(force = false) {
    if (state.phase === "warming") {
      return;
    }
    state.phase = "checking";
    state.error = null;
    try {
      const response = await fetch(manifestUrl, {
        cache: "no-store",
        credentials: "same-origin"
      });
      if (!response.ok) {
        throw new Error("Cache manifest returned HTTP " + response.status);
      }
      const manifest = await response.json();
      state.version = manifest.version;
      state.totalFiles = manifest.files.length;
      state.totalBytes = manifest.totalBytes;
      const marker = markerPrefix + location.origin;
      if (!force && localStorage.getItem(marker) === manifest.version) {
        state.phase = "ready";
        state.completedFiles = state.totalFiles;
        state.completedBytes = state.totalBytes;
        return;
      }

      state.phase = "warming";
      state.completedFiles = 0;
      state.completedBytes = 0;
      state.resumedFiles = 0;
      state.storageQuotaBytes = null;
      state.storageUsageBytes = null;
      state.storageRequiredBytes = null;
      showStatus(progressMessage());
      if (globalThis.isSecureContext && "serviceWorker" in navigator) {
        await warmWithServiceWorker(manifest);
      } else {
        await warmWithBrowserCache(manifest);
      }
      localStorage.setItem(marker, manifest.version);
      state.phase = "ready";
      showStatus(
        "Game assets saved · " + formatBytes(state.totalBytes) +
        " · later loads will use the local browser cache"
      );
      setTimeout(() => panel?.remove(), 6000);
    } catch (error) {
      state.phase = "error";
      state.error = error.message;
      showStatus("Asset caching stopped: " + error.message, true);
      throw error;
    }
  }

  globalThis.KDRemoteCache = Object.freeze({
    warm,
    state
  });
  if (!new URL(location.href).searchParams.has("kdNoWarm")) {
    addEventListener("load", () => {
      setTimeout(() => warm().catch(console.error), 1500);
    }, { once: true });
  }
})();`;
}

function cacheWorkerScript(version) {
  return String.raw`"use strict";
const cacheName = "kd-remote-${version}";
const cachePrefix = "kd-remote-";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/_kd-remote/")
  ) {
    return;
  }
  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(event.request, {
      ignoreSearch: event.request.mode === "navigate"
    });
    if (cached) {
      return cached;
    }
    try {
      const response = await fetch(event.request);
      if (response.ok) {
        await cache.put(event.request, response.clone());
      }
      return response;
    } catch (error) {
      if (event.request.mode === "navigate") {
        const fallback = await cache.match("/index.html");
        if (fallback) return fallback;
      }
      throw error;
    }
  })());
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "warm" || !event.ports[0]) {
    return;
  }
  const port = event.ports[0];
  event.waitUntil((async () => {
    try {
      const oldCaches = (await caches.keys()).filter(
        (name) => name.startsWith(cachePrefix) && name !== cacheName
      );
      await Promise.all(oldCaches.map((name) => caches.delete(name)));
      const cache = await caches.open(cacheName);
      const files = event.data.manifest.files;
      let completedFiles = 0;
      let completedBytes = 0;
      let resumedFiles = 0;
      const pendingFiles = [];
      for (const file of files) {
        const cached = await cache.match(file.path);
        if (cached) {
          completedFiles += 1;
          completedBytes += file.bytes;
          resumedFiles += 1;
        } else {
          pendingFiles.push(file);
        }
      }
      const pendingBytes = pendingFiles.reduce(
        (total, file) => total + file.bytes,
        0
      );
      let storageEstimate = null;
      try {
        storageEstimate =
          await self.navigator?.storage?.estimate?.() ?? null;
      } catch {
        // Storage estimates are advisory; unsupported browsers still warm.
      }
      const storageQuotaBytes = Number.isFinite(storageEstimate?.quota)
        ? storageEstimate.quota
        : null;
      const storageUsageBytes = Number.isFinite(storageEstimate?.usage)
        ? storageEstimate.usage
        : null;
      const storageReserveBytes = pendingBytes > 0
        ? Math.max(16 * 1024 * 1024, Math.ceil(pendingBytes * 0.1))
        : 0;
      const storageRequiredBytes = pendingBytes + storageReserveBytes;
      port.postMessage({
        type: "progress",
        completedFiles,
        completedBytes,
        resumedFiles,
        storageQuotaBytes,
        storageUsageBytes,
        storageRequiredBytes
      });
      if (
        storageQuotaBytes !== null &&
        storageUsageBytes !== null &&
        storageQuotaBytes - storageUsageBytes < storageRequiredBytes
      ) {
        const missingMiB = (pendingBytes / 1048576).toFixed(1);
        const availableMiB = (
          Math.max(storageQuotaBytes - storageUsageBytes, 0) / 1048576
        ).toFixed(1);
        throw new Error(
          "Not enough browser storage to save the remaining assets (" +
          missingMiB + " MiB needed, " + availableMiB + " MiB available)"
        );
      }
      let cursor = 0;
      const failures = [];
      const workers = Array.from({ length: 4 }, async () => {
        while (cursor < pendingFiles.length) {
          const file = pendingFiles[cursor++];
          try {
            const response = await fetch(file.path, {
              cache: "no-cache",
              credentials: "same-origin"
            });
            if (!response.ok) {
              throw new Error("HTTP " + response.status);
            }
            await cache.put(file.path, response);
          } catch (error) {
            failures.push(file.path + ": " + error.message);
          }
          completedFiles += 1;
          completedBytes += file.bytes;
          port.postMessage({
            type: "progress",
            completedFiles,
            completedBytes,
            resumedFiles,
            storageQuotaBytes,
            storageUsageBytes,
            storageRequiredBytes
          });
        }
      });
      await Promise.all(workers);
      if (failures.length) {
        throw new Error(
          failures.length + " assets failed; first failure: " + failures[0]
        );
      }
      port.postMessage({ type: "complete" });
    } catch (error) {
      port.postMessage({ type: "error", message: error.message });
    }
  })());
});`;
}

function injectRemoteEnhancements(html, cacheVersion) {
  const existingFavicon =
    /<link\s+rel=["']icon["'][^>]*\sid=["']favicon["'][^>]*>/i;
  if (!existingFavicon.test(html)) {
    return html;
  }
  const replacement = `<link rel="icon" type="image/png" id="favicon">
\t<script>
\t(() => {
\t\tconst atlas = new Image();
\t\tatlas.addEventListener("load", () => {
\t\t\tconst canvas = document.createElement("canvas");
\t\t\tcanvas.width = 72;
\t\t\tcanvas.height = 72;
\t\t\tconst context = canvas.getContext("2d");
\t\t\tcontext.drawImage(atlas, 117, 1756, 55, 27, 9, 22, 55, 27);
\t\t\tdocument.getElementById("favicon").href = canvas.toDataURL("image/png");
\t\t}, { once: true });
\t\tatlas.src = "TextureAtlas/game3.png";
\t})();
\t</script>`;
  const withFavicon = html.replace(existingFavicon, replacement);
  const cacheClient = `<script src="/_kd-remote/cache-client.js?v=${cacheVersion}"></script>`;
  return withFavicon.replace("</body>", `${cacheClient}\n</body>`);
}

function listeningAddresses(host, port, token, authEnabled) {
  const suffix = authEnabled ? `/?token=${encodeURIComponent(token)}` : "/";
  if (host !== "0.0.0.0" && host !== "::") {
    const displayHost = host.includes(":") ? `[${host}]` : host;
    return [`http://${displayHost}:${port}${suffix}`];
  }

  const addresses = new Set();
  for (const interfaces of Object.values(networkInterfaces())) {
    for (const entry of interfaces ?? []) {
      if (!entry.internal && entry.family === "IPv4") {
        addresses.add(`http://${entry.address}:${port}${suffix}`);
      }
    }
  }
  if (addresses.size === 0) {
    addresses.add(`http://127.0.0.1:${port}${suffix}`);
  }
  return [...addresses];
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const requestedAppRoot = path.resolve(
    options.appRoot ?? path.join(options.testRoot, "resources", "app"),
  );
  let appRoot;
  try {
    appRoot = await realpath(requestedAppRoot);
    const indexInfo = await stat(path.join(appRoot, "index.html"));
    if (!indexInfo.isFile()) {
      fail(`index.html is not a file under ${appRoot}`);
    }
  } catch (error) {
    fail(`Test app is not ready at ${requestedAppRoot}: ${error.message}`);
  }

  const rootPrefix = `${appRoot}${path.sep}`;
  const authEnabled = !options.noAuth;
  const requestedTokenFile = options.tokenFile
    ? path.resolve(options.tokenFile)
    : undefined;
  if (
    authEnabled &&
    requestedTokenFile &&
    (requestedTokenFile === appRoot ||
      requestedTokenFile.startsWith(rootPrefix))
  ) {
    fail("The token file must be outside the served application directory");
  }
  const tokenSource = !authEnabled
    ? { token: "", tokenFile: undefined }
    : options.token
      ? { token: options.token, tokenFile: undefined }
      : await loadOrCreateAccessToken(requestedTokenFile);
  const accessToken = tokenSource.token;
  const cacheManifest = await buildBrowserCacheManifest(appRoot);
  const cacheManifestBody = Buffer.from(JSON.stringify(cacheManifest));
  const cacheClientBody = Buffer.from(cacheClientScript());
  const cacheWorkerBody = Buffer.from(
    cacheWorkerScript(cacheManifest.version),
  );
  const generatedRoutes = new Map([
    [
      "/_kd-remote/cache-manifest.json",
      [cacheManifestBody, "application/json; charset=utf-8"],
    ],
    [
      "/_kd-remote/cache-client.js",
      [cacheClientBody, "text/javascript; charset=utf-8"],
    ],
    [
      "/_kd-remote/cache-worker.js",
      [cacheWorkerBody, "text/javascript; charset=utf-8"],
    ],
  ]);

  const server = createServer(async (request, response) => {
    try {
      if (request.method !== "GET" && request.method !== "HEAD") {
        sendText(response, 405, "Method not allowed", { Allow: "GET, HEAD" });
        return;
      }

      const requestUrl = new URL(request.url ?? "/", "http://kd-remote.local");
      if (authEnabled) {
        const queryToken = requestUrl.searchParams.get("token");
        const authenticated =
          tokenMatches(queryToken, accessToken) ||
          tokenMatches(cookieToken(request), accessToken) ||
          tokenMatches(bearerToken(request), accessToken);
        if (!authenticated) {
          sendText(response, 401, "A valid KD remote access token is required", {
            "Cache-Control": "no-store",
          });
          return;
        }
        if (queryToken !== null) {
          requestUrl.searchParams.delete("token");
          const cleanTarget = `${requestUrl.pathname}${requestUrl.search}`;
          response.writeHead(303, {
            Location: cleanTarget || "/",
            "Set-Cookie": `kd_remote_token=${encodeURIComponent(accessToken)}; HttpOnly; SameSite=Strict; Path=/`,
            "Cache-Control": "no-store",
            "Referrer-Policy": "no-referrer",
          });
          response.end();
          return;
        }
      }

      if (requestUrl.pathname === "/_kd-remote/health") {
        const body = Buffer.from(
          JSON.stringify({
            status: "ok",
            appRoot,
            authentication: authEnabled,
          }),
        );
        response.writeHead(200, {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Length": body.length,
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        });
        response.end(request.method === "HEAD" ? undefined : body);
        return;
      }

      const generatedRoute = generatedRoutes.get(requestUrl.pathname);
      if (generatedRoute) {
        const [body, contentType] = generatedRoute;
        const routeHeaders = {
          "Content-Type": contentType,
          "Content-Length": body.length,
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
          "Referrer-Policy": "no-referrer",
        };
        if (requestUrl.pathname === "/_kd-remote/cache-worker.js") {
          routeHeaders["Service-Worker-Allowed"] = "/";
        }
        response.writeHead(200, routeHeaders);
        response.end(request.method === "HEAD" ? undefined : body);
        return;
      }

      let decodedPath;
      try {
        decodedPath = decodeURIComponent(requestUrl.pathname);
      } catch {
        sendText(response, 400, "Malformed URL path");
        return;
      }
      if (decodedPath.includes("\0")) {
        sendText(response, 400, "Malformed URL path");
        return;
      }

      const pathSegments = decodedPath.split("/").filter(Boolean);
      if (pathSegments.some((segment) => segment.startsWith("."))) {
        sendText(response, 404, "Not found");
        return;
      }
      const relativePath =
        pathSegments.length === 0 ? "index.html" : pathSegments.join(path.sep);
      const candidate = path.resolve(appRoot, relativePath);
      if (candidate !== appRoot && !candidate.startsWith(rootPrefix)) {
        sendText(response, 403, "Path is outside the test application");
        return;
      }

      let resolvedFile;
      let fileInfo;
      try {
        resolvedFile = await realpath(candidate);
        if (resolvedFile !== appRoot && !resolvedFile.startsWith(rootPrefix)) {
          sendText(response, 403, "Path is outside the test application");
          return;
        }
        fileInfo = await stat(resolvedFile);
        if (fileInfo.isDirectory()) {
          resolvedFile = await realpath(path.join(resolvedFile, "index.html"));
          fileInfo = await stat(resolvedFile);
        }
        if (!fileInfo.isFile()) {
          sendText(response, 404, "Not found");
          return;
        }
      } catch {
        sendText(response, 404, "Not found");
        return;
      }

      const extension = path.extname(resolvedFile).toLowerCase();
      const generatedBody =
        extension === ".html"
          ? Buffer.from(
              injectRemoteEnhancements(
                await readFile(resolvedFile, "utf8"),
                cacheManifest.version,
              ),
              "utf8",
            )
          : undefined;
      const responseSize = generatedBody?.length ?? fileInfo.size;
      const entityTag = generatedBody
        ? `"generated-${cacheManifest.version}"`
        : `W/"${fileInfo.size.toString(16)}-${Math.trunc(fileInfo.mtimeMs).toString(16)}"`;
      const lastModified = generatedBody ? undefined : fileInfo.mtime;
      const rangeAllowed = ifRangeAllowsRange(
        request.headers["if-range"],
        entityTag,
        lastModified,
      );
      const range =
        request.headers.range && rangeAllowed
          ? parseRange(request.headers.range, responseSize)
          : undefined;
      const headers = {
        "Content-Type": mimeTypes.get(extension) ?? "application/octet-stream",
        "Accept-Ranges": "bytes",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
        ETag: entityTag,
        "Cache-Control":
          extension === ".html"
            ? "no-store"
            : "private, max-age=31536000, immutable",
      };
      if (lastModified) {
        headers["Last-Modified"] = lastModified.toUTCString();
      }
      if (!request.headers.range && request.headers["if-none-match"] === entityTag) {
        response.writeHead(304, headers);
        response.end();
        return;
      }
      if (request.headers.range && rangeAllowed && !range) {
        response.writeHead(416, {
          ...headers,
          "Content-Range": `bytes */${responseSize}`,
        });
        response.end();
        return;
      }
      if (range) {
        response.writeHead(206, {
          ...headers,
          "Content-Length": range.end - range.start + 1,
          "Content-Range": `bytes ${range.start}-${range.end}/${responseSize}`,
        });
        if (request.method === "HEAD") {
          response.end();
        } else if (generatedBody) {
          response.end(generatedBody.subarray(range.start, range.end + 1));
        } else {
          createReadStream(resolvedFile, range).pipe(response);
        }
        return;
      }

      response.writeHead(200, {
        ...headers,
        "Content-Length": responseSize,
      });
      if (request.method === "HEAD") {
        response.end();
      } else if (generatedBody) {
        response.end(generatedBody);
      } else {
        createReadStream(resolvedFile).pipe(response);
      }
    } catch (error) {
      sendText(response, 500, "Internal server error");
      process.stderr.write(`${error.stack ?? error}\n`);
    }
  });

  server.on("error", (error) => {
    fail(`Could not listen on ${options.host}:${options.port}: ${error.message}`);
  });
  server.listen(options.port, options.host, () => {
    process.stdout.write(`KD remote test server\n`);
    process.stdout.write(`Serving: ${appRoot}\n`);
    process.stdout.write(`Binding: ${options.host}:${options.port}\n`);
    process.stdout.write(
      `Authentication: ${authEnabled ? "token required" : "disabled"}\n`,
    );
    if (authEnabled) {
      process.stdout.write(
        tokenSource.tokenFile
          ? `Reusable token file: ${tokenSource.tokenFile}\n`
          : "Token lifetime: this server process only\n",
      );
    }
    process.stdout.write(
      `Browser cache: ${cacheManifest.files.length} files, ${(cacheManifest.totalBytes / 1048576).toFixed(1)} MiB, version ${cacheManifest.version}\n`,
    );
    for (const address of listeningAddresses(
      options.host,
      options.port,
      accessToken,
      authEnabled,
    )) {
      process.stdout.write(`Open: ${address}\n`);
    }
    process.stdout.write(
      "Remote browser saves stay in that browser profile; Electron saves are not served.\n",
    );
  });

  const stop = () => {
    process.stdout.write("Stopping KD remote test server...\n");
    server.close(() => process.exit(0));
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

await main();
