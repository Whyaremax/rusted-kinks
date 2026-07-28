#!/usr/bin/env node

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
async function main() {
  const options = parseArgs(process.argv.slice(2));
  const startedAt = Date.now();
  const candidateBundle =
    options.candidateBundle === null
      ? null
      : await fileIdentity(options.candidateBundle);
  const target = await waitForTarget(options.port, options.connectTimeoutMs);
  const client = new CdpClient(target.webSocketDebuggerUrl);
  await client.connect();

  try {
    await client.send("Runtime.enable");
    await client.send("Page.enable");
    await client.send("Performance.enable", { timeDomain: "timeTicks" });
    await client.send("Page.bringToFront");

    const ready = await waitForReady(client, options.readyTimeoutMs);
    const before = await runtimeSnapshot(client);
    const processMemoryBefore = await processMemory(options.port);
    await beginFrameCapture(client);
    await sleep(options.durationMs);
    const frameSamples = await finishFrameCapture(client);
    const after = await runtimeSnapshot(client);
    const processMemoryAfter = await processMemory(options.port);
    const screenshot = await client.send("Page.captureScreenshot", {
      format: "png",
      fromSurface: true
    });
    const screenshotBytes = Buffer.from(screenshot.data, "base64");
    const screenshotSha256 = createHash("sha256")
      .update(screenshotBytes)
      .digest("hex");
    await writeFile(options.screenshot, screenshotBytes);
    const visualReference =
      options.referenceScreenshot === null
        ? null
        : await compareVisualReference(
            options.referenceScreenshot,
            screenshotBytes,
            screenshotSha256
          );

    const report = {
      metadata: {
        generatedAt: new Date().toISOString(),
        port: options.port,
        durationMs: options.durationMs,
        target: {
          id: target.id,
          title: target.title,
          url: target.url
        },
        profilerStartToTargetMs: ready.targetConnectedAt - startedAt,
        profilerStartToReadyMs: ready.readyAt - startedAt,
        candidateBundle
      },
      ready,
      before,
      after,
      frames: summarizeFrames(frameSamples),
      processMemoryBefore,
      processMemoryAfter,
      screenshot: {
        path: options.screenshot,
        bytes: screenshotBytes.byteLength,
        sha256: screenshotSha256
      },
      visualReference
    };
    await writeFile(options.output, `${JSON.stringify(report, null, 2)}\n`);
    console.log(
      JSON.stringify(
        {
          output: options.output,
          screenshot: options.screenshot,
          ready: report.ready,
          state: report.after.state,
          frames: report.frames,
          textures: report.after.textures,
          rendering: report.after.rendering,
          startup: report.after.startup,
          visualReference: report.visualReference,
          quality: report.after.quality,
          processMemory: report.processMemoryAfter
        },
        null,
        2
      )
    );
    if (visualReference !== null && !visualReference.matches) {
      throw new Error(
        `Visual reference mismatch: ${visualReference.referenceSha256} != ${visualReference.actualSha256}`
      );
    }
  } finally {
    client.close();
  }
}

function parseArgs(argv) {
  const values = {
    port: 9223,
    durationMs: 10_000,
    connectTimeoutMs: 30_000,
    readyTimeoutMs: 60_000,
    output: path.resolve("artifacts", "rendering-profile-latest.json"),
    screenshot: null,
    referenceScreenshot: null,
    candidateBundle: null
  };
  for (let index = 0; index < argv.length; index += 1) {
    const name = argv[index];
    const value = argv[index + 1];
    if (name === "--port" && value) {
      values.port = numberArg(name, argv[++index], 1, 65_535);
    } else if (name === "--duration" && value) {
      values.durationMs =
        numberArg(name, argv[++index], 1, 3_600) * 1_000;
    } else if (name === "--connect-timeout" && value) {
      values.connectTimeoutMs =
        numberArg(name, argv[++index], 1, 600) * 1_000;
    } else if (name === "--ready-timeout" && value) {
      values.readyTimeoutMs =
        numberArg(name, argv[++index], 1, 600) * 1_000;
    } else if (name === "--output" && value) {
      values.output = path.resolve(argv[++index]);
    } else if (name === "--screenshot" && value) {
      values.screenshot = path.resolve(argv[++index]);
    } else if (name === "--reference-screenshot" && value) {
      values.referenceScreenshot = path.resolve(argv[++index]);
    } else if (name === "--candidate-bundle" && value) {
      values.candidateBundle = path.resolve(argv[++index]);
    } else {
      throw new Error(`Unknown or incomplete option ${name}`);
    }
  }
  values.screenshot ??= values.output.replace(/\.json$/iu, "") + ".png";
  return values;
}

