// SPDX-License-Identifier: MPL-2.0
// Adapted from Kinky Dungeon 5.5.6, Copyright Strait Laced Games LLC.
function KDSetPathfindCache(PathMap, newPath, endx, endy, Tiles, Finalindex) {
    for (let i = 0; i < newPath.length - 1; i++) {
        let path = newPath.slice(i);
        let index = `${path[0].x},${path[0].y},${endx},${endy},${Tiles}`;
        PathMap.set(index, path.slice(1));
    }
    if (Finalindex)
        PathMap.set(Finalindex, newPath.slice(0));
}