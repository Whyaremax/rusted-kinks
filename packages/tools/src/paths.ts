import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

export function resolveInside(root: string, relativePath: string): string {
  if (relativePath === "" || isAbsolute(relativePath) || relativePath.includes("\0")) {
    throw new TypeError(`Unsafe relative path: ${JSON.stringify(relativePath)}`);
  }
  const normalizedRoot = resolve(root);
  const target = resolve(normalizedRoot, relativePath);
  const relation = relative(normalizedRoot, target);
  if (
    relation === "" ||
    relation === ".." ||
    relation.startsWith(`..${sep}`) ||
    isAbsolute(relation)
  ) {
    throw new TypeError(`Path escapes target root: ${relativePath}`);
  }
  return target;
}

export function assertExactChild(root: string, target: string, childName: string): void {
  const expected = resolve(root, childName);
  if (resolve(target) !== expected) {
    throw new TypeError(`Refusing operation outside ${expected}`);
  }
}

export function parent(path: string): string {
  return dirname(path);
}

export function portablePath(path: string): string {
  return path.split(sep).join("/");
}
