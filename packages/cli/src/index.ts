#!/usr/bin/env node
import { Command } from "@effect/cli"
import { NodeContext, NodeRuntime } from "@effect/platform-node"
import { Console, Effect } from "effect"
import pkg from "../package.json" with { type: "json" }

const command = Command.make("morpheus", {}, () =>
  Console.log("Morpheus local agent orchestration")
).pipe(Command.withDescription("Morpheus local agent orchestration"))

const run = Command.run(command, {
  name: "Morpheus",
  version: pkg.version
})

run(process.argv).pipe(Effect.provide(NodeContext.layer), NodeRuntime.runMain)
