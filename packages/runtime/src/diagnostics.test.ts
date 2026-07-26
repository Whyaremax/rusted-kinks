import { describe, expect, it } from "vitest";

import {
  buildIssueUrl,
  createDiagnosticDocument,
  exportDiagnosticJson
} from "./diagnostics.js";

describe("diagnostics privacy", () => {
  it("redacts saves, names, paths, URLs, and token-like values", () => {
    const json = exportDiagnosticJson(
      {
        runtime: {
          playerName: "Alice",
          saveData: { secret: "contents" },
          path: "C:\\Users\\Alice\\AppData\\Roaming\\Kinky Dungeon\\profile",
          endpoint: "https://example.test/report",
          token: "abcdefghijklmnopqrstuvwx123456"
        },
        mods: [{ name: "Private Mod", version: "1.2.3" }]
      },
      new Date("2026-01-01T00:00:00Z")
    );
    expect(json).not.toContain("Alice");
    expect(json).not.toContain("Kinky Dungeon");
    expect(json).not.toContain("example.test");
    expect(json).not.toContain("Private Mod");
    expect(json).toContain("<redacted>");
    expect(json).toContain("<path>");
  });

  it("handles cycles without leaking source objects", () => {
    const value: Record<string, unknown> = {};
    value.self = value;
    const document = createDiagnosticDocument({ runtime: value });
    expect(document.runtime).toEqual({ self: "<circular>" });
  });

  it("creates only a manual GitHub issue URL", () => {
    const url = buildIssueUrl("https://github.com/example/kd-hybrid", "{}");
    expect(url).toContain("/issues/new");
    expect(url).not.toContain("%7B%7D");
  });
});
