// SPDX-License-Identifier: MIT
// Reproducible, byte-gated repairs; originals and saves are never modified.
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';

export function repairChastityArchive(bytes) {
  const hash = createHash('sha256').update(bytes).digest('hex');
  if (hash !== '9bcbb7d901760ebd689d49a32d8aec84265488fc223678378109b9da89370239') {
    throw new Error('Unsupported Chastity101 archive: ' + hash);
  }
  const entries = unzipSync(bytes);
  let source = strFromU8(entries['ChastityTree.ks']);
  // KD registers asset aliases under its current root directory, including in
  // Electron. Keep the loader and actual images unchanged.
  let paths = 0;
  source = source.replace(/src: KDModFiles\["(Items\/|Buffs\/buff\/|Spells\/|Bullets\/|Locks\/Chastity\.png)/g,
    (_, suffix) => { paths++; return 'src: KDModFiles[KinkyDungeonRootDirectory + "' + suffix; });
  if (paths !== 5) throw new Error('Chastity asset preload layout changed');
  // Preserve other mods' afterLoadGame callbacks (e.g. Spellblade/ToyBox).
  const needle = "KDEventMapGeneric['afterLoadGame'] = {\r\n    \"chastity101\": (e, data) => {";
  if (source.split(needle).length !== 2) throw new Error('Chastity event layout changed');
  source = source.replace(needle,
    "Object.assign(KDEventMapGeneric['afterLoadGame'], {\r\n    \"chastity101\": (e, data) => {");
  const ending = '    }\r\n  }\r\n\r\nKDLoadPerks()';
  if (source.split(ending).length !== 2) throw new Error('Chastity event terminator changed');
  source = source.replace(ending, '    }\r\n  });\r\n\r\nKDLoadPerks()');
  // The final spell image follows ChastityTree.ks in this legacy archive.
  // Defer preloading until KD has registered every asset alias.
  source = source.replace('// Load asset for Items', 'KDAddEvent(KDEventMapGeneric, "afterModSettingsLoad", "RustedKinksChastityAssets", () => {\r\n// Load asset for Items');
  source = source.replace('var ChasteMiscastAmount =', '});\r\n\r\nvar ChasteMiscastAmount =');
  entries['ChastityTree.ks'] = strToU8(source);
  return zipSync(entries, { level: 6, mtime: new Date('2026-01-01T00:00:00Z') });
}

export function repairCommunityArchive(bytes) {
  const hash = createHash('sha256').update(bytes).digest('hex');
  if (hash === '9bcbb7d901760ebd689d49a32d8aec84265488fc223678378109b9da89370239') return repairChastityArchive(bytes);
  const knownHashes = new Set([
    'c9ef89670db17cbad2a205437d989168e7f539f0918047c03e12e597082ba2b3',
    '8f3dec55654de0cc6f512ceb49ab8838fb20ad8e66e50cdf3c623435f7302331',
    'da3625a17fd67f914bc23591986820c4becd8288f5b7a04ba88de87d264dd1a5',
  ]);
  if (!knownHashes.has(hash)) throw new Error('Unsupported community archive: ' + hash);
  const entries = unzipSync(bytes);
  const recipes = {
    c9ef89670db17cbad2a205437d989168e7f539f0918047c03e12e597082ba2b3: {
      file: 'AppendixBondage.ks',
      from: 'PIXI.Assets.load(prefix + dataFile);',
      to: 'PIXI.Assets.load({ src: KDModFiles[KinkyDungeonRootDirectory + prefix + dataFile] || (KinkyDungeonRootDirectory + prefix + dataFile) });'
    },
    '8f3dec55654de0cc6f512ceb49ab8838fb20ad8e66e50cdf3c623435f7302331': {
      file: 'RikasCustomRestraintsGraphic.ks',
      from: /for \(let count = 0; count <= 2; count\+\+\) \{[\s\S]*?loadParser: 'modAtlasLoader'[\s\S]*?\n\}/.exec(strFromU8(entries['RikasCustomRestraintsGraphic.ks'] || new Uint8Array()))?.[0],
      to: 'KDAddEvent(KDEventMapGeneric, "afterModSettingsLoad", "RustedKinksRikaAtlases", async () => {\n  for (let count = 0; count <= 2; count++) {\n    const root = KinkyDungeonRootDirectory + "TextureAtlas/";\n    const data = await (await fetch(KDModFiles[root + "rika-" + count + ".json"])).json();\n    const texture = await PIXI.Texture.fromURL(KDModFiles[root + data.meta.image]);\n    const sheet = new PIXI.Spritesheet(texture.baseTexture, data);\n    await sheet.parse();\n  }\n});'
    }
  };
  recipes['da3625a17fd67f914bc23591986820c4becd8288f5b7a04ba88de87d264dd1a5'] = {
    file: 'KD_FirearmsArmory.ks',
    from: 'PIXI.Assets.load(resolved).catch((error) => {',
    to: 'if (!asset.endsWith(".png")) continue;\n              PIXI.Texture.fromURL(KDModFiles[resolved] || resolved).catch((error) => {'
  };
  const recipe = recipes[hash];
  if (!recipe) throw new Error('Unsupported community archive: ' + hash);
  let source = strFromU8(entries[recipe.file]);
  if (!recipe.from || source.split(recipe.from).length !== 2) throw new Error('Repair layout changed');
  source = source.replace(recipe.from, recipe.to);
  if (recipe.file === 'RikasCustomRestraintsGraphic.ks') {
    const block = /\{PreloadDisplacement\(\["DisplacementMaps\/[\s\S]*?CocoonErase\.png"\]\);\}/.exec(source)?.[0];
    if (!block) throw new Error('Rika displacement layout changed');
    const files = [...block.matchAll(/"(DisplacementMaps\/[^"\n]+)"/g)].map(match => match[1]);
    if (files.length !== 31) throw new Error('Rika displacement count changed');
    source = source.replace(block, 'KDAddEvent(KDEventMapGeneric, "afterModSettingsLoad", "RustedKinksRikaDisplacement", async () => {\n  const files = ' + JSON.stringify(files) + ';\n  KDLoadingMax += files.length;\n  for (const file of files) {\n    try {\n      const url = KDModFiles[KinkyDungeonRootDirectory + file];\n      if (!url) throw new Error("Missing Rika displacement: " + file);\n      KDModFiles[file] = url;\n      const texture = await PIXI.Texture.fromURL(url, { resourceOptions: { scale: DisplacementScale } });\n      PIXI.Texture.addToCache(texture, file);\n      CurrentLoading = "Loaded " + file;\n    } finally { KDLoadingDone++; }\n  }\n});');
  }
  if (recipe.file === 'KD_FirearmsArmory.ks') {
    const needle = '      if (typeof ForceRefreshModels === "function") ForceRefreshModels(npc);';
    if (source.split(needle).length !== 2) throw new Error('Armory appearance layout changed');
    source = source.replace(needle, '      for (const item of npc.Appearance || []) {\n        if (item.Model && !item.Model.Folder && ModelDefs[item.Model.Name]?.Folder) {\n          item.Model = { ...item.Model, Folder: ModelDefs[item.Model.Name].Folder };\n        }\n      }\n' + needle);
  }
  entries[recipe.file] = strToU8(source);
  const normalized = {};
  for (const [name, value] of Object.entries(entries)) {
    const key = name.replaceAll('\\', '/');
    if (key in normalized) throw new Error('Duplicate normalized archive path');
    normalized[key] = value;
  }
  return zipSync(normalized, { level: 6, mtime: new Date('2026-01-01T00:00:00Z') });
}

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  const [input, output] = process.argv.slice(2);
  if (!input || !output) throw new Error('Usage: node scripts/prepare-community-mods.mjs <original.zip> <new-output.zip>');
  if (path.resolve(input) === path.resolve(output)) throw new Error('Output must be separate from original');
  const result = repairCommunityArchive(await readFile(input));
  await mkdir(path.dirname(path.resolve(output)), { recursive: true });
  await writeFile(output, result, { flag: 'wx' });
  console.log(JSON.stringify({ output: path.resolve(output), sha256: createHash('sha256').update(result).digest('hex') }));
}
