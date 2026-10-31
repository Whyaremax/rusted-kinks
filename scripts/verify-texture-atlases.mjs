#!/usr/bin/env node

import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const GROUPS = ["", "A", "B", "C", "D", "E"];
const LOGICAL_SOURCE_TOLERANCE = 2;
const PACKER_EDGE_TOLERANCE = 3;

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const atlasRoot = path.resolve(options.appRoot, "TextureAtlas");
  const groups = [];
  const bundle = await readFile(path.join(options.appRoot, "out/main.js"), "utf8");
  const activeModelLayout = bundle.includes('"TextureAtlas/models_0000.json"') &&
    bundle.includes('"TextureAtlas/models_mobile_0000.json"');
  let sharedAtlasDecodedBytes = 0;
  const sharedAtlases = [];

  if (activeModelLayout) {
    const full = await readAtlasFamily(atlasRoot, "models_0000.json", true);
    const mobile = await readAtlasFamily(atlasRoot, "models_mobile_0000.json", true);
    groups.push(compareFamilies("models", full, mobile));
    for (const name of ["game_0000.json", "displacement_0000.json"]) {
      const family = await readAtlasFamily(atlasRoot, name, true);
      sharedAtlasDecodedBytes += family.decodedBytes;
      sharedAtlases.push({root: name, pages: family.pages, frameCount: family.frames.size, decodedBytes: family.decodedBytes});
    }
  } else for (const suffix of GROUPS) {
    const full = await readAtlasFamily(atlasRoot, `atlas${suffix}0.json`);
    const mobile = await readAtlasFamily(
      atlasRoot,
      `atlasmobile${suffix}0.json`
    );
    groups.push(compareFamilies(suffix || "base", full, mobile));
  }

  const totals = groups.reduce(
    (result, group) => ({
      frameCount: result.frameCount + group.frameCount,
      fullPages: result.fullPages + group.full.pages,
      mobilePages: result.mobilePages + group.mobile.pages,
      fullDecodedBytes:
        result.fullDecodedBytes + group.full.decodedBytes,
      mobileDecodedBytes:
        result.mobileDecodedBytes + group.mobile.decodedBytes
    }),
    {
      frameCount: 0,
      fullPages: 0,
      mobilePages: 0,
      fullDecodedBytes: 0,
      mobileDecodedBytes: 0
    }
  );
  const report = {
    schema: 1,
    generatedAt: new Date().toISOString(),
    appRoot: options.appRoot,
    atlasRoot,
    activeLayout: activeModelLayout ? "game-models-displacement" : "legacy-six-families",
    sharedAtlases,
    logicalSourceTolerance: LOGICAL_SOURCE_TOLERANCE,
    packerEdgeTolerance: PACKER_EDGE_TOLERANCE,
    groups,
    totals: {
      ...totals,
      ...(activeModelLayout ? {
        sharedAtlasDecodedBytes,
        activeStartupFullDecodedBytes: totals.fullDecodedBytes + sharedAtlasDecodedBytes,
        activeStartupMobileDecodedBytes: totals.mobileDecodedBytes + sharedAtlasDecodedBytes,
        activeStartupDecodedReductionRatio: 1 - (totals.mobileDecodedBytes + sharedAtlasDecodedBytes) / (totals.fullDecodedBytes + sharedAtlasDecodedBytes)
      } : {}),
      decodedBytesSaved:
        totals.fullDecodedBytes - totals.mobileDecodedBytes,
      decodedReductionRatio:
        totals.fullDecodedBytes === 0
          ? null
          : 1 - totals.mobileDecodedBytes / totals.fullDecodedBytes
    },
    verdict: "pass"
  };

  if (options.output !== null) {
    await writeFile(options.output, `${JSON.stringify(report, null, 2)}\n`);
  }
  console.log(JSON.stringify(report, null, 2));
}

function parseArgs(argv) {
  const values = {
    appRoot: path.resolve("..", "..", "resources", "app"),
    output: null
  };
  for (let index = 0; index < argv.length; index += 1) {
    const name = argv[index];
    const value = argv[index + 1];
    if (name === "--app-root" && value) {
      values.appRoot = path.resolve(argv[++index]);
    } else if (name === "--output" && value) {
      values.output = path.resolve(argv[++index]);
    } else {
      throw new Error(`Unknown or incomplete option ${name}`);
    }
  }
  return values;
}

