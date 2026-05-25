import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const packageScript = join(repoRoot, "scripts", "package-release.sh");

const sh = (command: string, cwd: string) =>
  execFileSync("sh", ["-c", command], {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

describe("release packaging", () => {
  it("creates versioned macOS and Linux artifacts with runnable Morpheus shims", () => {
    const dir = mkdtempSync(join(tmpdir(), "morpheus-release-package-"));
    try {
      const output = sh(
        `${JSON.stringify(packageScript)} --version 0.1.0-test --out-dir ${JSON.stringify(dir)} --skip-build`,
        repoRoot,
      );
      const checksums = readFileSync(join(dir, "SHA256SUMS"), "utf8");

      for (const os of ["darwin", "linux"]) {
        for (const arch of ["arm64", "x64"]) {
          const artifact = join(dir, `morpheus-0.1.0-test-${os}-${arch}.tar.gz`);
          const listing = sh(`tar -tzf ${JSON.stringify(artifact)}`, repoRoot);

          expect(existsSync(artifact)).toBe(true);
          expect(existsSync(join(dir, `morpheus-${os}-${arch}.tar.gz`))).toBe(true);
          expect(output).toContain(`morpheus-0.1.0-test-${os}-${arch}.tar.gz`);
          expect(output).toContain(`morpheus-${os}-${arch}.tar.gz`);
          expect(checksums).toMatch(
            new RegExp(`[0-9a-f]{64}  morpheus-0\\.1\\.0-test-${os}-${arch}\\.tar\\.gz`),
          );
          expect(checksums).toMatch(
            new RegExp(`[0-9a-f]{64}  morpheus-${os}-${arch}\\.tar\\.gz`),
          );
          expect(listing).toContain("bin/morpheus");
          expect(listing).toContain("lib/index.mjs");

          const extractDir = join(dir, `${os}-${arch}`);
          sh(`mkdir -p ${JSON.stringify(extractDir)}`, repoRoot);
          sh(`tar -xzf ${JSON.stringify(artifact)} -C ${JSON.stringify(extractDir)}`, repoRoot);
          expect(
            execFileSync(join(extractDir, "bin", "morpheus"), ["--version"], {
              encoding: "utf8",
            }).trim(),
          ).toBe("0.1.0-test");
        }
      }
    } finally {
      rmSync(dir, { force: true, recursive: true });
    }
  });
});
