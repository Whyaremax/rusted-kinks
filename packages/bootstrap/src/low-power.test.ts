import {describe,it,expect} from 'vitest';
import {createLowPowerController} from './low-power.js';
function setup(tickers = [{maxFPS:0,minFPS:10},{maxFPS:0,minFPS:10}], version='5.4.92') {
 let visible=true, focused=true;
 const environment={gameVersion:version,pixiVersion:'7.2.1',tickers:()=>tickers,visible:()=>visible,focused:()=>focused};
 return {controller:createLowPowerController(environment),tickers,environment,background(){focused=false},hidden(){visible=false},foreground(){visible=true;focused=true}};
}
describe('opt-in low-power ticker control',()=>{
 it('caps both independent tickers, respects time scaling, restores exact ceilings',()=>{
  const s=setup();s.controller.setMode('cool'); expect(s.tickers.map(t=>t.maxFPS)).toEqual([30,30]);
  s.background();s.controller.sync();expect(s.tickers.map(t=>t.maxFPS)).toEqual([10,10]);
  s.foreground();s.controller.setMode('economy');expect(s.tickers.map(t=>t.maxFPS)).toEqual([20,20]);
  s.controller.setMode('off');expect(s.tickers.map(t=>t.maxFPS)).toEqual([0,0]);expect(s.tickers.map(t=>t.minFPS)).toEqual([10,10]);
 });
 it('never raises an existing lower ceiling, deduplicates shared tickers',()=>{
  const t={maxFPS:15,minFPS:10};const s=setup([t,t]);s.controller.setMode('cool');expect(t.maxFPS).toBe(15);expect(s.controller.status().tickers).toHaveLength(1);s.controller.dispose();expect(t.maxFPS).toBe(15);
 });
 it('yields to another mod and does not overwrite it on disable',()=>{
  const s=setup();s.controller.setMode('cool');s.tickers[0]!.maxFPS=24;s.controller.sync();s.controller.setMode('off');expect(s.tickers.map(t=>t.maxFPS)).toEqual([24,0]);
 });
 it('fails closed when ticker identity changes',()=>{
  const s=setup();s.controller.setMode('cool');const old=s.tickers[0]!;s.tickers[0]={maxFPS:48,minFPS:10};s.controller.sync();expect(old.maxFPS).toBe(0);expect(s.tickers[0].maxFPS).toBe(48);expect(s.controller.status().reason).toBe('ticker-replaced');
 });
 it('handles a non-writable ticker without breaking the loader',()=>{
  const t={maxFPS:0,minFPS:10};Object.defineProperty(t,'maxFPS',{value:0,writable:false});
  const s=setup([t]);expect(()=>s.controller.setMode('cool')).not.toThrow();expect(s.controller.status().mode).toBe('off');expect(t.maxFPS).toBe(0);
 });
 it('keeps hidden windows capped and restores preexisting limits',()=>{
  const s=setup([{maxFPS:48,minFPS:10}]);s.controller.setMode('cool');s.hidden();s.controller.sync();expect(s.tickers[0]!.maxFPS).toBe(10);s.controller.dispose();expect(s.tickers[0]!.maxFPS).toBe(48);
 });
 it('does not change unsupported builds or resume after disposal',()=>{
  const s=setup(undefined,'5.5.1');s.controller.setMode('cool');expect(s.tickers[0]!.maxFPS).toBe(0);
  const supported=setup();supported.controller.setMode('cool');supported.controller.dispose();supported.controller.setMode('cool');expect(supported.tickers[0]!.maxFPS).toBe(0);
 });
});
