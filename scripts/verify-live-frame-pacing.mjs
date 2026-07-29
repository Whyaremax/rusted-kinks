#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const target = await waitForTarget(options.port, options.connectTimeoutMs);
  const candidateBundle = await fileIdentity(options.candidateBundle);
  const client = new CdpClient(target.webSocketDebuggerUrl);
  await client.connect();

  try {
    await client.send("Runtime.enable");
    await client.send("Page.enable");
    await client.send("Page.bringToFront");
    await waitForReady(client, options.readyTimeoutMs);
    const proof = await evaluate(
      client,
      `(${runLiveProof.toString()})(${JSON.stringify(options.durationMs)})`
    );
    const checks = acceptanceChecks(proof);
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
        candidateBundle
      },
      proof,
      acceptance: {
        passed: Object.values(checks).every(Boolean),
        checks
      }
    };
    await writeFile(options.output, `${JSON.stringify(report, null, 2)}\n`);
    console.log(
      JSON.stringify(
        {
          output: options.output,
          candidateBundle,
          scene: proof.scene,
          commandPhases: proof.commandPhases,
          commandReduction: proof.commandReduction,
          activity: proof.activity,
          pixels: proof.pixels,
          renderTexture: proof.renderTexture,
          acceptance: report.acceptance
        },
        null,
        2
      )
    );
    if (!report.acceptance.passed) {
      throw new Error("Live frame-pacing acceptance checks failed");
    }
  } finally {
    client.close();
  }
}

