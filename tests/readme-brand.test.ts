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

  it("keeps the public operator path easy to scan", () => {
    expect(readme).toContain("## Operator Golden Path");
    expect(readme).toContain("## Evidence Flow");
    expect(readme).toContain("## What Morpheus Refuses To Do");
    expect(readme).toContain("## Morpheus Vs Adjacent Tools");
    expect(readme).toContain("## Repository Metadata");
  });

  it("references only committed lightweight brand assets and no demo media", () => {
    const imageRefs = [...readme.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)].map((match) => match[1]);

    expect(imageRefs).toContain("assets/brand/morpheus-og-card.png");
    expect(imageRefs.some((ref) => ref.endsWith(".gif") || ref.endsWith(".mp4"))).toBe(false);

    for (const ref of imageRefs) {
      if (/^https?:/.test(ref)) continue;
      expect(existsSync(join(root, ref))).toBe(true);
    }
  });
});