async function fileIdentity(filePath) {
  const bytes = await readFile(filePath);
  return {
    path: filePath,
    bytes: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex")
  };
}

async function compareVisualReference(
  referencePath,
  actualBytes,
  actualSha256
) {
  const referenceBytes = await readFile(referencePath);
  return {
    path: referencePath,
    referenceBytes: referenceBytes.byteLength,
    actualBytes: actualBytes.byteLength,
    referenceSha256: createHash("sha256")
      .update(referenceBytes)
      .digest("hex"),
    actualSha256,
    matches: referenceBytes.equals(actualBytes)
  };
}

function numberArg(name, value, minimum, maximum) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) {
    throw new RangeError(
      `${name} must be between ${minimum} and ${maximum}`
    );
  }
  return parsed;
}

async function waitForTarget(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then(
        (response) => response.json()
      );
      const target =
        targets.find(
          (entry) =>
            entry.type === "page" &&
            /index\.html(?:[?#]|$)/u.test(entry.url)
        ) ?? targets.find((entry) => entry.type === "page");
      if (target?.webSocketDebuggerUrl) {
        return target;
      }
    } catch (error) {
      lastError = error;
    }
    await sleep(50);
  }
  throw new Error(
    `No KD renderer appeared on port ${port}: ${errorMessage(lastError)}`
  );
}

async function waitForReady(client, timeoutMs) {
  const targetConnectedAt = Date.now();
  const deadline = targetConnectedAt + timeoutMs;
  let last = null;
  let lastProgress = null;
  let progressStableAt = targetConnectedAt;
  let transientEvaluationErrors = 0;
  let lastEvaluationError = null;
  while (Date.now() < deadline) {
    try {
      last = await evaluate(
        client,
        `(() => {
          const safe = (read, fallback = null) => {
            try {
              return read();
            } catch {
              return fallback;
            }
          };
          return {
            documentReady: document.readyState,
            visibilityState: document.visibilityState,
            hasFocus: document.hasFocus(),
            hasRenderer: !!globalThis.PIXIapp?.renderer,
            state: safe(
              () =>
                typeof KinkyDungeonState === "undefined"
                  ? null
                  : KinkyDungeonState
            ),
            loadingDone: safe(
              () =>
                typeof KDLoadingDone === "undefined" ? null : KDLoadingDone
            ),
            loadingFinished: safe(
              () =>
                typeof KDLoadingFinished === "undefined"
                  ? null
                  : KDLoadingFinished
            ),
            loadingMax: safe(
              () => (typeof KDLoadingMax === "undefined" ? null : KDLoadingMax)
            ),
            currentLoading: safe(
              () =>
                typeof CurrentLoading === "undefined" ? null : CurrentLoading
            ),
            performanceNow: performance.now(),
            timeOrigin: performance.timeOrigin
          };
        })()`
      );
    } catch (error) {
      transientEvaluationErrors += 1;
      lastEvaluationError = errorMessage(error);
      last = { evaluationError: lastEvaluationError };
      await sleep(25);
      continue;
    }
    const progress = JSON.stringify([
      last.state,
      last.loadingDone,
      last.loadingFinished,
      last.loadingMax,
      last.currentLoading
    ]);
    if (progress !== lastProgress) {
      lastProgress = progress;
      progressStableAt = Date.now();
    }
    const loadingComplete =
      last.loadingFinished === true &&
      typeof last.loadingDone === "number" &&
      typeof last.loadingMax === "number" &&
      last.loadingMax > 0 &&
      last.loadingDone >= last.loadingMax;
    const interactiveState = ["Intro", "Menu", "Game", "Stats"].includes(
      last.state
    );
    const interactiveAndStable =
      interactiveState && Date.now() - progressStableAt >= 750;
    if (
      last.documentReady !== "loading" &&
      last.hasRenderer &&
      last.state !== null &&
      (loadingComplete || interactiveAndStable)
    ) {
      return {
        ...last,
        targetConnectedAt,
        readyAt: Date.now(),
        transientEvaluationErrors,
        lastEvaluationError
      };
    }
    await sleep(25);
  }
  throw new Error(
    `KD renderer did not become ready: ${JSON.stringify(last)}`
  );
}

