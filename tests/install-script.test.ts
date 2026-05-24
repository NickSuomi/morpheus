import { describe, expect, it } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";

const repoRoot = process.cwd();
const installScript = resolve(repoRoot, "scripts", "install.sh");

const sh = (command: string, cwd: string) =>
  execFileSync("sh", ["-c", command], {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

describe("curl release installer", () => {
  it("installs a pinned runnable Morpheus release artifact into a configurable bin dir", () => {
    const dir = mkdtempSync(join(tmpdir(), "morpheus-install-test-"));
    try {
      const artifactRoot = join(dir, "artifact-root");
      const binDir = join(dir, "bin");
      const artifactPath = join(dir, "morpheus-0.1.0-test.tar.gz");
      const checksumPath = join(dir, "checksums.txt");
      mkdirSync(join(artifactRoot, "bin"), { recursive: true });
      mkdirSync(binDir, { recursive: true });
      const releasedBinary = join(artifactRoot, "bin", "morpheus");
      writeFileSync(
        releasedBinary,
        '#!/bin/sh\nif [ "$1" = "--version" ]; then echo "0.1.0-test"; else echo "morpheus fixture"; fi\n',
      );
      chmodSync(releasedBinary, 0o755);
      sh(`tar -czf ${JSON.stringify(artifactPath)} -C ${JSON.stringify(artifactRoot)} .`, dir);
      const checksum = sh(
        `shasum -a 256 ${JSON.stringify(artifactPath)} | cut -d ' ' -f 1`,
        dir,
      ).trim();
      writeFileSync(
        checksumPath,
        `0000000000000000000000000000000000000000000000000000000000000000  other-artifact.tar.gz\n${checksum}  ${basename(artifactPath)}\n`,
      );

      const result = spawnSync("sh", [installScript], {
        cwd: repoRoot,
        env: {
          ...process.env,
          PATH: `${binDir}:${process.env.PATH ?? ""}`,
          MORPHEUS_INSTALL_DIR: binDir,
          MORPHEUS_RELEASE_URL: `file://${artifactPath}`,
          MORPHEUS_CHECKSUM_URL: `file://${checksumPath}`,
          MORPHEUS_VERSION: "0.1.0-test",
        },
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });

      expect(result.status, result.stderr).toBe(0);
      const output = `${result.stdout}\n${result.stderr}`;
      expect(output).toContain("Verified checksum");
      expect(output).toContain(`Installed morpheus to ${join(binDir, "morpheus")}`);
      expect(output).toContain("cd target-repo && morpheus setup");
      expect(output).not.toContain("pnpm install");
      expect(output).not.toContain("pnpm build");

      const installed = join(binDir, "morpheus");
      expect(
        execFileSync("morpheus", ["--version"], {
          encoding: "utf8",
          env: { ...process.env, PATH: `${binDir}:${process.env.PATH ?? ""}` },
        }).trim(),
      ).toBe("0.1.0-test");
      expect(statSync(installed).mode & 0o111).not.toBe(0);
      const version = execFileSync(installed, ["--version"], { encoding: "utf8" }).trim();
      expect(version).toBe("0.1.0-test");
    } finally {
      rmSync(dir, { force: true, recursive: true });
    }
  });

  it("can install a direct runnable shim artifact through MORPHEUS_BIN_DIR", () => {
    const dir = mkdtempSync(join(tmpdir(), "morpheus-install-shim-test-"));
    try {
      const binDir = join(dir, "custom-bin");
      const shimPath = join(dir, "morpheus-shim");
      mkdirSync(binDir, { recursive: true });
      writeFileSync(
        shimPath,
        '#!/bin/sh\nif [ "$1" = "--version" ]; then echo "0.1.0-shim"; else echo "morpheus shim"; fi\n',
      );
      chmodSync(shimPath, 0o755);

      const result = spawnSync("sh", [installScript], {
        cwd: repoRoot,
        env: {
          ...process.env,
          MORPHEUS_BIN_DIR: binDir,
          MORPHEUS_RELEASE_URL: `file://${shimPath}`,
          MORPHEUS_VERSION: "0.1.0-shim",
        },
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });

      expect(result.status, result.stderr).toBe(0);
      const installed = join(binDir, "morpheus");
      expect(execFileSync(installed, ["--version"], { encoding: "utf8" }).trim()).toBe(
        "0.1.0-shim",
      );
      expect(result.stdout).toContain("cd target-repo && morpheus setup");
    } finally {
      rmSync(dir, { force: true, recursive: true });
    }
  });

  it("fails when release artifact checksum does not match", () => {
    const dir = mkdtempSync(join(tmpdir(), "morpheus-install-checksum-test-"));
    try {
      const binDir = join(dir, "bin");
      const shimPath = join(dir, "morpheus-shim");
      const checksumPath = join(dir, "SHA256SUMS");
      mkdirSync(binDir, { recursive: true });
      writeFileSync(
        shimPath,
        '#!/bin/sh\nif [ "$1" = "--version" ]; then echo "0.1.0-bad"; else echo "morpheus shim"; fi\n',
      );
      chmodSync(shimPath, 0o755);
      writeFileSync(
        checksumPath,
        `0000000000000000000000000000000000000000000000000000000000000000  ${basename(shimPath)}\n`,
      );

      const result = spawnSync("sh", [installScript], {
        cwd: repoRoot,
        env: {
          ...process.env,
          MORPHEUS_BIN_DIR: binDir,
          MORPHEUS_RELEASE_URL: `file://${shimPath}`,
          MORPHEUS_CHECKSUM_URL: `file://${checksumPath}`,
          MORPHEUS_VERSION: "0.1.0-bad",
        },
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("checksum mismatch for Morpheus release artifact");
    } finally {
      rmSync(dir, { force: true, recursive: true });
    }
  });
});
