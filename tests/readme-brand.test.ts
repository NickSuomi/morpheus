import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const readmePath = join(root, "README.md");
const readme = readFileSync(readmePath, "utf8");

describe("README brand contract", () => {
  it("opens with the Morpheus operator-grade dream identity", () => {
    expect(readme).toContain("agent ops for operators running AI work on real repositories");
    expect(readme).toContain("Dream with no limits. Run with evidence.");
    expect(readme).toContain("If it can't explain itself, it can't run.");
  });

  it("keeps the public operator path short and easy to scan", () => {
    expect(readme).toContain("## Quick Start");
    expect(readme).toContain("## Codex Authentication");
    expect(readme).toContain("## Operate");
    expect(readme).toContain("## Requirements");
    expect(readme).not.toContain("## Morpheus Vs Adjacent Tools");
    expect(readme).not.toContain("## Repository Metadata");
    expect(readme.split("\n").length).toBeLessThan(200);
  });

  it("includes the committed evidence-flow visual and no demo media", () => {
    const imageRefs = [...readme.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)].map((match) => match[1]);

    expect(imageRefs).toContain("assets/brand/morpheus-evidence-flow.svg");
    expect(imageRefs.some((ref) => ref.endsWith(".gif") || ref.endsWith(".mp4"))).toBe(false);

    for (const ref of imageRefs) {
      if (/^https?:/.test(ref)) continue;
      expect(existsSync(join(root, ref))).toBe(true);
    }
  });
});
