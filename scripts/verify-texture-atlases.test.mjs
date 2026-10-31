// SPDX-License-Identifier: MIT
import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp,mkdir,writeFile,rm,readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
const verifier=path.resolve('scripts/verify-texture-atlases.mjs');
async function fixture(t){
 const root=await mkdtemp(path.join(os.tmpdir(),'rk-atlas-test-'));
 t.after(async()=>{const resolved=path.resolve(root);assert.ok(resolved.startsWith(path.resolve(os.tmpdir())+path.sep));assert.ok(path.basename(resolved).startsWith('rk-atlas-test-'));await rm(resolved,{recursive:true,force:true});});
 await mkdir(path.join(root,'out'));await mkdir(path.join(root,'TextureAtlas'));
 await writeFile(path.join(root,'out/main.js'),'const active=["TextureAtlas/models_0000.json","TextureAtlas/models_mobile_0000.json"];');
 const frame=size=>({frame:{x:0,y:0,w:size,h:size},rotated:false,trimmed:false,spriteSourceSize:{x:0,y:0,w:size,h:size},sourceSize:{w:size,h:size}});
 const manifests={};
 for(const [name,scale,size]of [['models_0000',0.5,2],['models_mobile_0000',0.25,1],['game_0000',1,2],['displacement_0000',0.25,1]]){
  manifests[name]={frames:{'Models/test.png':frame(size)},meta:{image:name+'.webp',size:{w:4,h:4},scale:String(scale),related_multi_packs:[]}};
  await writeFile(path.join(root,'TextureAtlas',name+'.webp'),'fixture image placeholder');
 }
 async function run(){for(const[name,data]of Object.entries(manifests))await writeFile(path.join(root,'TextureAtlas',name+'.json'),JSON.stringify(data));return spawnSync(process.execPath,[verifier,'--app-root',root],{encoding:'utf8'});}
 return {root,manifests,run};
}
test('audits active models and shared atlases rather than leftover legacy families',async t=>{
 const {root,run}=await fixture(t);await writeFile(path.join(root,'TextureAtlas/atlas0.json'),'invalid unused legacy atlas');const p=await run();assert.equal(p.status,0,p.stderr);const r=JSON.parse(p.stdout);assert.equal(r.activeLayout,'game-models-displacement');assert.equal(r.sharedAtlases.length,2);assert.equal(r.groups[0].sourceFingerprint,null);assert.equal(r.totals.activeStartupFullDecodedBytes,192);
});
test('rejects missing mobile coverage',async t=>{const f=await fixture(t);f.manifests.models_mobile_0000.frames={};const p=await f.run();assert.notEqual(p.status,0);assert.match(p.stderr,/coverage differs/);});
test('accepts matching fully trimmed placeholders with scaled source rounding',async t=>{
 const f=await fixture(t);for(const[name,w,h]of [['models_0000',3,1],['models_mobile_0000',1,0]])f.manifests[name].frames.blank={frame:{x:3,y:3,w:0,h:0},rotated:false,trimmed:true,spriteSourceSize:{x:0,y:0,w:0,h:0},sourceSize:{w,h}};
 const p=await f.run();assert.equal(p.status,0,p.stderr);assert.equal(JSON.parse(p.stdout).groups[0].emptyPlaceholders,1);
});
test('rejects zero packed width for a nonempty sprite',async t=>{const f=await fixture(t);f.manifests.models_mobile_0000.frames['Models/test.png'].frame.w=0;const p=await f.run();assert.notEqual(p.status,0);assert.match(p.stderr,/positive integer/);});
