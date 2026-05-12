import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { loadMorpheusConfig } from "./index.js"

const validConfig = {
  targetRepo: ".",
  issueTracker: { kind: "beads" },
  mergeRequests: { kind: "gitlab-glab" },
  agentRunner: { kind: "sandcastle" },
  ledger: { path: ".morpheus/ledger.sqlite" },
  lanes: {
    preparation: { concurrency: 1 },
    implementation: { concurrency: 1 },
    review: { concurrency: 1 }
  },
  verification: { commands: [] },
  retention: {
    completedIntermediate: {
      keepDays: 14,
      keepLast: 100
    },
    failed: "manual",
    reviewCandidate: "until-mr-closed-or-manual",
    active: "never"
  }
} as const

const withTempDir = (fn: (dir: string) => void) => {
  const dir = mkdtempSync(join(tmpdir(), "morpheus-config-"))
  try {
    fn(dir)
  } finally {
    rmSync(dir, { force: true, recursive: true })
  }
}

const writeConfig = (dir: string, value: unknown, file = "morpheus.config.json") => {
  const path = join(dir, file)
  writeFileSync(path, JSON.stringify(value, null, 2))
  return path
}

describe("Morpheus config", () => {
  it("loads a valid config from an explicit path", () => {
    withTempDir((dir) => {
      const configPath = writeConfig(dir, validConfig)

      const result = loadMorpheusConfig({ configPath })

      expect(result).toEqual({
        status: "loaded",
        path: configPath,
        config: validConfig
      })
    })
  })

  it("loads a valid config from the target repo root", () => {
    withTempDir((dir) => {
      const configPath = writeConfig(dir, validConfig)

      const result = loadMorpheusConfig({ targetRepo: dir })

      expect(result).toEqual({
        status: "loaded",
        path: configPath,
        config: validConfig
      })
    })
  })

  it("returns a typed error when config is missing", () => {
    withTempDir((dir) => {
      const result = loadMorpheusConfig({ targetRepo: dir })

      expect(result).toMatchObject({
        status: "error",
        error: {
          kind: "missing_config",
          path: join(dir, "morpheus.config.json")
        }
      })
    })
  })

  it("returns a typed error when config JSON is malformed", () => {
    withTempDir((dir) => {
      const configPath = join(dir, "morpheus.config.json")
      writeFileSync(configPath, "{")

      const result = loadMorpheusConfig({ configPath })

      expect(result).toMatchObject({
        status: "error",
        error: {
          kind: "malformed_json",
          path: configPath
        }
      })
    })
  })

  it("returns a typed error when config shape is invalid", () => {
    withTempDir((dir) => {
      const configPath = writeConfig(dir, {
        ...validConfig,
        issueTracker: { kind: "unsupported" }
      })

      const result = loadMorpheusConfig({ configPath })

      expect(result).toMatchObject({
        status: "error",
        error: {
          kind: "schema_validation",
          path: configPath
        }
      })
    })
  })

  it("allows optional prompt paths to be present or absent", () => {
    withTempDir((dir) => {
      const withPromptsPath = writeConfig(dir, {
        ...validConfig,
        prompts: {
          prepare: ".morpheus/prompts/prepare.md",
          implement: ".morpheus/prompts/implement.md",
          review: ".morpheus/prompts/review.md"
        }
      })
      const withoutPromptsPath = writeConfig(dir, validConfig, "without-prompts.json")

      expect(loadMorpheusConfig({ configPath: withPromptsPath })).toMatchObject({
        status: "loaded",
        config: {
          prompts: {
            prepare: ".morpheus/prompts/prepare.md",
            implement: ".morpheus/prompts/implement.md",
            review: ".morpheus/prompts/review.md"
          }
        }
      })
      expect(loadMorpheusConfig({ configPath: withoutPromptsPath })).toMatchObject({
        status: "loaded",
        config: validConfig
      })
    })
  })
})
