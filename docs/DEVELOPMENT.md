# Development

## Release Playbook

Use `package.json` as the single source of truth for release versioning.
Do not edit `package.json` manually for releases.
This repository uses branch protection on `main`; release tags must be created from merged `main` commits.

For steps 1-3, you can use the helper command:

```bash
npm run release:prep -- patch
```

Replace `patch` with `minor` or `major` when needed.
This helper checks `main`, ensures the working tree is clean, verifies `main` matches `origin/main`, bumps version, creates `release/vX.Y.Z`, commits the bump, pushes the branch, creates a pull request to `main`, and enables GitHub native auto-merge with merge commit mode.

Before using this helper, ensure:

- `gh` CLI is installed and authenticated (`gh auth status`)
- repository settings allow both auto-merge and merge commits

If you need to run the steps manually:

1. Sync to the latest `main`:

   ```bash
   git switch main
   git pull --ff-only origin main
   ```

2. Bump version with npm (this updates both `package.json` and `package-lock.json`):

   ```bash
   npm version patch --no-git-tag-version
   ```

   Replace `patch` with `minor` or `major` when needed.

3. Create `release/vX.Y.Z`, commit the version bump, push the branch, open a pull request to `main`, and enable auto-merge in merge commit mode.
4. Wait for the pull request to be merged by auto-merge after checks pass.
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
