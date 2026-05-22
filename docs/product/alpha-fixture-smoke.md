# Alpha fixture target repo smoke

`fixtures/alpha-target-repo` is the repeatable tiny target repository for the Alpha E2E smoke path described in `docs/product/ALPHA.md`.

Purpose:

- prove Morpheus can load target-owned config from a clean repository;
- prove `morpheus doctor` can reach all setup dependencies when local shims or real tools are available;
- prove `morpheus daemon --once` exercises sync + scheduler flow without private GitLab state;
- keep the target repo public, deterministic, and free of heavyweight app dependencies.

Focused verification used by the test suite:

```sh
pnpm vitest run tests/workspace-cli-smoke.test.ts -t "Alpha fixture"
```

Manual smoke from a temporary copy:

```sh
cp -R fixtures/alpha-target-repo /tmp/morpheus-alpha-target
cd /tmp/morpheus-alpha-target
git init
morpheus config show --config morpheus.config.json
morpheus doctor --config morpheus.config.json
morpheus daemon --once --config morpheus.config.json
morpheus status --config morpheus.config.json
morpheus runs --config morpheus.config.json
```

For a fully local no-private-service smoke, put test shims for `bd`, `glab`, and `docker` earlier on `PATH` that return successful empty results. The checked-in CLI smoke test does this automatically.

The fixture includes `.morpheus/secrets/alpha-smoke.env` with a fake non-secret value so the doctor gate can be repeatable. Real target repos should use `.morpheus/secrets/agent.env` copied from `.morpheus/secrets/agent.env.example` and keep it ignored.
