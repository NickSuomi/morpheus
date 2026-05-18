# morph-bbp Prototype Handoff

## Question

What minimal real `@ai-hero/sandcastle` adapter shape can run Morpheus preparation, implementation, and review without leaking Sandcastle vocabulary into runtime use-cases?

## Prototype Run

Package metadata and published types were inspected with:

```bash
npm view @ai-hero/sandcastle version description repository dist-tags exports types dependencies --json
npm pack @ai-hero/sandcastle@0.5.10 --pack-destination .scratch/prototypes --json
```

The package version inspected was `0.5.10`.

## Learning

- The stable programmatic API is `run(options)`, with `prompt` or `promptFile`, `logging`, `agent`, `sandbox`, `cwd`, and `maxIterations`.
- `RunResult` exposes `stdout`, `logFilePath`, `branch`, `commits`, and `preservedWorktreePath`, which is enough for Morpheus transcript/artifact capture.
- `promptFile` resolves against `process.cwd()` rather than Sandcastle `cwd`, so Morpheus should read prompt overrides itself and pass inline `prompt` text.
- The adapter should depend on Sandcastle only inside `packages/adapters`; runtime stays behind the `AgentRunner` port.
- Unit tests should inject a fake Sandcastle `run` function and fake provider handles. Real Docker/agent integration belongs in operator validation, not unit tests.

## Production Direction

Add a `SandcastleAgentRunner` adapter that:

- resolves built-in Morpheus prompts or target-repo prompt overrides,
- calls Sandcastle `run()` with file logging,
- extracts typed JSON from a Morpheus result tag in stdout,
- returns runtime `AgentRunner` results with raw stdout transcript and Sandcastle metadata in artifacts,
- is wired by CLI config when `agentRunner.kind` is `sandcastle`.
