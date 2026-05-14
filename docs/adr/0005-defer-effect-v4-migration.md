# ADR 0005: Defer Effect v4 Migration

## Status

Accepted

## Context

Morpheus currently uses Effect v3:

- `effect@3.21.2`
- `@effect/schema@0.75.5`
- `@effect/sql@0.51.1`
- `@effect/sql-sqlite-node@0.52.0`
- `@effect/cli@0.75.1`
- `@effect/platform-node@0.106.0`

Package metadata checked on 2026-05-14 shows `effect@latest` is `3.21.2` and `effect@beta` is `4.0.0-beta.66`. The `effect-smol` npm package name does not exist; Effect v4 work is published through the `effect` beta tag and matching beta ecosystem packages.

The Effect v4 documentation describes v4 as beta. It also documents major structural changes:

- Effect packages move toward unified `4.0.0-beta.*` versions.
- Many former `@effect/*` packages move into `effect` or `effect/unstable/*`.
- Services migrate from v3 `Context.Tag` and related APIs to v4 `ServiceMap.Service`.
- Schema APIs change, including union, record, transform, and decode naming.
- Some packages Morpheus depends on have matching beta packages today, such as `@effect/sql-sqlite-node@4.0.0-beta.66`, `@effect/platform-node@4.0.0-beta.66`, and `@effect/vitest@4.0.0-beta.66`.
- Other directly relevant packages, including `@effect/sql`, `@effect/cli`, and `@effect/schema`, do not publish a `beta` dist-tag because v4 consolidates much of that surface into `effect`.

Current Morpheus runtime ports intentionally use v3 `Context.Tag` services and `Layer` implementations. That matches the accepted Effect v3 architecture in ADR 0001 and is consistent with the current package set.

## Decision

Defer migrating Morpheus to Effect v4 until v4 leaves beta or the package/API surface needed by Morpheus is stable enough for implementation work.

Continue using Effect v3 `Context.Tag` service contracts, `Layer` composition, Effect Schema, `@effect/sql-sqlite-node`, `@effect/cli`, and Vitest tests for current v1 slices.

Create a follow-up Beads decision issue to re-evaluate migration after the blockers below clear.

## Migration Impact

Runtime service tags and layers would need a coordinated port migration:

- `ProcessRunner`, `IssueTracker`, and `RunLedger` currently extend `Context.Tag`.
- Services would migrate to `ServiceMap.Service` or the stable v4 equivalent.
- Service type exports such as `Context.Tag.Service<typeof RunLedger>` would need replacement.
- Layers that return plain service objects may need `.of(...)` construction if the final v4 API requires it.

Schema usage would need a boundary-by-boundary rewrite:

- Runtime errors currently use `effect` Schema tagged errors.
- Config and Agent-Ready Contract validation currently import `@effect/schema/Schema`.
- v4 moves Schema into `effect` and changes several API names and construction patterns.

SQL adapter usage would need package and import validation:

- Current adapters use `@effect/sql` and `@effect/sql-sqlite-node`.
- v4 docs describe SQL under `effect/unstable/sql` plus technology-specific packages.
- Morpheus must validate SQLite layer construction, `SqlClient` imports, transaction behavior, and typed SQL errors under v4 before migration.

CLI usage would need package consolidation work:

- Current CLI uses `@effect/cli` and `@effect/platform-node`.
- v4 docs describe CLI as an unstable module and platform functionality as partly consolidated.
- Morpheus must avoid basing operator CLI behavior on unstable APIs unless the benefit is worth the churn.

Tests would need a test harness decision:

- Current tests use Vitest directly with `Effect.runPromise`.
- Effect Solutions recommends `@effect/vitest` for Effect-native tests.
- v4 offers `@effect/vitest@4.0.0-beta.66`, but adopting it can be done independently later and should not block current v1 slices.

## Blocker Criteria

Reconsider migration when all of these are true:

- `effect@latest` is v4 stable, or the team explicitly accepts beta dependency churn.
- Required SQL, SQLite, CLI, platform, and test packages have documented v4-compatible installation paths.
- Service, Schema, SQL, and CLI migration guides match published package metadata.
- A spike proves `pnpm check` passes after migrating one runtime service, one adapter layer, one Schema boundary, and one CLI command.

## Consequences

Staying on Effect v3 avoids churn while Morpheus is still building core orchestration behavior.

Current `Context.Tag` usage remains valid because it is supported by the stable package versions Morpheus depends on and matches ADR 0001's accepted architecture. It also keeps existing runtime/adapters/tests coherent while v4 APIs continue to move.

The cost is a future coordinated migration. That cost is acceptable because Morpheus has few Effect services today, and deferring avoids mixing core product slices with beta ecosystem migration risk.

## References

- Effect v4 docs: <https://effect-ts-effect-smol-1.mintlify.app/>
- Effect v3 to v4 migration guide: <https://effect-ts-effect-smol-1.mintlify.app/migration/v3-to-v4>
- Effect v4 services migration guide: <https://effect-ts-effect-smol-1.mintlify.app/migration/services>
- Effect v4 Schema migration guide: <https://effect-ts-effect-smol-1.mintlify.app/migration/schema>
- Package metadata checked with `npm view` for `effect`, `@effect/schema`, `@effect/sql`, `@effect/sql-sqlite-node`, `@effect/cli`, `@effect/platform-node`, and `@effect/vitest` on 2026-05-14.