function parseArgs(argv) {
  const values = {
    port: 9223,
    durationMs: 5_000,
    connectTimeoutMs: 30_000,
    readyTimeoutMs: 60_000,
    output: path.resolve(
      "artifacts",
      "gpu-frame-pacing-live-proof-latest.json"
    ),
    candidateBundle: path.resolve(
      "dist",
      "bootstrap",
      "kd-hybrid-bootstrap.js"
    )
  };
  for (let index = 0; index < argv.length; index += 1) {
    const name = argv[index];
    const value = argv[index + 1];
    if (name === "--port" && value) {
      values.port = numberArg(name, argv[++index], 1, 65_535);
    } else if (name === "--duration" && value) {
      values.durationMs =
        numberArg(name, argv[++index], 1, 60) * 1_000;
    } else if (name === "--connect-timeout" && value) {
      values.connectTimeoutMs =
        numberArg(name, argv[++index], 1, 600) * 1_000;
    } else if (name === "--ready-timeout" && value) {
      values.readyTimeoutMs =
        numberArg(name, argv[++index], 1, 600) * 1_000;
    } else if (name === "--output" && value) {
      values.output = path.resolve(argv[++index]);
    } else if (name === "--candidate-bundle" && value) {
      values.candidateBundle = path.resolve(argv[++index]);
    } else {
      throw new Error(`Unknown or incomplete option ${name}`);
    }
  }
  return values;
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

async function fileIdentity(filePath) {
  const bytes = await readFile(filePath);
  return {
    path: filePath,
    bytes: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex")
  };
}

async function waitForTarget(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json`);
      if (!response.ok) {
        throw new Error(`CDP target list returned HTTP ${response.status}`);
      }
      const targets = await response.json();
      const target =
        targets.find(
          (candidate) =>
            candidate.type === "page" &&
            String(candidate.url).includes("index.html")
        ) ??
        targets.find(
          (candidate) =>
            candidate.type === "page" &&
            !String(candidate.url).startsWith("devtools://")
        );
      if (target?.webSocketDebuggerUrl) {
        return target;
      }
      lastError = new Error("No game page target is available");
    } catch (error) {
      lastError = error;
    }
    await sleep(250);
  }
  throw new Error(
    `Timed out waiting for CDP port ${port}: ${errorMessage(lastError)}`
  );
}

async function waitForReady(client, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    last = await evaluate(
      client,
      `(() => ({
        loadingDone:
          typeof KDLoadingDone === "undefined" ? null : KDLoadingDone,
        loadingFinished:
          typeof KDLoadingFinished === "undefined"
            ? null
            : KDLoadingFinished,
        loadingMax:
          typeof KDLoadingMax === "undefined" ? null : KDLoadingMax,
        hasRenderer:
          typeof PIXIapp !== "undefined" &&
          !!PIXIapp?.renderer &&
          !!PIXIapp?.stage,
        pacing: globalThis.KDHybridFramePacing?.status?.() ?? null
      }))()`
    );
    if (
      last?.loadingFinished === true &&
      (last?.loadingDone === true ||
        (typeof last?.loadingDone === "number" &&
          typeof last?.loadingMax === "number" &&
          last.loadingDone >= last.loadingMax)) &&
      last?.hasRenderer === true &&
      last?.pacing?.installed === true
    ) {
      return last;
    }
    await sleep(250);
  }
  throw new Error(
    `Timed out waiting for live frame-pacing readiness: ${JSON.stringify(last)}`
  );
}

function runLiveProof(durationMs) {
  const sleep = (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds));
  const safe = (callback, fallback = null) => {
    try {
      return callback();
    } catch {
      return fallback;
    }
  };
  const pacingDelta = (after, before) => ({
    stageCalls: after.stageCalls - before.stageCalls,
    rendered: after.renderedStageCalls - before.renderedStageCalls,
    skipped: after.skippedStageCalls - before.skippedStageCalls,
    bypassed: after.bypassedStageCalls - before.bypassedStageCalls,
    other: after.otherRenderCalls - before.otherRenderCalls
  });
  const frameSummary = (values) => {
    const valid = values.filter(
      (value) => Number.isFinite(value) && value > 0
    );
    const sorted = [...valid].sort((left, right) => left - right);
    const elapsedMs = valid.reduce((total, value) => total + value, 0);
    const percentile = (fraction) =>
      sorted.length === 0
        ? null
        : sorted[
            Math.min(
              sorted.length - 1,
              Math.ceil(sorted.length * fraction) - 1
            )
          ];
    return {
      count: valid.length,
      elapsedMs,
      averageFps:
        elapsedMs === 0 ? null : (valid.length * 1_000) / elapsedMs,
      p50Ms: percentile(0.5),
      p95Ms: percentile(0.95),
      p99Ms: percentile(0.99),
      maximumMs: sorted.at(-1) ?? null,
      over16_7ms: valid.filter((value) => value > 16.7).length,
      over33_3ms: valid.filter((value) => value > 33.3).length
    };
  };
  const comparePixels = (left, right) => {
    if (left.length !== right.length) {
      return {
        exact: false,
        differentBytes: Math.max(left.length, right.length),
        absoluteDifference: null,
        maximumDifference: null
      };
    }
    let differentBytes = 0;
    let absoluteDifference = 0;
    let maximumDifference = 0;
    for (let index = 0; index < left.length; index += 1) {
      const difference = Math.abs(left[index] - right[index]);
      if (difference !== 0) {
        differentBytes += 1;
      }
      absoluteDifference += difference;
      maximumDifference = Math.max(maximumDifference, difference);
    }
    return {
      exact: differentBytes === 0,
      differentBytes,
      absoluteDifference,
      maximumDifference
    };
  };
  const pixelHash = (bytes) => {
    let hash = 0x811c9dc5;
    for (const value of bytes) {
      hash ^= value;
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  };
  const app = globalThis.PIXIapp;
  const renderer = app?.renderer;
  const stage = app?.stage;
  const gl = renderer?.gl;
  const pacing = globalThis.KDHybridFramePacing;
  if (!app || !renderer || !stage || !gl || !pacing) {
    throw new Error("PIXI application or frame-pacing API is unavailable");
  }
  globalThis.KDHybridRuntimeControl ??= {};
  const control = globalThis.KDHybridRuntimeControl;
  const hadDisable = Object.hasOwn(
    control,
    "disableGpuFramePacing"
  );
  const priorDisable = control.disableGpuFramePacing;
  const statusBefore = pacing.status();
  const scene = {
    gameVersion: safe(() => KinkyDungeonVersion),
    pixiVersion: safe(() => PIXI.VERSION),
    state: safe(() => KinkyDungeonState),
    drawState: safe(() => KinkyDungeonDrawState),
    mapWidth: safe(() => KDMapData.GridWidth),
    mapHeight: safe(() => KDMapData.GridHeight),
    entities: safe(() => KDMapData.Entities.length),
    canvas: {
      width: renderer.screen.width,
      height: renderer.screen.height
    }
  };
  const commandNames = [
    "drawElements",
    "drawArrays",
    "drawElementsInstanced",
    "drawArraysInstanced",
    "clear",
    "flush",
    "finish"
  ];
  const originals = new Map();
  const commandCounts = {
    control: Object.create(null),
    candidate: Object.create(null)
  };
  let commandPhase = null;

  const runCommandPhase = async (name) => {
    const before = pacing.status();
    const frameDeltas = [];
    let previousFrame = null;
    let frameRequest = 0;
    const frame = (now) => {
      if (previousFrame !== null) {
        frameDeltas.push(now - previousFrame);
      }
      previousFrame = now;
      frameRequest = requestAnimationFrame(frame);
    };
    frameRequest = requestAnimationFrame(frame);
    commandPhase = name;
    const startedAt = performance.now();
    try {
      await sleep(durationMs);
    } finally {
      commandPhase = null;
      cancelAnimationFrame(frameRequest);
    }
    const elapsedMs = performance.now() - startedAt;
    const after = pacing.status();
    return {
      elapsedMs,
      commands: commandCounts[name],
      pacing: pacingDelta(after, before),
      frames: frameSummary(frameDeltas)
    };
  };

  return (async () => {
    try {
      for (const name of commandNames) {
        if (typeof gl[name] !== "function") {
          continue;
        }
        originals.set(name, {
          value: gl[name],
          own: Object.getOwnPropertyDescriptor(gl, name)
        });
        gl[name] = function KDHybridGpuProofCommand(...args) {
          if (commandPhase !== null) {
            const counts = commandCounts[commandPhase];
            counts[name] = (counts[name] ?? 0) + 1;
          }
          return Reflect.apply(originals.get(name).value, this, args);
        };
      }

      control.disableGpuFramePacing = true;
      await sleep(250);
      const controlPhase = await runCommandPhase("control");
      control.disableGpuFramePacing = false;
      await sleep(250);
      const candidatePhase = await runCommandPhase("candidate");

      commandPhase = null;
      for (const [name, original] of originals) {
        if (original.own === undefined) {
          delete gl[name];
        } else {
          Object.defineProperty(gl, name, original.own);
        }
      }
      originals.clear();

      await sleep(1_100);
      const idleBefore = pacing.status();
      await sleep(600);
      const idleAfter = pacing.status();
      window.dispatchEvent(
        new PointerEvent("pointermove", {
          clientX: Math.round(renderer.screen.width / 2),
          clientY: Math.round(renderer.screen.height / 2)
        })
      );
      const activityStamp = pacing.status().lastActivityAtMs;
      const activeBefore = pacing.status();
      await sleep(600);
      const activeAfter = pacing.status();
      await sleep(700);
      const resumedIdleBefore = pacing.status();
      await sleep(600);
      const resumedIdleAfter = pacing.status();
      const activity = {
        eventUpdatedActivityStamp:
          activityStamp !== null &&
          idleAfter.lastActivityAtMs !== null &&
          activityStamp > idleAfter.lastActivityAtMs,
        idle: pacingDelta(idleAfter, idleBefore),
        active: pacingDelta(activeAfter, activeBefore),
        resumedIdle: pacingDelta(resumedIdleAfter, resumedIdleBefore),
        activeProfile: activeAfter.currentProfile,
        resumedIdleProfile: resumedIdleAfter.currentProfile
      };

      const tickerWasStarted = app.ticker?.started === true;
      let renderTexture;
      let pixels;
      let renderTextureProof;
      let skippedStageCall;
      try {
        app.ticker?.stop();
        renderTexture = PIXI.RenderTexture.create({
          width: renderer.screen.width,
          height: renderer.screen.height,
          resolution: 1
        });
        const copyPixels = () =>
          new Uint8Array(renderer.extract.pixels(renderTexture));

        control.disableGpuFramePacing = true;
        renderer.render(stage, { renderTexture, clear: true });
        const controlA = copyPixels();
        renderer.render(stage, { renderTexture, clear: true });
        const controlB = copyPixels();

        control.disableGpuFramePacing = false;
        pacing.notifyActivity();
        renderer.render(stage, { renderTexture, clear: true });
        const candidate = copyPixels();
        pixels = {
          byteLength: controlA.length,
          controlHash: pixelHash(controlB),
          candidateHash: pixelHash(candidate),
          controlRepeat: comparePixels(controlA, controlB),
          controlVsCandidate: comparePixels(controlB, candidate)
        };

        await sleep(1_100);
        renderer.render(stage, { renderTexture, clear: true });
        const beforeSkipped = pacing.status();
        renderer.render(stage, { renderTexture, clear: true });
        const afterSkipped = pacing.status();
        skippedStageCall = pacingDelta(afterSkipped, beforeSkipped);

        const otherBefore = pacing.status().otherRenderCalls;
        const smallTexture = PIXI.RenderTexture.create({
          width: 16,
          height: 16
        });
        const container = new PIXI.Container();
        const graphic = new PIXI.Graphics();
        graphic
          .beginFill(0xff3366, 1)
          .drawRect(0, 0, 16, 16)
          .endFill();
        container.addChild(graphic);
        let smallPixels;
        try {
          renderer.render(container, {
            renderTexture: smallTexture,
            clear: true
          });
          smallPixels = new Uint8Array(
            renderer.extract.pixels(smallTexture)
          );
        } finally {
          container.destroy({ children: true });
          smallTexture.destroy(true);
        }
        let nonZeroBytes = 0;
        for (const value of smallPixels) {
          if (value !== 0) {
            nonZeroBytes += 1;
          }
        }
        renderTextureProof = {
          otherRenderCallsDelta:
            pacing.status().otherRenderCalls - otherBefore,
          byteLength: smallPixels.length,
          nonZeroBytes,
          populated: nonZeroBytes > 0
        };
      } finally {
        renderTexture?.destroy(true);
        if (tickerWasStarted) {
          app.ticker?.start();
        }
      }

      const commandReduction = {};
      for (const name of commandNames) {
        const official = controlPhase.commands[name] ?? 0;
        const candidate = candidatePhase.commands[name] ?? 0;
        if (official > 0) {
          commandReduction[name] = 1 - candidate / official;
        }
      }
      return {
        scene,
        statusBefore,
        commandPhases: {
          control: controlPhase,
          candidate: candidatePhase
        },
        commandReduction,
        activity,
        pixels,
        skippedStageCall,
        renderTexture: renderTextureProof,
        statusAfter: pacing.status()
      };
    } finally {
      commandPhase = null;
      for (const [name, original] of originals) {
        if (original.own === undefined) {
          delete gl[name];
        } else {
          Object.defineProperty(gl, name, original.own);
        }
      }
      if (hadDisable) {
        control.disableGpuFramePacing = priorDisable;
      } else {
        delete control.disableGpuFramePacing;
      }
    }
  })();
}

function acceptanceChecks(proof) {
  const control = proof.commandPhases.control;
  const candidate = proof.commandPhases.candidate;
  const ratio = (numerator, denominator) =>
    denominator > 0 ? numerator / denominator : Number.NaN;
  const nearHalf = (name) => {
    const official = control.commands[name] ?? 0;
    const optimized = candidate.commands[name] ?? 0;
    const retained = ratio(optimized, official);
    return official > 0 && retained >= 0.45 && retained <= 0.55;
  };
  const idleRatio = (sample) =>
    ratio(sample.rendered, sample.stageCalls);
  return {
    exactBuildGate:
      proof.statusAfter.compatible === true &&
      proof.statusAfter.installed === true &&
      proof.statusAfter.compatibilityReason ===
        "exact-kd-bundle-pixi-match",
    rendererStillOwned: proof.statusAfter.rendererReplaced === false,
    noRuntimeError: proof.statusAfter.lastError === null,
    drawElementsHalved: nearHalf("drawElements"),
    clearsHalved: nearHalf("clear"),
    flushesHalved: nearHalf("flush"),
    controlFullyBypassed:
      control.pacing.stageCalls > 0 &&
      control.pacing.bypassed === control.pacing.stageCalls,
    candidateNeverBypassed:
      candidate.pacing.stageCalls > 0 &&
      candidate.pacing.bypassed === 0,
    simulationCadencePreserved:
      candidate.frames.averageFps >= 110 &&
      candidate.frames.p99Ms <= 16.7,
    activityEventObserved:
      proof.activity.eventUpdatedActivityStamp === true,
    interactionRunsFullRate:
      proof.activity.active.stageCalls > 0 &&
      proof.activity.active.rendered === proof.activity.active.stageCalls &&
      proof.activity.active.skipped === 0 &&
      proof.activity.activeProfile === "active",
    idleReturnsToHalfRate:
      proof.activity.idle.stageCalls > 0 &&
      idleRatio(proof.activity.idle) >= 0.45 &&
      idleRatio(proof.activity.idle) <= 0.55,
    idleResumesAfterActivity:
      proof.activity.resumedIdle.stageCalls > 0 &&
      idleRatio(proof.activity.resumedIdle) >= 0.45 &&
      idleRatio(proof.activity.resumedIdle) <= 0.55 &&
      proof.activity.resumedIdleProfile === "idle",
    exactControlRepeat: proof.pixels.controlRepeat.exact === true,
    exactCandidatePixels: proof.pixels.controlVsCandidate.exact === true,
    immediateSecondStageCallSkipped:
      proof.skippedStageCall.stageCalls === 1 &&
      proof.skippedStageCall.skipped === 1 &&
      proof.skippedStageCall.rendered === 0,
    renderTexturesBypassPacing:
      proof.renderTexture.otherRenderCallsDelta === 1 &&
      proof.renderTexture.populated === true
  };
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
      if (!pending) {
        return;
      }
      this.pending.delete(message.id);
      if (message.error) {
        pending.reject(new Error(JSON.stringify(message.error)));
      } else {
        pending.resolve(message.result);
      }
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
