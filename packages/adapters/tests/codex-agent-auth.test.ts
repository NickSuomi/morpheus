import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { createCodexAgentAuth, resolveCodexAuthHome } from "../src/index.js";
import type { ProcessRunOptions, ProcessRunnerService } from "@morpheus/runtime";

const withTempDir = async (fn: (dir: string) => Promise<void>): Promise<void> => {
  const dir = mkdtempSync(join(tmpdir(), "morpheus-codex-auth-"));
  try {
    await fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

type Call = {
  readonly command: string;
  readonly args: readonly string[];
  readonly options?: ProcessRunOptions;
};

const fakeRunner = (
  calls: Call[],
  results: readonly {
    readonly stdout: string;
    readonly stderr: string;
    readonly exitCode: number;
  }[],
  onRun?: (callIndex: number) => void,
): ProcessRunnerService => ({
  run: (command, args, options) => {
    calls.push({ command, args, options });
    onRun?.(calls.length - 1);
    const result = results[calls.length - 1];
    if (result === undefined) {
      throw new Error(`Unexpected command: ${command} ${args.join(" ")}`);
    }
    return Effect.succeed(result);
  },
});

describe("Codex agent auth", () => {
  it("uses an isolated Morpheus auth home and verifies browser login", async () => {
    await withTempDir(async (morpheusHome) => {
      const calls: Call[] = [];
      const authHome = join(morpheusHome, "auth", "codex");
      const auth = createCodexAgentAuth({
        morpheusHome,
        processRunner: fakeRunner(
          calls,
          [
            { stdout: "", stderr: "", exitCode: 0 },
            { stdout: "Logged in using ChatGPT\n", stderr: "", exitCode: 0 },
          ],
          (callIndex) => {
            if (callIndex === 0) {
              writeFileSync(join(authHome, "auth.json"), "{}\n", { mode: 0o644 });
            }
          },
        ),
      });

      await expect(Effect.runPromise(auth.loginCodex({ device: false }))).resolves.toEqual({
        provider: "codex",
        status: "logged-in",
        mode: "chatgpt",
      });

      expect(calls).toEqual([
        {
          command: "codex",
          args: ["login"],
          options: {
            env: { CODEX_HOME: authHome },
            interactive: true,
          },
        },
        {
          command: "codex",
          args: ["login", "status"],
          options: { env: { CODEX_HOME: authHome } },
        },
      ]);
      expect(statSync(authHome).mode & 0o777).toBe(0o700);
      expect(readFileSync(join(authHome, "config.toml"), "utf8")).toContain(
        'cli_auth_credentials_store = "file"',
      );
      expect(statSync(join(authHome, "config.toml")).mode & 0o777).toBe(0o600);
      expect(statSync(join(authHome, "auth.json")).mode & 0o777).toBe(0o600);
    });
  });

  it("supports explicit device login and reports logged-out status without raw output", async () => {
    await withTempDir(async (morpheusHome) => {
      const calls: Call[] = [];
      const authHome = join(morpheusHome, "auth", "codex");
      const auth = createCodexAgentAuth({
        morpheusHome,
        processRunner: fakeRunner(
          calls,
          [
            { stdout: "", stderr: "", exitCode: 0 },
            { stdout: "Not logged in to ChatGPT", stderr: "", exitCode: 0 },
          ],
          (callIndex) => {
            if (callIndex === 0) {
              writeFileSync(join(authHome, "auth.json"), "{}\n");
            }
          },
        ),
      });

      await expect(
        Effect.runPromise(Effect.either(auth.loginCodex({ device: true }))),
      ).resolves.toMatchObject({
        _tag: "Left",
        left: {
          operation: "codex.login.verify",
          failureKind: "operator_access",
        },
      });
      expect(calls[0]?.args).toEqual(["login", "--device-auth"]);
      expect(JSON.stringify(calls)).not.toContain("Not logged in");
    });
  });

  it("reports status and logout without preparing or chmodding the store", async () => {
    await withTempDir(async (morpheusHome) => {
      const calls: Call[] = [];
      const authHome = join(morpheusHome, "auth", "codex");
      mkdirSync(authHome, { recursive: true });
      writeFileSync(join(authHome, "auth.json"), "{}\n", { mode: 0o644 });
      const auth = createCodexAgentAuth({
        morpheusHome,
        processRunner: fakeRunner(calls, [
          { stdout: "Logged in using ChatGPT", stderr: "", exitCode: 0 },
          { stdout: "Logged out", stderr: "", exitCode: 0 },
        ]),
      });

      await expect(Effect.runPromise(auth.statusCodex())).resolves.toMatchObject({
        status: "logged-in",
      });
      await expect(Effect.runPromise(auth.logoutCodex())).resolves.toEqual({
        provider: "codex",
        status: "logged-out",
      });
      expect(calls.map((call) => call.args)).toEqual([["login", "status"], ["logout"]]);
      expect(statSync(join(authHome, "auth.json")).mode & 0o777).toBe(0o644);
      expect(() => readFileSync(join(authHome, "config.toml"), "utf8")).toThrow();
    });
  });

  it("reports a missing store as logged out without filesystem or process mutations", async () => {
    await withTempDir(async (morpheusHome) => {
      const calls: Call[] = [];
      const auth = createCodexAgentAuth({ morpheusHome, processRunner: fakeRunner(calls, []) });

      await expect(Effect.runPromise(auth.statusCodex())).resolves.toEqual({
        provider: "codex",
        status: "logged-out",
      });
      expect(calls).toEqual([]);
      expect(() => statSync(join(morpheusHome, "auth"))).toThrow();
    });
  });

  it("maps unknown Codex status failures to a redacted typed error", async () => {
    await withTempDir(async (morpheusHome) => {
      const calls: Call[] = [];
      const authHome = join(morpheusHome, "auth", "codex");
      mkdirSync(authHome, { recursive: true });
      writeFileSync(join(authHome, "auth.json"), "{}\n");
      const auth = createCodexAgentAuth({
        morpheusHome,
        processRunner: fakeRunner(calls, [
          { stdout: "", stderr: "permission denied: /private/auth/path", exitCode: 1 },
        ]),
      });

      const result = await Effect.runPromise(Effect.either(auth.statusCodex()));
      expect(result).toMatchObject({
        _tag: "Left",
        left: { operation: "codex.status", failureKind: "operator_access" },
      });
      expect(JSON.stringify(result)).not.toContain("/private/auth/path");
    });
  });

  it("resolves MORPHEUS_HOME without borrowing the global Codex home", () => {
    expect(resolveCodexAuthHome({ MORPHEUS_HOME: "/tmp/custom-morpheus" }, "/home/operator")).toBe(
      "/tmp/custom-morpheus/auth/codex",
    );
    expect(resolveCodexAuthHome({}, "/home/operator")).toBe("/home/operator/.morpheus/auth/codex");
  });
});
