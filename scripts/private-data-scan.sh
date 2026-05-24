#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-.}"

if ! command -v rg >/dev/null 2>&1; then
  echo "private-data-scan: rg is required" >&2
  exit 127
fi

if [[ "${MORPHEUS_SKIP_EXTERNAL_SECRET_SCANNERS:-}" != "1" ]]; then
  if ! command -v gitleaks >/dev/null 2>&1; then
    echo "private-data-scan: gitleaks is required" >&2
    exit 127
  fi

  if ! command -v git-secrets >/dev/null 2>&1 && ! git secrets --help >/dev/null 2>&1; then
    echo "private-data-scan: git-secrets is required" >&2
    exit 127
  fi
fi

FORBIDDEN_PATTERN_FILE="$(mktemp)"
trap 'rm -f "$FORBIDDEN_PATTERN_FILE"' EXIT

cat >"$FORBIDDEN_PATTERN_FILE" <<'PATTERNS'
PRIVATE-TOKEN
glpat-[A-Za-z0-9_-]{20,}
ghp_[A-Za-z0-9_]{20,}
github_pat_[A-Za-z0-9_]{20,}
sk-[A-Za-z0-9_-]{20,}
xox[baprs]-[A-Za-z0-9-]{20,}
https?://gitlab\.(?!(example|example\.com)(/|:|$))[A-Za-z0-9.-]+
/(Users|home)/[^[:space:]"'\'']+/(sandbox|work|src|repos|Projects|Code)/[^[:space:]"'\'']+
\.codex/(auth|credentials|session|token)[^[:space:]"'\'']*
PATTERNS

if [[ -n "${MORPHEUS_FORBIDDEN_PRIVATE_PATTERNS:-}" ]]; then
  printf '%s\n' "$MORPHEUS_FORBIDDEN_PRIVATE_PATTERNS" >>"$FORBIDDEN_PATTERN_FILE"
fi

SCAN_PATHS=(
  "README.md"
  "AGENTS.md"
  "CONTEXT.md"
  "ARCHITECTURE.md"
  "docs"
  "fixtures"
  "packages"
  "scripts"
  "tests"
  ".github"
  ".gitignore"
  "package.json"
)

EXISTING_PATHS=()
for path in "${SCAN_PATHS[@]}"; do
  if [[ -e "$ROOT/$path" ]]; then
    EXISTING_PATHS+=("$path")
  fi
done

if ((${#EXISTING_PATHS[@]} == 0)); then
  echo "private-data-scan: no scan paths found under $ROOT" >&2
  exit 1
fi

echo "private-data-scan: checking forbidden patterns"
if (
  cd "$ROOT"
  rg --pcre2 -n -I -f "$FORBIDDEN_PATTERN_FILE" \
    --glob '!node_modules/**' \
    --glob '!.git/**' \
    --glob '!.beads/**' \
    --glob '!scripts/private-data-scan.sh' \
    --glob '!tests/private-data-scan.test.ts' \
    --glob '!**/.morpheus/secrets/agent.env' \
    "${EXISTING_PATHS[@]}"
); then
  echo "private-data-scan: forbidden private data found" >&2
  exit 1
fi

if [[ "${MORPHEUS_SKIP_EXTERNAL_SECRET_SCANNERS:-}" != "1" ]]; then
  echo "private-data-scan: running gitleaks"
  gitleaks detect --source "$ROOT" --redact --verbose

  echo "private-data-scan: running git-secrets"
  (
    cd "$ROOT"
    git secrets --scan
  )
fi

echo "private-data-scan: ok"
