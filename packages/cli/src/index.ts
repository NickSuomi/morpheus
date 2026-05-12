#!/usr/bin/env node
import { Command, Options } from "@effect/cli"
import { NodeContext, NodeRuntime } from "@effect/platform-node"
import { Console, Effect, Option } from "effect"
import { loadMorpheusConfig } from "@morpheus/runtime"
import pkg from "../package.json" with { type: "json" }

const configPath = Options.text("config").pipe(Options.optional)

const formatConfigSummary = (
  result: ReturnType<typeof loadMorpheusConfig>
): Effect.Effect<void, Error> => {
  if (result.status === "error") {
    return Effect.fail(
      new Error(`${result.error.kind}: ${result.error.path}`)
    )
  }

  const { config } = result

  return Console.log(
    [
      "Morpheus config",
      `path: ${result.path}`,
      `targetRepo: ${config.targetRepo}`,
      `ledger: ${config.ledger.path}`,
      `issueTracker: ${config.issueTracker.kind}`,
      `mergeRequests: ${config.mergeRequests.kind}`,
      `agentRunner: ${config.agentRunner.kind}`,
      `lanes: preparation=${config.lanes.preparation.concurrency} implementation=${config.lanes.implementation.concurrency} review=${config.lanes.review.concurrency}`
    ].join("\n")
  )
}

const configShow = Command.make("show", { configPath }, ({ configPath }) =>
  formatConfigSummary(
    loadMorpheusConfig({
      configPath: Option.getOrUndefined(configPath)
    })
  )
).pipe(Command.withDescription("Show validated Morpheus config summary"))

const config = Command.make("config", {}, () =>
  Console.log("Morpheus config commands")
).pipe(
  Command.withDescription("Inspect Morpheus config"),
  Command.withSubcommands([configShow])
)

const command = Command.make("morpheus", {}, () =>
  Console.log("Morpheus local agent orchestration")
).pipe(
  Command.withDescription("Morpheus local agent orchestration"),
  Command.withSubcommands([config])
)

const run = Command.run(command, {
  name: "Morpheus",
  version: pkg.version
})

run(process.argv).pipe(Effect.provide(NodeContext.layer), NodeRuntime.runMain)
