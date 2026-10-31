# KD 5.5.6 compatibility port, source patch v2

Exact official ZIP input: `e829844f4513baa83f6bb301c77ac37425f96c75d428fdf3065c6a06c90bff25`.
Active v2 bundle: `4303a9a102d7596e8c4a62793d6e76c3003c8e2abbea185c642c260a0e07c00b`.
Retained v1 bundle: `8751afa2b64d82a446d279d512d30eb0b8d7a0cb642c7dfc779f6bf4edaa779c`.

The authoritative MPL-2.0 v2 bundle diff retains the audited startup atlas fix,
logo readiness and Pixi 7 compatibility changes. It also hoists the primitive
destination/tile part of cache keys inside `KDSetPathfindCache`. All slices,
point reads, conversions, stored references and map writes remain ordered.
Nonprimitive arguments use the original loop. Compatibility mode can select
the original loop with `disablePathCacheHoistedKeySuffix`. The shared MIT
pixi-filters diff is also applied. Original game copyright belongs to Strait
Laced Games LLC.

The official map generator and pathfinder remain intact. No old restraint cache
or experimental rendering patch is applied. Nearby-enemy and jail-key runtime
facades remain dependency-guarded; changed facades use official JavaScript.
V1 remains recognized for migration and byte-exact restoration.

This patch was derived directly from the official 5.5.6 ZIP. There is no claim that the old TypeScript source patch rebuilds this bundle. Apply the bundle diff only to the exact input above. Installation verifies output hashes, backs up original bytes and restores them on uninstall.
