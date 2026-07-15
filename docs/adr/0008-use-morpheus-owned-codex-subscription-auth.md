# ADR 0008: Use Morpheus-Owned Codex Subscription Auth

## Status

Accepted

## Context

Morpheus currently requires an OpenAI API key for every container-backed agent
run. Codex also supports operator login through an eligible ChatGPT
subscription. Operators need the same explicit CLI lifecycle for that login
without Morpheus silently borrowing credentials from another Codex installation.

Subscription credentials refresh over time and are writable runtime state. A
single credential store must not be shared by concurrent containers until its
refresh and locking behavior is safe across processes.

## Decision

Each target selects exactly one Codex auth source:

```json
{ "auth": { "kind": "chatgpt" } }
```

or:

```json
{
  "auth": {
    "kind": "api-key",
    "envFile": ".morpheus/secrets/agent.env",
    "requiredKeys": ["OPENAI_API_KEY"]
  }
}
```

The previous untagged auth shape is rejected without a compatibility path.

Morpheus delegates ChatGPT browser and device login, token refresh, status, and
logout to the installed Codex CLI. It forces file-backed credential storage in
an isolated `${MORPHEUS_HOME:-~/.morpheus}/auth/codex` home. Morpheus never reads
or imports `~/.codex` in v1.

The CLI surface is:

```txt
morpheus auth login codex [--device]
morpheus auth status [--json]
morpheus auth logout codex
```

Interactive setup offers ChatGPT subscription or API key and completes the
selected setup. Non-interactive setup never starts browser login implicitly;
ChatGPT auth requires an explicit device-login flag.

Subscription-backed containers receive the Morpheus Codex auth home as an
internal read-write mount at `/tmp/morpheus-codex-home` and set `CODEX_HOME` to
that path. OAuth tokens are never copied into target config or environment
variables. Morpheus permits one active subscription-backed run per auth store.
The lease is process-wide; multiple Morpheus processes sharing one auth store
are unsupported in v1. API-key runs keep normal lane concurrency.

## Consequences

Subscription auth requires a compatible Codex CLI on the operator host and is
intended for trusted local operation. API-key auth remains the recommended mode
for CI and unattended remote operation.

Auth status, doctor output, logs, and review artifacts expose state and recovery
actions but never credential values or private host paths.

Multiple subscription profiles and homogeneous concurrency are deferred to
NIC-50. Mixed subscription and API-key pools are deferred to NIC-51.
