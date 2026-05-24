import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const script = join(process.cwd(), "scripts/private-data-scan.sh");

const withRepo = <T>(files: Record<string, string>, fn: (dir: string) => T) => {
  const dir = mkdtempSync(join(tmpdir(), "morpheus-private-data-scan-"));
  try {
    for (const [path, contents] of Object.entries(files)) {
      writeFileSync(join(dir, path), contents);
    }
    return fn(dir);
  } finally {
    rmSync(dir, { force: true, recursive: true });
  }
};

const runScan = (dir: string, extraEnv: Record<string, string> = {}) =>
  execFileSync(script, [dir], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      MORPHEUS_SKIP_EXTERNAL_SECRET_SCANNERS: "1",
      ...extraEnv,
    },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

const runScanFailure = (dir: string, extraEnv: Record<string, string> = {}) => {
  try {
    runScan(dir, extraEnv);
    throw new Error("expected private data scan to fail");
  } catch (error) {
    const failure = error as { status?: number; stdout?: string; stderr?: string };

    expect(failure.status).toBe(1);
    return `${failure.stdout ?? ""}${failure.stderr ?? ""}`;
  }
};

describe("private data scanner", () => {
  it("accepts anonymized public fixture names", () => {
    withRepo(
      {
        "README.md": "Morpheus uses fixtures/alpha-target-repo and gitlab.example.com in docs.\n",
      },
      (dir) => {
        expect(() => runScan(dir)).not.toThrow();
      },
    );
  });

  it("rejects operator-provided private target patterns", () => {
    withRepo({ "README.md": "Private target repo: acme-secret-product.\n" }, (dir) => {
      expect(
        runScanFailure(dir, {
          MORPHEUS_FORBIDDEN_PRIVATE_PATTERNS: "acme-secret-product",
        }),
      ).toContain("acme-secret-product");
    });
  });

  it("rejects token-like strings and local Codex auth paths", () => {
    withRepo(
      {
        "README.md": "Do not commit PRIVATE-TOKEN headers or /Users/alice/.codex/auth.json.\n",
      },
      (dir) => {
        const output = runScanFailure(dir);

        expect(output).toContain("PRIVATE-TOKEN");
        expect(output).toContain(".codex/auth.json");
      },
    );
  });
});
