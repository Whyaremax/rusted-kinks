import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";
import { describe, expect, it } from "vitest";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const packagesRoot = path.join(repositoryRoot, "packages");

describe("production console cleanliness", () => {
  it("contains no direct console calls in shipped TypeScript", async () => {
    const violations: string[] = [];
    for (const file of await sourceFiles(packagesRoot)) {
      const sourceText = await readFile(file, "utf8");
      const source = ts.createSourceFile(
        file,
        sourceText,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS,
      );
      visit(source, source, file, violations);
    }

    expect(violations).toEqual([]);
  });
});

async function sourceFiles(root: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "dist") {
        files.push(...(await sourceFiles(target)));
      }
    } else if (
      entry.isFile() &&
      entry.name.endsWith(".ts") &&
      !entry.name.endsWith(".test.ts") &&
      !entry.name.endsWith(".d.ts")
    ) {
      files.push(target);
    }
  }
  return files.sort();
}

function visit(
  source: ts.SourceFile,
  node: ts.Node,
  file: string,
  violations: string[],
): void {
  if (ts.isCallExpression(node) && isConsoleMember(node.expression)) {
    const position = source.getLineAndCharacterOfPosition(node.getStart(source));
    violations.push(
      `${path.relative(repositoryRoot, file).replaceAll(path.sep, "/")}:${
        position.line + 1
      }`,
    );
  }
  ts.forEachChild(node, (child) => visit(source, child, file, violations));
}

function isConsoleMember(expression: ts.LeftHandSideExpression): boolean {
  if (ts.isPropertyAccessExpression(expression)) {
    return isConsoleObject(expression.expression);
  }
  if (ts.isElementAccessExpression(expression)) {
    return isConsoleObject(expression.expression);
  }
  return false;
}

function isConsoleObject(expression: ts.Expression): boolean {
  if (ts.isIdentifier(expression)) {
    return expression.text === "console";
  }
  if (
    ts.isPropertyAccessExpression(expression) &&
    expression.name.text === "console" &&
    ts.isIdentifier(expression.expression)
  ) {
    return ["globalThis", "window", "self"].includes(
      expression.expression.text,
    );
  }
  if (
    ts.isElementAccessExpression(expression) &&
    ts.isIdentifier(expression.expression) &&
    ["globalThis", "window", "self"].includes(expression.expression.text) &&
    ts.isStringLiteral(expression.argumentExpression)
  ) {
    return expression.argumentExpression.text === "console";
  }
  return false;
}
