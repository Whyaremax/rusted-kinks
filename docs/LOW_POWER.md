# Rusted Kinks Low Power

Optional add-on for Kinky Dungeon **5.4.92 / Pixi 7.2.1**, usable alongside Rusted Kinks v0.1.2. Unsupported versions are left unchanged.

Download **RustedKinks-LowPower-0.1.0.zip** from this release. Keep it zipped and select it in the game's mod loader. On macOS, you can put it in **KDMods beside the .app**. Enable mod loading and restart the game.

In **Mod Settings > Rusted Kinks: Low Power**:

- Enabled: 30 FPS during play, 10 FPS when hidden or unfocused.
- Extra cooling: 20 FPS during play.
- Disabled: restores the previous frame ceilings.

Both the shared game ticker and renderer ticker are capped. Lower existing limits are preserved; conflicting changes by other mods cause the add-on to yield. Remove the ZIP and restart to uninstall.

On older laptops, disable 4K Render Tuner and choose 1x resolution / mobile textures if the visual tradeoff is acceptable. The add-on does not change these settings automatically.

## Validation and limits

In an isolated Windows Electron offscreen run of the actual game with 17 community mods, two matched 6-second samples per mode reduced renderer CPU time by **48.5%** at 30 FPS versus approximately 60 FPS. CPU seconds were 1.76/1.68 uncapped versus 0.88/0.89 capped. Seeded five-turn state and RNG comparisons matched. A packaged 18-mod smoke test checked save reload, textures, perks, and settings.

This measures renderer CPU work, not Mac temperature, total power, or long-session throttling. Mac hardware measurements remain outstanding. Lower FPS reduces animation smoothness. No fan or temperature controls are used.

Build with Node 22 or newer: npm ci, then npm run package:low-power.
