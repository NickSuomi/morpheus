# ADR 0006: Defer Effect v4 After Re-evaluation

## Status

Accepted

## Context

Morpheus re-evaluated Effect v4 on 2026-05-19 after completing the v1 local
daemon flow.

Current npm package metadata:

- `effect@latest` is `3.21.2`; `effect@beta` is `4.0.0-beta.68`.
- `@effect/schema@latest` is `0.75.5` and has no beta dist-tag.
- `@effect/sql@latest` is `0.51.1` and has no beta dist-tag.
- `@effect/sql-sqlite-node@latest` is `0.52.0`; `@effect/sql-sqlite-node@beta`
  is `4.0.0-beta.68`.
- `@effect/cli@latest` is `0.75.1` and has no beta dist-tag.
- `@effect/platform-node@latest` is `0.106.0`; `@effect/platform-node@beta`
  is `4.0.0-beta.68`.
- `@effect/vitest@latest` is `0.29.0`; `@effect/vitest@beta` is
  `4.0.0-beta.68`.

Official v4 documentation still describes v4 as beta. It documents unified
versioning, package consolidation, unstable `effect/unstable/*` modules, and
breaking migrations for services and Schema. The docs list CLI, SQL, and Schema
surfaces under unstable or consolidated imports rather than the current stable
v3 packages Morpheus uses.

Package/install path check:

- Core Effect: `effect@beta`.
- Schema: consolidated into `effect`, using `import { Schema } from "effect"`.
- SQL core: consolidated under `effect/unstable/sql`.
- SQLite: `@effect/sql-sqlite-node@beta`.
- CLI: consolidated under `effect/unstable/cli`; no `@effect/cli@beta` tag.
- Platform Node: `@effect/platform-node@beta`.
- Testing: `@effect/vitest@beta`.

Spike result:

- Created an isolated `.scratch/effect-v4-spike` package.
- Installed beta packages:
  `effect@beta`, `@effect/platform-node@beta`,
  `@effect/sql-sqlite-node@beta`, and `@effect/vitest@beta`.
- Migrated a representative runtime service from v3 `Context.Tag` shape to the
  current beta `Context.Service` shape.
- Migrated one adapter layer with `Layer.succeed`.
- Migrated one Schema boundary using `Schema.TaggedErrorClass`,
  `Schema.Struct`, checks, and `Schema.decodeUnknownSync`.
- Migrated one SQLite adapter path with `@effect/sql-sqlite-node/SqliteClient`
  and `effect/unstable/sql/SqlClient`.
- Migrated one CLI command shape with `effect/unstable/cli`.
- Verified with `pnpm exec tsc --noEmit`, `pnpm exec tsc --outDir dist`, and
  `node dist/spike.js`.

The spike proves a small beta migration is technically possible, but it also
confirms Morpheus would need a coordinated rewrite across services, Schema,
SQL, CLI, and tests while those surfaces remain beta or unstable.

## Decision

Defer migrating Morpheus to Effect v4 again.

Continue on the current stable v3 package set for product work:

- `effect@3.21.2`
- `@effect/schema@0.75.5`
- `@effect/sql@0.51.1`
- `@effect/sql-sqlite-node@0.52.0`
- `@effect/cli@0.75.1`
- `@effect/platform-node@0.106.0`

Do not create implementation beads yet. Migration is not accepted while
`effect@latest` is still v3 and the required CLI, SQL, and Schema paths depend
on beta or unstable APIs.

## Consequences

Morpheus avoids spending v1 engineering time on beta churn. Current runtime
services, adapters, config validation, and CLI commands stay coherent with the
accepted v3 architecture.

The future migration remains feasible. The spike showed that the current v4 beta
can represent Morpheus-style service contracts, layers, Schema validation,
SQLite access, and CLI commands. The cost should be paid once v4 becomes stable
or the team explicitly accepts beta dependency churn.

## Revisit Criteria

Revisit when at least one is true:

- `effect@latest` is v4 stable.
- The team explicitly accepts beta churn for Morpheus.

Before accepting migration, repeat the spike against current packages and verify
the exact service, Schema, SQL, SQLite, CLI, platform, and test APIs that
Morpheus will use.

## References

- ADR 0005: `docs/adr/0005-defer-effect-v4-migration.md`
- Effect v4 migration guide:
  <https://www.mintlify.com/effect-TS/effect-smol/migration/v3-to-v4>
- Effect v4 Schema migration guide:
  <https://www.mintlify.com/effect-TS/effect-smol/migration/schema>
- Effect v4 SQL docs:
  <https://www.mintlify.com/Effect-TS/effect-smol/sql/postgres>
- Effect v4 package metadata checked with `npm view` on 2026-05-19.
