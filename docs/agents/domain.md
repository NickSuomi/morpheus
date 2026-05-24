# Domain Docs

This repo uses a single-context domain documentation layout.

## Read Before Architecture Or Implementation Work

- `CONTEXT.md` at repo root for product/domain vocabulary.
- `ARCHITECTURE.md` at repo root for current system shape.
- `docs/adr/` for accepted architecture decisions.
- `.understand-anything/knowledge-graph.json` after those docs, for a
  generated architecture map, guided tour, layers, and cross-file relationships.

If a term conflicts with `CONTEXT.md`, use the glossary term or ask the user to resolve the conflict.

If a proposal contradicts an ADR, call that out explicitly and explain why the ADR may need reopening.

The knowledge graph is navigation aid, not authority. If it conflicts with
`CONTEXT.md`, `ARCHITECTURE.md`, the PRD, or an ADR, follow the canonical doc
and refresh the graph.

## Layout

```txt
/
  CONTEXT.md
  ARCHITECTURE.md
  docs/
    adr/
    agents/
  .understand-anything/
    knowledge-graph.json
```

No `CONTEXT-MAP.md` exists. Do not assume per-package domain contexts until one is created.