async function runtimeSnapshot(client) {
  return evaluate(
    client,
    `(() => {
      const safe = (read, fallback = null) => {
        try {
          return read();
        } catch {
          return fallback;
        }
      };
      const valuesOf = (value) => {
        if (value instanceof Map) return [...value.values()];
        if (Array.isArray(value)) return value;
        return value && typeof value === "object" ? Object.values(value) : [];
      };
      const bases = new Set();
      const visited = new Set();
      const visit = (value) => {
        if (!value || typeof value !== "object" || visited.has(value)) return;
        visited.add(value);
        if (value.baseTexture) bases.add(value.baseTexture);
        else if (value.resource && (value.realWidth || value.width)) bases.add(value);
        for (const child of valuesOf(value.textures)) visit(child);
        for (const child of valuesOf(value.linkedSheets)) visit(child);
      };
      for (const source of [
        globalThis.kdpixitex,
        globalThis.kdTexcache,
        globalThis.kdRTcache,
        globalThis.PIXI?.utils?.TextureCache,
        globalThis.PIXI?.utils?.BaseTextureCache,
        globalThis.PIXI?.TextureCache,
        globalThis.PIXI?.BaseTextureCache,
        globalThis.PIXI?.Assets?.cache?._cache,
        globalThis.PIXI?.Assets?.cache?._cacheMap
      ]) {
        for (const value of valuesOf(source)) visit(value);
      }
      let decodedTextureBytes = 0;
      let estimatedGpuTextureBytes = 0;
      const dimensions = {};
      for (const base of bases) {
        const source = base.resource?.source ?? {};
        const width = Number(
          base.realWidth || source.naturalWidth || source.videoWidth || base.width || 0
        );
        const height = Number(
          base.realHeight || source.naturalHeight || source.videoHeight || base.height || 0
        );
        if (!(width > 0 && height > 0)) continue;
        const bytes = width * height * 4;
        decodedTextureBytes += bytes;
        estimatedGpuTextureBytes +=
          base.mipmap === 0 || base.mipmap === undefined
            ? bytes
            : Math.ceil(bytes * 4 / 3);
        const key = width + "x" + height;
        dimensions[key] = (dimensions[key] || 0) + 1;
      }
      const renderer = globalThis.PIXIapp?.renderer ?? null;
      let screenPixelHash = null;
      if (renderer?.extract?.pixels) {
        const pixels = renderer.extract.pixels();
        let hash = 0x811c9dc5;
        for (let index = 0; index < pixels.length; index += 1) {
          hash ^= pixels[index];
          hash = Math.imul(hash, 0x01000193);
        }
        screenPixelHash = (hash >>> 0).toString(16).padStart(8, "0");
      }
      const navigation = performance.getEntriesByType("navigation")[0];
      return {
        capturedAt: new Date().toISOString(),
        state: {
          visibility: document.visibilityState,
          hasFocus: document.hasFocus(),
          screen: safe(
            () => (typeof CurrentScreen === "undefined" ? null : CurrentScreen)
          ),
          module: safe(
            () => (typeof CurrentModule === "undefined" ? null : CurrentModule)
          ),
          gameState: safe(
            () =>
              typeof KinkyDungeonState === "undefined"
                ? null
                : KinkyDungeonState
          ),
          drawState: safe(
            () =>
              typeof KinkyDungeonDrawState === "undefined"
                ? null
                : KinkyDungeonDrawState
          ),
          mobileTextures: safe(
            () =>
              typeof KDToggles === "undefined"
                ? null
                : !!KDToggles.MobileTextures
          ),
          canvas: (() => {
            const canvas = document.querySelector("canvas");
            return canvas
              ? {
                  width: canvas.width,
                  height: canvas.height,
                  clientWidth: canvas.clientWidth,
                  clientHeight: canvas.clientHeight
                }
              : null;
          })()
        },
        navigation: navigation
          ? {
              startTime: navigation.startTime,
              domContentLoadedEventEnd: navigation.domContentLoadedEventEnd,
              loadEventEnd: navigation.loadEventEnd,
              duration: navigation.duration,
              performanceNow: performance.now(),
              timeOrigin: performance.timeOrigin
            }
          : null,
        loading: {
          done: safe(
            () =>
              typeof KDLoadingDone === "undefined" ? null : KDLoadingDone
          ),
          finished: safe(
            () =>
              typeof KDLoadingFinished === "undefined"
                ? null
                : KDLoadingFinished
          ),
          max: safe(
            () => (typeof KDLoadingMax === "undefined" ? null : KDLoadingMax)
          ),
          current: safe(
            () =>
              typeof CurrentLoading === "undefined" ? null : CurrentLoading
          )
        },
        textures: {
          uniqueBaseTextures: bases.size,
          decodedTextureBytes,
          estimatedGpuTextureBytes,
          dimensions: Object.entries(dimensions).sort(
            (left, right) => right[1] - left[1]
          ),
          kdpixitex: globalThis.kdpixitex?.size ?? null,
          kdTexcache: globalThis.kdTexcache?.size ?? null,
          kdRTcache: globalThis.kdRTcache?.size ?? null
        },
        rendering: globalThis.KDHybridRendering?.status?.() ?? null,
        startup: globalThis.KDHybridStartup?.status?.() ?? null,
        bootstrapConfig: globalThis.KDHybridBootstrapConfig ?? null,
        quality: globalThis.KDHybrid?.status?.().quality ?? null,
        hybridStatus: globalThis.KDHybrid?.status?.() ?? null,
        heap: performance.memory
          ? {
              used: performance.memory.usedJSHeapSize,
              total: performance.memory.totalJSHeapSize,
              limit: performance.memory.jsHeapSizeLimit
            }
          : null,
        screenPixelHash
      };
    })()`
  );
}

