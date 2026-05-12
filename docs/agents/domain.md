# Domain Docs

This repo uses a single-context domain documentation layout.

## Read Before Architecture Or Implementation Work

- `CONTEXT.md` at repo root for product/domain vocabulary.
- `ARCHITECTURE.md` at repo root for current system shape.
- `docs/adr/` for accepted architecture decisions.

If a term conflicts with `CONTEXT.md`, use the glossary term or ask the user to resolve the conflict.

If a proposal contradicts an ADR, call that out explicitly and explain why the ADR may need reopening.

## Layout

```txt
/
  CONTEXT.md
  ARCHITECTURE.md
  docs/
    adr/
    agents/
```

No `CONTEXT-MAP.md` exists. Do not assume per-package domain contexts until one is created.
