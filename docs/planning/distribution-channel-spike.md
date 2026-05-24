# Morpheus Distribution Channel Spike

## Decision

Use a GitHub Releases curl installer as the v1 distribution channel.

Morpheus already has `scripts/install.sh`, ALPHA docs already define a curl
installer contract, and this path works for macOS and Linux without requiring
operators to clone Morpheus or install package-manager-specific metadata first.

Homebrew and npm remain rejected for v1, not rejected forever.

## Sources Checked

- Homebrew taps and formula docs:
  - https://docs.brew.sh/Taps
  - https://docs.brew.sh/Formula-Cookbook
  - https://docs.brew.sh/How-to-Create-and-Maintain-a-Tap
- npm package executable/provenance docs:
  - https://docs.npmjs.com/cli/v10/configuring-npm/package-json
  - https://docs.npmjs.com/generating-provenance-statements
  - https://docs.npmjs.com/trusted-publishers
- GitHub release/provenance docs:
  - https://docs.github.com/en/rest/releases
  - https://docs.github.com/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations

## Channel Comparison

| Channel                          | macOS/Linux                                                        | Node/runtime reqs                                                                                                                                         | Binary vs JS                                                                  | Update flow                                                                        | Checksums/signing                                                                                               | GitHub release fit                                                                             | Security posture                                                                                                                     |
| -------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Curl installer + GitHub Releases | Direct macOS/Linux artifacts from one script.                      | Can ship runnable shim or bundled JS plus declared Node requirement. Later can switch to compiled/single-file artifact without changing operator command. | Best v1 fit: release asset can be JS shim now, binary later.                  | Re-run installer for pinned/latest version; script can support `MORPHEUS_VERSION`. | Installer can verify `SHA256SUMS`; GitHub artifact attestations can add provenance.                             | Native fit: upload tarballs + checksums + attestations to release assets.                      | Smallest surface if installer is short, pinned, checksum-verified, and avoids shelling secret data.                                  |
| Homebrew tap                     | Strong macOS, possible Linuxbrew support, but users need Homebrew. | Formula can depend on Node or install prebuilt artifacts.                                                                                                 | Good for binaries; awkward if v1 is still JS workspace packaging.             | `brew upgrade` is excellent once tap exists.                                       | Formula SHA256 is standard; bottles can be built/uploaded via tap workflow.                                     | Good but requires tap repo/formula/bottle automation.                                          | Strong once maintained, but extra repo/workflow raises ALPHA burden.                                                                 |
| npm package / binary-style npm   | Works wherever Node/npm works.                                     | Requires Node/npm globally before installing Morpheus.                                                                                                    | JS package is natural; binary package needs postinstall or platform packages. | `npm i -g @scope/morpheus` / `npm update -g`.                                      | npm provenance/trusted publishing helps registry provenance; binary checksum story is package-manager-specific. | GitHub Actions can publish npm with provenance, but GitHub release artifacts become secondary. | Higher supply-chain exposure through npm dependency/install-script surface; less aligned with "no source build on operator machine". |

## Recommendation

Ship ALPHA/v1 as:

1. GitHub Release per version tag.
2. Platform tarballs named by version, OS, and architecture.
3. `SHA256SUMS` checked by `scripts/install.sh`.
4. Optional GitHub artifact attestations once release workflow exists.
5. README install command points to hosted installer only after release assets are live.

Use a JS shim artifact first if needed, but keep artifact boundary stable:

```text
morpheus-<version>-darwin-arm64.tar.gz
morpheus-<version>-darwin-x64.tar.gz
morpheus-<version>-linux-arm64.tar.gz
morpheus-<version>-linux-x64.tar.gz
SHA256SUMS
```

Packaging entry points:

- local dry run: `scripts/package-release.sh --version <version> --skip-build`;
- release workflow: `.github/workflows/release-artifacts.yml`.

`scripts/package-release.sh` writes `SHA256SUMS` beside the tarballs. The
installer checks `MORPHEUS_CHECKSUM_URL` when provided and defaults to the
release's `SHA256SUMS` asset for GitHub Release URLs.

## Rejected Alternatives

Homebrew is not v1 because it needs a tap, formula maintenance, bottle workflow,
and Homebrew dependency before Morpheus can be installed. It is a good follow-up
after release artifacts stabilize.

npm is not v1 because Morpheus operators should not need to understand global
Node/npm setup before first use. npm provenance is useful, but npm also
reintroduces package-manager and dependency-supply-chain concerns at install
time.

Source-build install is not v1 because ALPHA explicitly says install must not
build Morpheus from source on the operator machine.

## Follow-Up Beads Issues

Created implementation follow-ups:

- `morph-2hx`: Build GitHub release artifact packaging workflow.
- `morph-cb7`: Publish and verify SHA256SUMS for release artifacts.
- `morph-axq`: Wire hosted curl installer URL into README after first release.