async function readAtlasFamily(atlasRoot, rootName, allowMissingSourceFingerprint = false) {
  const root = await readManifest(atlasRoot, rootName);
  const related = root.json.meta?.related_multi_packs ?? [];
  if (
    !Array.isArray(related) ||
    related.some((entry) => typeof entry !== "string")
  ) {
    throw new Error(`${rootName} has an invalid related_multi_packs list`);
  }
  const names = [rootName, ...related];
  if (new Set(names).size !== names.length) {
    throw new Error(`${rootName} repeats a related atlas manifest`);
  }
  const scale = Number(root.json.meta?.scale);
  if (!Number.isFinite(scale) || scale <= 0) {
    throw new Error(`${rootName} has an invalid scale`);
  }
  const sourceFingerprint = allowMissingSourceFingerprint && root.json.meta?.smartupdate === undefined ? null : smartUpdateSourceFingerprint(
    root.json.meta?.smartupdate,
    rootName
  );
  const manifests = await Promise.all(
    names.map((name) => readManifest(atlasRoot, name))
  );
  const frames = new Map();
  let decodedBytes = 0;
  for (const manifest of manifests) {
    if (Number(manifest.json.meta?.scale) !== scale) {
      throw new Error(`${manifest.name} has a different family scale`);
    }
    if (
      (allowMissingSourceFingerprint && manifest.json.meta?.smartupdate === undefined ? null : smartUpdateSourceFingerprint(
        manifest.json.meta?.smartupdate,
        manifest.name
      )) !== sourceFingerprint
    ) {
      throw new Error(`${manifest.name} has a different source fingerprint`);
    }
    const size = manifest.json.meta?.size;
    const width = positiveInteger(size?.w, `${manifest.name} meta.size.w`);
    const height = positiveInteger(size?.h, `${manifest.name} meta.size.h`);
    const decodedPageBytes = width * height * 4;
    if (!Number.isSafeInteger(decodedPageBytes)) {
      throw new Error(`${manifest.name} decoded byte count is unsafe`);
    }
    decodedBytes += decodedPageBytes;
    const imageName = manifest.json.meta?.image;
    if (typeof imageName !== "string") {
      throw new Error(`${manifest.name} has no meta.image`);
    }
    await assertFamilyFile(atlasRoot, imageName);

    const entries = Object.entries(manifest.json.frames ?? {});
    for (const [frameName, frame] of entries) {
      if (frames.has(frameName)) {
        throw new Error(`${rootName} repeats frame ${frameName}`);
      }
      validateFrame(frameName, frame, manifest.name, width, height, allowMissingSourceFingerprint);
      frames.set(frameName, frame);
    }
  }

  return {
    rootName,
    pages: manifests.length,
    decodedBytes,
    scale,
    sourceFingerprint,
    frames
  };
}

async function readManifest(atlasRoot, name) {
  const filePath = await assertFamilyFile(atlasRoot, name);
  const json = JSON.parse(await readFile(filePath, "utf8"));
  return { name, json };
}

async function assertFamilyFile(atlasRoot, name) {
  if (path.basename(name) !== name) {
    throw new Error(`Atlas family contains an unsafe path: ${name}`);
  }
  const filePath = path.join(atlasRoot, name);
  const details = await stat(filePath);
  if (!details.isFile()) {
    throw new Error(`Atlas family entry is not a file: ${filePath}`);
  }
  return filePath;
}

function compareFamilies(group, full, mobile) {
  if (full.sourceFingerprint !== mobile.sourceFingerprint) {
    throw new Error(
      `${group} full/mobile atlases have different source fingerprints`
    );
  }
  if (full.scale !== 0.5 || mobile.scale !== 0.25) {
    throw new Error(
      `${group} expected full/mobile scales 0.5/0.25, got ${full.scale}/${mobile.scale}`
    );
  }

  const missing = [...full.frames.keys()].filter(
    (name) => !mobile.frames.has(name)
  );
  const extra = [...mobile.frames.keys()].filter(
    (name) => !full.frames.has(name)
  );
  if (missing.length > 0 || extra.length > 0) {
    throw new Error(
      `${group} atlas coverage differs: ${missing.length} missing, ${extra.length} extra`
    );
  }

  let maximumLogicalSourceDelta = 0;
  let trimmedFlagDifferences = 0;
  let emptyPlaceholders = 0;
  for (const [name, fullFrame] of full.frames) {
    const mobileFrame = mobile.frames.get(name);
    if (mobileFrame === undefined) {
      throw new Error(`${group} mobile atlas is missing ${name}`);
    }
    const fullEmpty = fullFrame.frame.w === 0 && fullFrame.frame.h === 0;
    const mobileEmpty = mobileFrame.frame.w === 0 && mobileFrame.frame.h === 0;
    if (fullEmpty !== mobileEmpty) throw new Error(`${group} blank-frame coverage differs for ${name}`);
    if (fullEmpty) emptyPlaceholders += 1;
    if (fullFrame.rotated !== mobileFrame.rotated) {
      throw new Error(`${group} rotation differs for ${name}`);
    }
    if (fullFrame.trimmed !== mobileFrame.trimmed) {
      trimmedFlagDifferences += 1;
    }
    for (const dimension of ["w", "h"]) {
      const fullLogical =
        fullFrame.sourceSize[dimension] / full.scale;
      const mobileLogical =
        mobileFrame.sourceSize[dimension] / mobile.scale;
      const delta = Math.abs(fullLogical - mobileLogical);
      maximumLogicalSourceDelta = Math.max(
        maximumLogicalSourceDelta,
        delta
      );
      if (delta > LOGICAL_SOURCE_TOLERANCE) {
        throw new Error(
          `${group} logical source ${dimension} differs for ${name}: ${fullLogical} vs ${mobileLogical}`
        );
      }
    }
  }

  return {
    group,
    sourceFingerprint: full.sourceFingerprint,
    frameCount: full.frames.size,
    emptyPlaceholders,
    maximumLogicalSourceDelta,
    trimmedFlagDifferences,
    full: {
      root: full.rootName,
      scale: full.scale,
      pages: full.pages,
      decodedBytes: full.decodedBytes
    },
    mobile: {
      root: mobile.rootName,
      scale: mobile.scale,
      pages: mobile.pages,
      decodedBytes: mobile.decodedBytes
    }
  };
}

