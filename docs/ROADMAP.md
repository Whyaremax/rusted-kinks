# Roadmap and release gates

KD Hybrid is implemented in vertical slices even though the first public stable
release is intended to cover the broad simulation engine.

| Slice | Native work | Compatibility gate |
| --- | --- | --- |
| Foundation | Protocol, snapshots, spatial index, pathfinding | Unknown builds fall back |
| Turns | Movement, AI decisions, combat arithmetic | Event and replacement mods pass |
| Status | Buff indexing, event batching, deterministic RNG | Save round trips pass |
| World | Map generation and room queries | Seed parity fixtures pass |
| Assets | Lazy atlases, dedupe, adaptive quality | Visual reference suite passes |
| Stable | All above enabled by default on known builds | Performance envelope measured |

The current 0.1 alpha has the foundation protocol and generic core in place.
Its first live integration is the signature-gated static subset of
`KinkyDungeonFindPath`; complex or dynamic calls remain on upstream JavaScript.
The Turns, Status, World, and integrated asset slices are not yet claimed as
upstream-parity migrations.

The generic core exists independently of any one upstream update. Each upstream
release still needs an adapter catalog and parity fixtures before native systems
are enabled by default.
