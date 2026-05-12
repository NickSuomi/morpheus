# ADR 0001: Use TypeScript Monorepo With Effect Runtime

## Status

Accepted

## Context

Morpheus is a local orchestration system for agent work. It integrates CLI commands, daemon scheduling, Beads, GitLab via `glab`, SQLite, process execution, workspace operations, and agent runner adapters.

The system needs strong workflow correctness, typed errors, deterministic domain logic, and fast iteration.

## Decision

Use a TypeScript monorepo:

- `packages/core`
- `packages/runtime`
- `packages/adapters`
- `packages/cli`

Use Effect in runtime, adapters, and CLI. Keep `packages/core` pure TypeScript with no Effect dependency.

Use Effect Schema for config, contract, and runtime boundary validation.

Prefer the TypeScript 7 native `tsgo` compiler for fast typechecking when compatible. Keep `tsc --noEmit --incremental` as the fallback until native compiler compatibility is proven in this repo.

## Consequences

Pure domain behavior remains easy to test and reason about.

Effect provides resource management, typed errors, config loading, SQL integration, process execution, and daemon concurrency at side-effect edges.

Effect Schema avoids maintaining a parallel validation stack.

`tsgo` can materially reduce typecheck time, but the fallback protects Morpheus from beta/native compiler ecosystem gaps.

The monorepo split creates real ownership boundaries without requiring package-per-adapter churn.

Package boundaries must not become pass-through modules. Split further only when real reuse or independent versioning pressure appears.
