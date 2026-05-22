# Alpha E2E smoke fixture

This is a tiny public/local target repository fixture for Morpheus Alpha smoke verification. It has no private GitLab dependency and no heavyweight application stack.

It is intentionally small:

- `morpheus.config.json` points at local fixture paths.
- `.morpheus/prompts/*` and `.morpheus/skills/*` are minimal generated-style agent inputs.
- `.morpheus/container/Dockerfile` is a lightweight container profile for later real-container checks.
- `.morpheus/secrets/alpha-smoke.env` contains a non-secret fake token only so `morpheus doctor` can prove the configured auth-file path is readable in repeatable tests.
- `scripts/verify.js` is the fixture verification command.

Smoke path from a copied fixture repo:

```sh
git init
morpheus config show --config morpheus.config.json
morpheus doctor --config morpheus.config.json
morpheus daemon --once --config morpheus.config.json
morpheus status --config morpheus.config.json
morpheus runs --config morpheus.config.json
```

The Alpha smoke gate for this fixture is: `morpheus doctor` has no `FAIL` rows and `morpheus daemon --once` exits successfully with operator-inspectable output.
