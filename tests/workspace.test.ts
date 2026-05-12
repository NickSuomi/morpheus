import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const readJson = (path: string) =>
  JSON.parse(readFileSync(join(process.cwd(), path), "utf8")) as Record<
    string,
    unknown
  >

describe("workspace scaffold", () => {
  it("defines required root scripts", () => {
    const pkg = readJson("package.json")
    expect(pkg.scripts).toMatchObject({
      build: "pnpm -r build",
      typecheck: "pnpm -r typecheck",
      "typecheck:fast": "pnpm -r typecheck:fast",
      test: "vitest run",
      lint: "oxlint .",
      format: "oxfmt --write .",
      check: "pnpm lint && pnpm typecheck && pnpm test"
    })
  })

  it("keeps core free of Effect dependencies", () => {
    const core = readJson("packages/core/package.json")
    expect(core.dependencies ?? {}).not.toHaveProperty("effect")
    expect(core.dependencies ?? {}).not.toHaveProperty("@effect/schema")
    expect(core.devDependencies ?? {}).not.toHaveProperty("effect")
    expect(core.devDependencies ?? {}).not.toHaveProperty("@effect/schema")
  })

  it("defines expected workspace packages", () => {
    const packageNames = [
      "packages/core/package.json",
      "packages/runtime/package.json",
      "packages/adapters/package.json",
      "packages/cli/package.json"
    ].map((path) => readJson(path).name)

    expect(packageNames).toEqual([
      "@morpheus/core",
      "@morpheus/runtime",
      "@morpheus/adapters",
      "@morpheus/cli"
    ])
  })
})