function validateFrame(name, value, manifestName, pageWidth, pageHeight, allowEmptyPlaceholder = false) {
  if (typeof value !== "object" || value === null) {
    throw new Error(`${manifestName} has an invalid frame ${name}`);
  }
  for (const field of ["frame", "spriteSourceSize", "sourceSize"]) {
    if (typeof value[field] !== "object" || value[field] === null) {
      throw new Error(`${manifestName} frame ${name} has no ${field}`);
    }
  }
  const frameX = nonNegativeInteger(
    value.frame.x,
    `${manifestName} ${name} frame.x`
  );
  const frameY = nonNegativeInteger(
    value.frame.y,
    `${manifestName} ${name} frame.y`
  );
  const emptyPlaceholder = allowEmptyPlaceholder && value.trimmed === true &&
    value.frame.w === 0 && value.frame.h === 0 &&
    value.spriteSourceSize.x === 0 && value.spriteSourceSize.y === 0 &&
    value.spriteSourceSize.w === 0 && value.spriteSourceSize.h === 0;
  const packedDimension = emptyPlaceholder ? nonNegativeInteger : positiveInteger;
  const frameWidth = packedDimension(
    value.frame.w,
    `${manifestName} ${name} frame.w`
  );
  const frameHeight = packedDimension(
    value.frame.h,
    `${manifestName} ${name} frame.h`
  );
  if (frameX + frameWidth > pageWidth || frameY + frameHeight > pageHeight) {
    throw new Error(`${manifestName} frame ${name} exceeds its atlas page`);
  }
  const sourceWidth = nonNegativeInteger(
    value.sourceSize.w,
    `${manifestName} ${name} sourceSize.w`
  );
  const sourceHeight = nonNegativeInteger(
    value.sourceSize.h,
    `${manifestName} ${name} sourceSize.h`
  );
  const spriteX = nonNegativeInteger(
    value.spriteSourceSize.x,
    `${manifestName} ${name} spriteSourceSize.x`
  );
  const spriteY = nonNegativeInteger(
    value.spriteSourceSize.y,
    `${manifestName} ${name} spriteSourceSize.y`
  );
  const spriteWidth = packedDimension(
    value.spriteSourceSize.w,
    `${manifestName} ${name} spriteSourceSize.w`
  );
  const spriteHeight = packedDimension(
    value.spriteSourceSize.h,
    `${manifestName} ${name} spriteSourceSize.h`
  );
  const sourceIsPlaceholder = sourceWidth === 0 || sourceHeight === 0;
  if (
    sourceIsPlaceholder && !emptyPlaceholder &&
    !(
      sourceWidth === 0 &&
      sourceHeight === 0 &&
      spriteX === 0 &&
      spriteY === 0 &&
      spriteWidth <= PACKER_EDGE_TOLERANCE &&
      spriteHeight <= PACKER_EDGE_TOLERANCE
    )
  ) {
    throw new Error(
      `${manifestName} frame ${name} has an invalid zero-size placeholder`
    );
  }
  if (
    !sourceIsPlaceholder &&
    (spriteX + spriteWidth > sourceWidth + PACKER_EDGE_TOLERANCE ||
      spriteY + spriteHeight > sourceHeight + PACKER_EDGE_TOLERANCE)
  ) {
    throw new Error(
      `${manifestName} frame ${name} exceeds its logical source bounds`
    );
  }
}

function smartUpdateSourceFingerprint(value, manifestName) {
  if (typeof value !== "string") {
    throw new Error(`${manifestName} has no smartupdate fingerprint`);
  }
  const parts = value.split(":");
  const fingerprint = parts[3];
  if (!/^[a-f0-9]{32}$/u.test(fingerprint ?? "")) {
    throw new Error(`${manifestName} has an invalid source fingerprint`);
  }
  return fingerprint;
}

function positiveInteger(value, label) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
  return value;
}

function nonNegativeInteger(value, label) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
  return value;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
