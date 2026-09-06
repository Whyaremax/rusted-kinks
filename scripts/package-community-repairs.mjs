// SPDX-License-Identifier: MIT
import { build } from 'esbuild';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { zipSync, strToU8 } from 'fflate';
const output = path.resolve(process.argv[2] || 'artifacts/RustedKinks-Community-Repairs-0.1.0.zip');
const bundle = await build({ entryPoints: ['scripts/prepare-community-mods.mjs'], bundle: true, platform: 'node', format: 'esm', target: 'node22', write: false, legalComments: 'inline' });
const entries = {
  'repair-community-mod.mjs': bundle.outputFiles[0].contents,
  'README.md': new Uint8Array(await readFile('docs/COMMUNITY_MOD_REPAIRS.md')),
  'LICENSE.txt': new Uint8Array(await readFile('LICENSE')),
  'FFLATE-LICENSE.txt': new Uint8Array(await readFile('node_modules/fflate/LICENSE')),
};
await mkdir(path.dirname(output), { recursive: true });
const zip = zipSync(entries, { level: 9, mtime: new Date('2026-01-01T00:00:00Z') });
await writeFile(output, zip);
console.log(JSON.stringify({ output, bytes: zip.length }));
