// SPDX-License-Identifier: MIT
// Portable add-on; no executable, game assets, saves, or installer changes.
import {build} from 'esbuild';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {zipSync,strToU8} from 'fflate';
const output=path.resolve(process.argv[2]||'artifacts/RustedKinks-LowPower-0.1.0.zip');
const bundle=await build({entryPoints:['packages/bootstrap/src/low-power-mod.ts'],bundle:true,format:'iife',target:['chrome90','safari14'],write:false,legalComments:'inline'});
const manifest={modname:'Rusted Kinks Low Power',moddesc:'Optional cooler-running mode: 30 FPS, or 20 FPS for extra cooling; 10 FPS in the background.',author:'Whyaremax',modbuild:0.1,gamemajor:5,gameminor:4,gamepatch_min:92,gamepatch_max:92,priority:1000,fileorder:['RustedKinksLowPower.js']};
const readme=`Rusted Kinks Low Power 0.1.0\n\nFor Kinky Dungeon 5.4.92 / Pixi 7.2.1, including the repaired community mod set.\n\nCopy this ZIP intact to the Mac game’s KDMods folder beside the .app or select it in the official in-game mod loader. It also works alongside Rusted Kinks. No Windows executable is included.\n\nMod Settings > Rusted Kinks: Low Power:\n- Enabled: 30 FPS while playing, 10 FPS when unfocused/hidden.\n- Extra cooling: 20 FPS while playing.\n- Disabled: restores previous frame ceilings.\n\nLower frame rates trade animation smoothness for less continuous CPU/GPU work. Turn rules and RNG are unchanged in the tested fixture. No temperature sensor or fan controls are used. Actual heat/power savings on a Mac require measurement there.\n\nOn a low-powered laptop, also disable 4K Render Tuner and select the game's 1x resolution / mobile textures if acceptable visually. Those settings are not changed automatically.\n\nRemove this ZIP and restart to uninstall. User saves and other mods' settings are not edited. The add-on yields to conflicting ticker changes by another mod. Unsupported game/Pixi versions stay unchanged.\n`;
const zip=zipSync({'mod.json':strToU8(JSON.stringify(manifest,null,2)),'RustedKinksLowPower.js':bundle.outputFiles[0].contents,'README.txt':strToU8(readme),'LICENSE.txt':new Uint8Array(await readFile('LICENSE'))},{level:9,mtime:new Date('2026-01-01T00:00:00Z')});
await mkdir(path.dirname(output),{recursive:true});await writeFile(output,zip);console.log(JSON.stringify({output,bytes:zip.length}));