async function beginFrameCapture(client) {
  await evaluate(
    client,
    `(() => {
      const previous = globalThis.__kdHybridRenderingFrameCapture;
      if (previous?.request) cancelAnimationFrame(previous.request);
      const capture = {
        previous: null,
        deltas: [],
        request: 0
      };
      const frame = (now) => {
        if (capture.previous !== null) capture.deltas.push(now - capture.previous);
        capture.previous = now;
        capture.request = requestAnimationFrame(frame);
      };
      capture.request = requestAnimationFrame(frame);
      globalThis.__kdHybridRenderingFrameCapture = capture;
      return true;
    })()`
  );
}

async function finishFrameCapture(client) {
  return evaluate(
    client,
    `(() => {
      const capture = globalThis.__kdHybridRenderingFrameCapture;
      if (!capture) return [];
      cancelAnimationFrame(capture.request);
      delete globalThis.__kdHybridRenderingFrameCapture;
      return capture.deltas;
    })()`
  );
}

function summarizeFrames(samples) {
  const values = samples.filter((value) => Number.isFinite(value) && value > 0);
  const sorted = [...values].sort((left, right) => left - right);
  const elapsedMs = values.reduce((total, value) => total + value, 0);
  return {
    count: values.length,
    elapsedMs,
    averageFps: elapsedMs === 0 ? null : (values.length * 1_000) / elapsedMs,
    p50Ms: percentile(sorted, 0.5),
    p95Ms: percentile(sorted, 0.95),
    p99Ms: percentile(sorted, 0.99),
    maximumMs: sorted.at(-1) ?? null,
    over16_7ms: values.filter((value) => value > 16.7).length,
    over33_3ms: values.filter((value) => value > 33.3).length
  };
}

