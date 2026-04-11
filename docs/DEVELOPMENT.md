# Development

## Release Playbook

Use `package.json` as the single source of truth for release versioning.
Do not edit `package.json` manually for releases.
This repository uses branch protection on `main`; release tags must be created from merged `main` commits.

1. Create a release prep branch from the latest `main`:

   ```bash
   git switch main
   git pull --ff-only origin main
   git switch -c release/vX.Y.Z
   ```

2. Bump version with npm (this updates both `package.json` and `package-lock.json`):

   ```bash
   npm version patch --no-git-tag-version
   ```

   Replace `patch` with `minor` or `major` when needed.

3. Commit the version bump and open a pull request to `main`.
4. Merge the pull request after CI passes.
5. If `update-bundled-action` opens a PR for `dist/main.mjs`, merge that PR too.
6. Sync local `main` to the final merged state:

   ```bash
   git switch main
   git pull --ff-only origin main
   ```

7. Run preflight checks on `main`:

   ```bash
   npm run release:preflight
   ```

   This runs `check`, `test`, and `build`, and fails if `dist/main.mjs` changes after build.

8. Create and push release tags, then create GitHub Release from `main`:

   ```bash
   npm run release:tag:push
   ```

   This creates:
   - immutable tag: `vX.Y.Z` (from `package.json` version)
   - moving major tag: `vX` (force-updated to the same commit)
   - GitHub Release: `vX.Y.Z` (with auto-generated notes)

## Maintainer Smoke Workflow

This section is for `brew-up` maintainers and contributors who need manual end-to-end validation of changes. It is not part of the standard user setup for this action.

The repository includes `.github/workflows/e2e-smoke.yml` for manual end-to-end validation across a source repository and a target tap repository.

- Trigger with `workflow_dispatch` in the source repository.
- Ensure the source repository has both:
  - a template file (for example `.github/homebrew/brew-up-smoke.rb.mustache`)
  - a GitHub Release that already contains assets matching your `asset-map` patterns
- Store the target tap repository token in a source-repository secret.
  - Default secret name: `BREW_UP_TARGET_REPO_TOKEN`
  - Override secret name with the `target-repo-token-secret-name` input

Use `dry-run=true` first, then run with `dry-run=false` when ready.
