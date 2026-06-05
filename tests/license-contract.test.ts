import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

const readText = (path: string) => readFileSync(join(root, path), "utf8");
const readJson = (path: string) => JSON.parse(readText(path)) as { license?: string };

describe("license contract", () => {
  it("publishes Morpheus under Apache-2.0 with NOTICE attribution", () => {
    expect(readText("LICENSE")).toContain("Apache License");
    expect(readText("LICENSE")).toContain("Version 2.0, January 2004");
    expect(readText("NOTICE")).toContain("Morpheus");
    expect(readText("NOTICE")).toContain("Copyright 2026 Nick Suomi");
    expect(readText("NOTICE")).toContain("preserve this NOTICE file");
  });

  it("declares Apache-2.0 in package metadata", () => {
    for (const packagePath of [
      "package.json",
      "packages/core/package.json",
      "packages/runtime/package.json",
      "packages/adapters/package.json",
      "packages/cli/package.json",
    ]) {
      expect(readJson(packagePath).license).toBe("Apache-2.0");
    }
  });

  it("links the license and notice from the public README", () => {
    const readme = readText("README.md");

    expect(readme).toContain("[Apache-2.0](LICENSE)");
    expect(readme).toContain("[NOTICE](NOTICE) attribution");
  });
});
