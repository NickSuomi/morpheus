#!/bin/sh
set -eu

usage() {
  cat <<'USAGE'
Usage: scripts/package-release.sh --version <version> [--out-dir <dir>] [--skip-build] [--only-os <os>] [--only-arch <arch>]

Build Morpheus release tarballs:
  morpheus-<version>-darwin-arm64.tar.gz
  morpheus-<version>-darwin-x64.tar.gz
  morpheus-<version>-linux-arm64.tar.gz
  morpheus-<version>-linux-x64.tar.gz
USAGE
}

version=""
out_dir="dist/release"
skip_build=0
only_os=""
only_arch=""

while [ "$#" -gt 0 ]; do
  case "$1" in
    --version)
      shift
      [ "$#" -gt 0 ] || { usage >&2; exit 2; }
      version=$1
      ;;
    --out-dir)
      shift
      [ "$#" -gt 0 ] || { usage >&2; exit 2; }
      out_dir=$1
      ;;
    --skip-build)
      skip_build=1
      ;;
    --only-os)
      shift
      [ "$#" -gt 0 ] || { usage >&2; exit 2; }
      only_os=$1
      ;;
    --only-arch)
      shift
      [ "$#" -gt 0 ] || { usage >&2; exit 2; }
      only_arch=$1
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      printf '%s\n' "package-release: unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
  shift
done

[ -n "$version" ] || { usage >&2; exit 2; }

need() {
  command -v "$1" >/dev/null 2>&1 || {
    printf '%s\n' "package-release: missing required command: $1" >&2
    exit 127
  }
}

need chmod
need cp
need mkdir
need rm
need tar
if command -v sha256sum >/dev/null 2>&1; then
  sha256_cmd="sha256sum"
elif command -v shasum >/dev/null 2>&1; then
  sha256_cmd="shasum -a 256"
else
  printf '%s\n' "package-release: missing required command: sha256sum or shasum" >&2
  exit 127
fi

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
mkdir -p "$(dirname -- "$out_dir")"
out_dir_abs=$(CDPATH= cd -- "$(dirname -- "$out_dir")" 2>/dev/null && pwd)/$(basename -- "$out_dir")

if [ "$skip_build" -eq 0 ]; then
  need pnpm
  (cd "$repo_root" && pnpm -r build)
fi

[ -f "$repo_root/packages/cli/dist/index.mjs" ] || {
  printf '%s\n' "package-release: missing packages/cli/dist/index.mjs; run package builds first or omit --skip-build" >&2
  exit 1
}

rm -rf "$out_dir_abs"
mkdir -p "$out_dir_abs"

deploy_dir="$out_dir_abs/app"
rm -rf "$deploy_dir"
need pnpm
(cd "$repo_root" && pnpm --filter @morpheus/cli deploy --prod --legacy "$deploy_dir" >/dev/null)
for package_name in core runtime adapters; do
  source_dist="$repo_root/packages/$package_name/dist"
  target_dist="$deploy_dir/node_modules/@morpheus/$package_name/dist"
  [ -d "$source_dist" ] || {
    printf '%s\n' "package-release: missing packages/$package_name/dist; run package builds first or omit --skip-build" >&2
    exit 1
  }
  rm -rf "$target_dist"
  mkdir -p "$(dirname -- "$target_dist")"
  cp -R "$source_dist" "$target_dist"
done

checksums="$out_dir_abs/SHA256SUMS"
: >"$checksums"

for os in darwin linux; do
  if [ -n "$only_os" ] && [ "$os" != "$only_os" ]; then
    continue
  fi
  for arch in arm64 x64; do
    if [ -n "$only_arch" ] && [ "$arch" != "$only_arch" ]; then
      continue
    fi
    name="morpheus-$version-$os-$arch"
    stage="$out_dir_abs/$name"
    mkdir -p "$stage/bin" "$stage/app"
    cp -R "$deploy_dir/." "$stage/app/"
    cat >"$stage/bin/morpheus" <<EOF
#!/bin/sh
set -eu
script_dir=\$(CDPATH= cd -- "\$(dirname -- "\$0")" && pwd)
if [ "\${1:-}" = "--version" ]; then
  printf '%s\n' "$version"
  exit 0
fi
if [ -f "\$script_dir/.morpheus-app/dist/index.mjs" ]; then
  exec node "\$script_dir/.morpheus-app/dist/index.mjs" "\$@"
fi
exec node "\$script_dir/../app/dist/index.mjs" "\$@"
EOF
    chmod 0755 "$stage/bin/morpheus"
    artifact="$out_dir_abs/$name.tar.gz"
    tar -czf "$artifact" -C "$stage" .
    # shellcheck disable=SC2086
    digest=$($sha256_cmd "$artifact" | awk '{print $1}')
    printf '%s  %s\n' "$digest" "$(basename -- "$artifact")" >>"$checksums"
    printf '%s\n' "$artifact"

    latest_artifact="$out_dir_abs/morpheus-$os-$arch.tar.gz"
    cp "$artifact" "$latest_artifact"
    # shellcheck disable=SC2086
    latest_digest=$($sha256_cmd "$latest_artifact" | awk '{print $1}')
    printf '%s  %s\n' "$latest_digest" "$(basename -- "$latest_artifact")" >>"$checksums"
    printf '%s\n' "$latest_artifact"
  done
done
printf '%s\n' "$checksums"
