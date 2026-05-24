#!/bin/sh
set -eu

morpheus_error() {
  printf '%s\n' "morpheus installer: $*" >&2
  exit 1
}

morpheus_need() {
  command -v "$1" >/dev/null 2>&1 || morpheus_error "missing required command: $1"
}

morpheus_downloader() {
  if command -v curl >/dev/null 2>&1; then
    printf '%s\n' "curl"
    return 0
  fi
  if command -v wget >/dev/null 2>&1; then
    printf '%s\n' "wget"
    return 0
  fi
  morpheus_error "missing required command: curl or wget"
}

morpheus_download() {
  url=$1
  destination=$2
  downloader=$(morpheus_downloader)
  if [ "$downloader" = "curl" ]; then
    curl -fsSL "$url" -o "$destination"
  else
    wget -qO "$destination" "$url"
  fi
}

morpheus_sha256() {
  file=$1
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$file" | cut -d ' ' -f 1
    return 0
  fi
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$file" | cut -d ' ' -f 1
    return 0
  fi
  morpheus_error "missing required command for checksum verification: sha256sum or shasum"
}

morpheus_default_artifact_url() {
  os=$(uname -s | tr '[:upper:]' '[:lower:]')
  arch=$(uname -m)
  case "$arch" in
    x86_64|amd64) arch="x64" ;;
    arm64|aarch64) arch="arm64" ;;
  esac
  printf 'https://github.com/nicksuomi/morpheus/releases/download/v%s/morpheus-%s-%s-%s.tar.gz\n' "$MORPHEUS_VERSION" "$MORPHEUS_VERSION" "$os" "$arch"
}

morpheus_default_checksum_url() {
  case "$MORPHEUS_RELEASE_URL" in
    https://github.com/*/releases/download/*/*)
      base=${MORPHEUS_RELEASE_URL%/*}
      printf '%s/SHA256SUMS\n' "$base"
      ;;
    *)
      printf '\n'
      ;;
  esac
}

MORPHEUS_VERSION=${MORPHEUS_VERSION:-0.1.0}
MORPHEUS_INSTALL_DIR=${MORPHEUS_INSTALL_DIR:-${MORPHEUS_BIN_DIR:-${BIN_DIR:-$HOME/.local/bin}}}
MORPHEUS_RELEASE_URL=${MORPHEUS_RELEASE_URL:-$(morpheus_default_artifact_url)}
MORPHEUS_CHECKSUM_URL=${MORPHEUS_CHECKSUM_URL:-$(morpheus_default_checksum_url)}

morpheus_need tar
morpheus_need mkdir
morpheus_need chmod
morpheus_need rm
morpheus_need mktemp

umask 022
mkdir -p "$MORPHEUS_INSTALL_DIR"
tmpdir=$(mktemp -d 2>/dev/null || mktemp -d -t morpheus-install)
cleanup() {
  rm -rf "$tmpdir"
}
trap cleanup EXIT INT HUP TERM

artifact="$tmpdir/morpheus-release.tar.gz"
checksum_file="$tmpdir/checksums.txt"
extract_dir="$tmpdir/extract"

artifact_name=${MORPHEUS_RELEASE_URL##*/}
artifact_name=${artifact_name%%\?*}
[ -n "$artifact_name" ] || artifact_name="morpheus-release"
artifact="$tmpdir/$artifact_name"

printf 'Downloading Morpheus %s from %s\n' "$MORPHEUS_VERSION" "$MORPHEUS_RELEASE_URL"
morpheus_download "$MORPHEUS_RELEASE_URL" "$artifact"

if [ -n "$MORPHEUS_CHECKSUM_URL" ]; then
  morpheus_download "$MORPHEUS_CHECKSUM_URL" "$checksum_file"
  expected=$(awk -v artifact_name="$artifact_name" '
    NF >= 1 && length($1) == 64 && $1 ~ /^[0-9a-fA-F][0-9a-fA-F]*$/ {
      if (NF == 1 || $2 == artifact_name || $2 == "*" artifact_name) {
        found = 1
        print tolower($1)
        exit
      }
      candidate = $1
    }
    END {
      if (!found && candidate != "") {
        print tolower(candidate)
      }
    }
  ' "$checksum_file")
  [ -n "$expected" ] || morpheus_error "checksum file did not contain a sha256 digest"
  actual=$(morpheus_sha256 "$artifact")
  [ "$actual" = "$expected" ] || morpheus_error "checksum mismatch for Morpheus release artifact"
  printf 'Verified checksum for Morpheus release artifact\n'
fi

mkdir -p "$extract_dir"
if tar -xzf "$artifact" -C "$extract_dir" >/dev/null 2>&1; then
  candidate=""
  for path in "$extract_dir/bin/morpheus" "$extract_dir/morpheus"; do
    if [ -f "$path" ]; then
      candidate=$path
      break
    fi
  done
  if [ -z "$candidate" ]; then
    candidate=$(find "$extract_dir" -type f -name morpheus -perm -111 | head -n 1 || true)
  fi
  [ -n "$candidate" ] || morpheus_error "release artifact did not contain a runnable morpheus binary or shim"
else
  candidate=$artifact
fi

install_path="$MORPHEUS_INSTALL_DIR/morpheus"
cp "$candidate" "$install_path"
chmod 0755 "$install_path"

case ":$PATH:" in
  *":$MORPHEUS_INSTALL_DIR:"*)
    version_output=$(morpheus --version 2>&1) || morpheus_error "installed morpheus failed --version: $version_output"
    ;;
  *)
    version_output=$("$install_path" --version 2>&1) || morpheus_error "installed morpheus failed --version: $version_output"
    path_notice="Add $MORPHEUS_INSTALL_DIR to PATH before running morpheus from another shell."
    ;;
esac
[ -n "$version_output" ] || morpheus_error "installed morpheus --version produced no output"

printf 'Installed morpheus to %s\n' "$install_path"
printf 'morpheus --version: %s\n' "$version_output"
if [ -n "${path_notice:-}" ]; then
  printf '%s\n' "$path_notice"
fi
printf '\nNext step:\n'
printf 'cd target-repo && morpheus setup\n'