function percentile(sorted, fraction) {
  if (sorted.length === 0) return null;
  return sorted[
    Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)
  ];
}

async function processMemory(port) {
  if (process.platform !== "win32") return null;
  const command = [
    "$rows = Get-CimInstance Win32_Process -Filter \"Name='KinkyDungeon.exe'\" | ForEach-Object {",
    "  $p = Get-Process -Id $_.ProcessId -ErrorAction SilentlyContinue",
    "  if ($p) { [pscustomobject]@{",
    "    id = $_.ProcessId; parentId = $_.ParentProcessId; commandLine = $_.CommandLine;",
    "    privateBytes = $p.PrivateMemorySize64; workingSetBytes = $p.WorkingSet64",
    "  } }",
    "}",
    "$rows | ConvertTo-Json -Compress"
  ].join("\n");
  try {
    const { stdout } = await execFileAsync(
      "powershell.exe",
      ["-NoProfile", "-Command", command],
      { maxBuffer: 4 * 1024 * 1024 }
    );
    const parsed = JSON.parse(stdout.trim() || "[]");
    const rows = Array.isArray(parsed) ? parsed : [parsed];
    const browser = rows.find(
      (row) =>
        !/--type=/u.test(row.commandLine ?? "") &&
        new RegExp(`--remote-debugging-port=${port}(?:\\s|$)`, "u").test(
          row.commandLine ?? ""
        )
    );
    if (!browser) return [];
    const ids = new Set([browser.id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const row of rows) {
        if (!ids.has(row.id) && ids.has(row.parentId)) {
          ids.add(row.id);
          changed = true;
        }
      }
    }
    return rows
      .filter((row) => ids.has(row.id))
      .map((row) => ({
        ...row,
        type: processType(row.commandLine ?? "")
      }))
      .sort((left, right) => left.id - right.id);
  } catch (error) {
    return { error: errorMessage(error) };
  }
}

function processType(commandLine) {
  if (/--type=gpu-process/u.test(commandLine)) return "gpu";
  if (/--type=renderer/u.test(commandLine)) {
    return /--first-renderer-process/u.test(commandLine)
      ? "game-renderer"
      : "renderer";
  }
  if (/--type=utility/u.test(commandLine)) return "utility";
  return "browser";
}

async function evaluate(client, expression) {
  const result = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true
  });
  if (result.exceptionDetails) {
    throw new Error(
      result.exceptionDetails.exception?.description ??
        result.exceptionDetails.text
    );
  }
  return result.result?.value;
}

class CdpClient {
  constructor(url) {
    this.url = url;
    this.socket = null;
    this.nextId = 1;
    this.pending = new Map();
  }

  async connect() {
    this.socket = new WebSocket(this.url);
    await new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(JSON.stringify(message.error)));
      else pending.resolve(message.result);
    });
    this.socket.addEventListener("close", () => {
      for (const pending of this.pending.values()) {
        pending.reject(new Error("CDP socket closed"));
      }
      this.pending.clear();
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.socket?.close();
  }
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

await main();
