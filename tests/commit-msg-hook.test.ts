import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const script = join(process.cwd(), "scripts/validate-commit-msg.sh");

const withMessageFile = <T>(message: string, fn: (path: string) => T) => {
  const dir = mkdtempSync(join(tmpdir(), "morpheus-commit-msg-"));
  try {
    const path = join(dir, "COMMIT_EDITMSG");
    writeFileSync(path, message);
    return fn(path);
  } finally {
    rmSync(dir, { force: true, recursive: true });
  }
};

const runValidator = (message: string) =>
  withMessageFile(message, (path) => {
    execFileSync(script, [path], {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
    });
  });

const runValidatorFailure = (message: string) =>
  withMessageFile(message, (path) => {
    try {
      execFileSync(script, [path], {
        cwd: process.cwd(),
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
      throw new Error("expected validator to fail");
    } catch (error) {
      const failure = error as {
        status?: number;
        stderr?: string | Buffer;
      };

      expect(failure.status).toBe(1);
      return String(failure.stderr);
    }
  });

describe("commit message validation hook", () => {
  it.each(["docs", "feat", "fix", "refactor", "test", "chore", "spike", "decision"])(
    "accepts %s commit subjects",
    (type) => {
      expect(() => runValidator(`${type}: add local validation hook\n`)).not.toThrow();
    },
  );

  it("accepts merge commit subjects", () => {
    expect(() => runValidator("Merge branch 'main' into feature/demo\n")).not.toThrow();
  });

  it("accepts revert commit subjects", () => {
    expect(() => runValidator('Revert "feat: add local validation hook"\n')).not.toThrow();
  });

  it("ignores comment lines before the subject", () => {
    expect(() =>
      runValidator("# Please enter the commit message\n\nfix: validate subject\n"),
    ).not.toThrow();
  });

  it("rejects unsupported commit types", () => {
    expect(runValidatorFailure("style: add formatter config\n")).toContain("unsupported type");
  });

  it("rejects subjects without a type separator", () => {
    expect(runValidatorFailure("fix add validation hook\n")).toContain("must contain ': '");
  });

  it("rejects empty summaries", () => {
    expect(runValidatorFailure("fix: \n")).toContain("summary is empty");
  });

  it("rejects non-imperative summary starts", () => {
    expect(runValidatorFailure("fix: fixed validation bug\n")).toContain("imperative verb");
    expect(runValidatorFailure("fix: fixes validation bug\n")).toContain("imperative verb");
    expect(runValidatorFailure("fix: fixing validation bug\n")).toContain("imperative verb");
  });

  it("rejects subjects longer than 72 characters", () => {
    expect(
      runValidatorFailure(
        "feat: add repository commit message validation for every local developer today\n",
      ),
    ).toContain("longer than 72 characters");
  });
});
