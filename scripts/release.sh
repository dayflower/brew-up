#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

MODE="${1:-tag}"
PUSH_TAGS="false"
SKIP_CHECKS="false"

for arg in "$@"; do
  case "$arg" in
    --push)
      PUSH_TAGS="true"
      ;;
    --skip-checks)
      SKIP_CHECKS="true"
      ;;
  esac
done

if [[ "$MODE" != "preflight" && "$MODE" != "tag" ]]; then
  echo "Usage: ./scripts/release.sh [preflight|tag] [--push] [--skip-checks]" >&2
  exit 1
fi

VERSION="$(node -e "const fs=require('node:fs'); const pkg=JSON.parse(fs.readFileSync('package.json','utf8')); if(!pkg.version){process.exit(1)}; process.stdout.write(pkg.version)")"
VERSION_TAG="v${VERSION}"
MAJOR_TAG="v${VERSION%%.*}"

ensure_clean_tracked_changes() {
  if ! git diff --quiet || ! git diff --cached --quiet; then
    echo "Tracked changes detected. Commit or stash changes before release." >&2
    exit 1
  fi
}

run_preflight_checks() {
  npm run check
  npm run test
  npm run build

  if ! git diff --quiet -- lib/main.mjs; then
    echo "lib/main.mjs changed after build. Commit generated output before release." >&2
    exit 1
  fi
}

ensure_tag_not_exists() {
  if git rev-parse -q --verify "refs/tags/${VERSION_TAG}" >/dev/null; then
    echo "Tag ${VERSION_TAG} already exists locally." >&2
    exit 1
  fi

  if git ls-remote --exit-code --tags origin "refs/tags/${VERSION_TAG}" >/dev/null 2>&1; then
    echo "Tag ${VERSION_TAG} already exists on origin." >&2
    exit 1
  fi
}

print_summary() {
  echo "Version: ${VERSION}"
  echo "Immutable tag: ${VERSION_TAG}"
  echo "Major tag: ${MAJOR_TAG}"
}

ensure_clean_tracked_changes

if [[ "$SKIP_CHECKS" != "true" ]]; then
  run_preflight_checks
fi

print_summary

if [[ "$MODE" == "preflight" ]]; then
  echo "Preflight checks passed."
  exit 0
fi

ensure_tag_not_exists

git tag -a "${VERSION_TAG}" -m "Release ${VERSION_TAG}"
git tag -fa "${MAJOR_TAG}" -m "Release ${VERSION_TAG}"

if [[ "$PUSH_TAGS" == "true" ]]; then
  git push origin "${VERSION_TAG}"
  git push origin "${MAJOR_TAG}" --force
  echo "Pushed tags: ${VERSION_TAG}, ${MAJOR_TAG}"
else
  echo "Created tags locally."
  echo "Push with:"
  echo "  git push origin ${VERSION_TAG}"
  echo "  git push origin ${MAJOR_TAG} --force"
fi
