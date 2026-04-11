#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

LEVEL="${1:-}"

usage() {
  echo "Usage: ./scripts/release-prep.sh [major|minor|patch]" >&2
}

if [[ "$LEVEL" != "major" && "$LEVEL" != "minor" && "$LEVEL" != "patch" ]]; then
  usage
  exit 1
fi

CURRENT_BRANCH="$(git symbolic-ref --short HEAD)"
if [[ "$CURRENT_BRANCH" != "main" ]]; then
  echo "Current branch must be main. Current: ${CURRENT_BRANCH}" >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree must be clean (tracked/untracked changes are not allowed)." >&2
  exit 1
fi

git fetch origin main

if ! git rev-parse -q --verify refs/remotes/origin/main >/dev/null; then
  echo "Could not resolve origin/main after fetch." >&2
  exit 1
fi

AHEAD_COUNT="$(git rev-list --count origin/main..main)"
BEHIND_COUNT="$(git rev-list --count main..origin/main)"
if [[ "$AHEAD_COUNT" != "0" || "$BEHIND_COUNT" != "0" ]]; then
  echo "main must match origin/main exactly (ahead=${AHEAD_COUNT}, behind=${BEHIND_COUNT})." >&2
  exit 1
fi

npm version "$LEVEL" --no-git-tag-version

VERSION="$(node -e "const fs=require('node:fs'); const pkg=JSON.parse(fs.readFileSync('package.json','utf8')); if(!pkg.version){process.exit(1)}; process.stdout.write(pkg.version)")"
BRANCH_NAME="release/v${VERSION}"

if git rev-parse -q --verify "refs/heads/${BRANCH_NAME}" >/dev/null; then
  echo "Branch ${BRANCH_NAME} already exists locally." >&2
  exit 1
fi

if git ls-remote --exit-code --heads origin "${BRANCH_NAME}" >/dev/null 2>&1; then
  echo "Branch ${BRANCH_NAME} already exists on origin." >&2
  exit 1
fi

git switch -c "$BRANCH_NAME"

git add package.json package-lock.json
git commit -m "chore: prepare release v${VERSION}"

echo "Created branch: ${BRANCH_NAME}"
echo "Created commit: chore: prepare release v${VERSION}"
echo "Next: open a PR to main and merge it before tagging."
