// SPDX-License-Identifier: MIT
// Run against local author archives; no third-party source is bundled here.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import path from 'node:path';
import { unzipSync, strFromU8 } from 'fflate';
import { repairCommunityArchive } from './prepare-community-mods.mjs';
const inputs = process.argv.slice(2);
if (!inputs.length) throw new Error('Usage: node scripts/verify-community-repairs.mjs <original.zip> [...]');
for (const input of inputs) {
  const bytes = await readFile(path.resolve(input));
  const patched = repairCommunityArchive(bytes);
  assert.deepEqual(patched, repairCommunityArchive(bytes), 'repair must be deterministic');
  const bad = Buffer.from(bytes); bad[0] ^= 1;
  assert.throws(() => repairCommunityArchive(bad), /Unsupported/);
  const before = unzipSync(bytes), after = unzipSync(patched);
  assert.deepEqual(Object.keys(after), Object.keys(before).map(name=>name.replaceAll('\\','/')));
  let changed = 0;
  for (const name of Object.keys(before)) {
    if (Buffer.compare(before[name],after[name.replaceAll('\\','/')])) {
      changed++;
      assert.match(name, /\.ks$/);
      new vm.Script(strFromU8(after[name]), { filename: name });
    }
  }
  assert.equal(changed, 1, 'only the reviewed script may change');
  if (after['ChastityTree.ks']) {
    const source = strFromU8(after['ChastityTree.ks']);
    const sentinel = () => {};
    const registry = { existing: sentinel };
    const registration = source.slice(source.indexOf("Object.assign(KDEventMapGeneric['afterLoadGame']"),source.lastIndexOf('KDLoadPerks()'));
    vm.runInNewContext(registration,{KDEventMapGeneric:{afterLoadGame:registry}});
    assert.equal(registry.existing,sentinel);
    assert.equal(typeof registry.chastity101,'function');
    let callback; const loads=[];
    const preload=source.slice(source.indexOf('KDAddEvent(KDEventMapGeneric, "afterModSettingsLoad", "RustedKinksChastityAssets"'),source.indexOf('var ChasteMiscastAmount ='));
    const context = { KDEventMapGeneric:{}, KDAddEvent: (_map,event,_id,fn) => {assert.equal(event,'afterModSettingsLoad');callback=fn;}, KinkyDungeonRootDirectory:'file:///game/', KDModFiles:{}, PIXI:{Assets:{load: input=>loads.push(input.src)}} };
    vm.runInNewContext(preload,context);
    assert.equal(loads.length,0,'preloading must wait for complete archive registration');
    for(const name of Object.keys(after)) context.KDModFiles['file:///game/'+name]='blob:'+name;
    callback();
    assert.ok(loads.length>30);
    assert.ok(loads.every(src=>typeof src==='string' && src.startsWith('blob:')));
  }
  console.log('PASS '+input+': deterministic, hash-gated, syntax valid, asset bytes preserved');
}
