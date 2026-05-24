#!/bin/sh
set -eu

usage() {
  cat <<'USAGE'
Usage: scripts/package-release.sh --version <version> [--out-dir <dir>] [--skip-build]

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

for os in darwin linux; do
  for arch in arm64 x64; do
    name="morpheus-$version-$os-$arch"
    stage="$out_dir_abs/$name"
    mkdir -p "$stage/bin" "$stage/lib"
    cp "$repo_root/packages/cli/dist/index.mjs" "$stage/lib/index.mjs"
    if [ -f "$repo_root/packages/cli/dist/index.mjs.map" ]; then
      cp "$repo_root/packages/cli/dist/index.mjs.map" "$stage/lib/index.mjs.map"
    fi
    cat >"$stage/bin/morpheus" <<EOF
#!/bin/sh
set -eu
if [ "\${1:-}" = "--version" ]; then
  printf '%s\n' "$version"
  exit 0
fi
exec node "\$(dirname "\$0")/../lib/index.mjs" "\$@"
EOF
    chmod 0755 "$stage/bin/morpheus"
    tar -czf "$out_dir_abs/$name.tar.gz" -C "$stage" .
    printf '%s\n' "$out_dir_abs/$name.tar.gz"
  done
done
