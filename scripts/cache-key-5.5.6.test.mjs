// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInThisContext} from 'node:vm';
import {KD_SOURCE_PATCH_CONTROL_NAME} from '../packages/bootstrap/dist/mod-compatibility-controls.js';
const originalSource=readFileSync(new URL('./fixtures/kd556-path-cache-original.js',import.meta.url),'utf8').replaceAll('\r\n','\n');
const original=runInThisContext(`(${originalSource})`);
const patch=readFileSync(new URL('../upstream-patches/kd-5.5.6/bundle-optimizations-v2.patch',import.meta.url),'utf8');
const hunk=patch.replaceAll('\r\n','\n').split(/(?=^@@ )/m).find(part=>part.includes('\n function KDSetPathfindCache('));
assert.ok(hunk,'The disclosed patch must contain the cache-writer hunk');
const lines=hunk.split('\n');
const edits=lines.slice(lines.findIndex(line=>line.startsWith(' function KDSetPathfindCache('))).filter(line=>/^[ +-]/.test(line));
const before=edits.filter(line=>!line.startsWith('+')).map(line=>line.slice(1)).join('\n')+'\n';
const after=edits.filter(line=>!line.startsWith('-')).map(line=>line.slice(1)).join('\n')+'\n';
assert.equal(originalSource.split(before).length,2,'Patch context must uniquely match the official fixture');
const production=true;
const candidate=runInThisContext(`(${originalSource.replace(before,after)})`);

test('exact key order, fresh arrays, point identity, and final-key overwrites',()=>{
 for(const length of [0,1,2,8,80])for(const final of ['', 'final', '0,1,4,5,TE']){
  const points=Array.from({length},(_,i)=>({x:i,y:i+1}));
  const a=new Map([['existing',points]]),b=new Map(a);
  original(a,points,4,5,'TE',final);candidate(b,points,4,5,'TE',final);
  assert.deepEqual([...b.keys()],[...a.keys()]);
  for(const [key,value] of a){const result=b.get(key);assert.deepEqual(result,value);for(let i=0;i<value.length;i++)assert.equal(result[i],value[i]);if(key!=='existing'){assert.notEqual(result,value);assert.notEqual(result,points);}}
 }
});

test('custom slice, species, coordinate getters, and Map.set observe identical operations',()=>{
 const exercise=writer=>{
  const log=[];
  class Path extends Array {static get [Symbol.species](){log.push('species');return Path;}}
  const p=new Path();for(let i=0;i<4;i++)p.push({get x(){log.push(`x${i}`);return {toString(){log.push(`convert-x${i}`);return String(i);}}},get y(){log.push(`y${i}`);return i+1;}});
  const slice=p.slice;p.slice=function(i){log.push(`slice:${i}`);return slice.call(this,i);};
  const m=new Map();m.set=function(k,v){log.push(`set:${k}:${v instanceof Path}`);return Map.prototype.set.call(this,k,v);};
  writer(m,p,4,5,'TE','final');return log;
 };
 assert.deepEqual(exercise(candidate),exercise(original));
});

test('nonprimitive destinations and tile selectors retain every coercion in order',()=>{
 const exercise=writer=>{const log=[];const value=n=>({toString(){log.push(n);return n;}});const points=[{x:0,y:0},{x:1,y:1},{x:2,y:2}];const map=new Map();writer(map,points,value('endX'),value('endY'),value('tiles'),'final');return {log,keys:[...map.keys()]};};
 assert.deepEqual(exercise(candidate),exercise(original));
});

test('receiver and additional arguments retain official behavior',()=>{
 const receiver={};const points=[{x:0,y:1},{x:2,y:3}];const a=new Map(),b=new Map();
 assert.equal(Reflect.apply(candidate,receiver,[b,points,4,5,'TE','final',{extra:true}]),Reflect.apply(original,receiver,[a,points,4,5,'TE','final',{extra:true}]));assert.deepEqual([...b],[...a]);
});

test('numbers including negative zero and nonfinite values produce exact keys',()=>{
 for(const x of [-0,NaN,Infinity,-Infinity,1e30]){const points=[{x:2,y:3},{x:3,y:4}];const a=new Map(),b=new Map();original(a,points,x,x,'a,b','final');candidate(b,points,x,x,'a,b','final');assert.deepEqual([...b],[...a]);}
});

test('exceptions from coordinate access and custom cache writes retain timing',()=>{
 for(const throwAt of ['x','set']){
  const exercise=writer=>{const log=[];const point={get x(){log.push('x');if(throwAt==='x')throw Error('probe');return 0;},get y(){log.push('y');return 1;}};const points=[point,{x:1,y:2}];const m={set(){log.push('set');throw Error('probe');}};assert.throws(()=>writer(m,points,4,5,'TE','final'),/probe/);return log;};
  assert.deepEqual(exercise(candidate),exercise(original));
 }
});

test('production compatibility bypass retains the original result and callback order',()=>{
 if(!production)return;
 const previous=Object.getOwnPropertyDescriptor(globalThis,KD_SOURCE_PATCH_CONTROL_NAME);
 try{
  let reads=0;globalThis[KD_SOURCE_PATCH_CONTROL_NAME]={get disablePathCacheHoistedKeySuffix(){reads++;return true;}};
  const p=[{x:0,y:1},{x:2,y:3},{x:4,y:5}];const a=new Map(),b=new Map();
  original(a,p,6,7,'TE','final');candidate(b,p,6,7,'TE','final');assert.deepEqual([...b],[...a]);assert.equal(reads,1);
 }finally{if(previous)Object.defineProperty(globalThis,KD_SOURCE_PATCH_CONTROL_NAME,previous);else delete globalThis[KD_SOURCE_PATCH_CONTROL_NAME];}
});
