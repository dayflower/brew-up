# brew-up

`brew-up` is a JavaScript GitHub Action that renders one file from a template in the source repository and publishes it to the target tap repository.

It resolves one release, maps release assets, injects SHA-256 checksums, and supports three publish modes: `direct`, `pr`, and `pr-auto-merge`.

## Requirements

- GitHub Actions workflow runs in the source repository after release assets are available.
- `target-repo-token` can write to the target tap repository (see [Token Setup](#token-setup)).
- `GITHUB_TOKEN` is available for reading release metadata in the source repository.

For `pr-auto-merge`, the target repository must allow auto-merge and merge commits (see [Auto-merge requirements](#auto-merge-requirements)).

## Token Setup

This action uses two tokens:

- `GITHUB_TOKEN` for reading release metadata from the source repository.
- `target-repo-token` for writing changes in the target tap repository.

### Source repository token (`GITHUB_TOKEN`)

Set job-level permissions to allow release metadata reads:

```yaml
permissions:
  contents: read
```

Pass `GITHUB_TOKEN` to the action step:

```yaml
env:
  GITHUB_TOKEN: ${{ github.token }}
```

### Target repository token (`target-repo-token`)

Recommended: use a fine-grained personal access token (PAT) scoped to the target tap repository.

1. Go to **Settings** -> **Developer settings** -> **Personal access tokens** -> **Fine-grained tokens**.
2. Create a token with **Repository access** limited to the target tap repository.
3. Set repository permissions:
   - **Contents: Read and write**
   - **Pull requests: Read and write**
4. Store the token as a secret in the source repository (for example `TAP_REPO_TOKEN`).
5. Pass it through `with.target-repo-token`.

If you use a classic PAT:

- For public target repositories, `public_repo` is typically sufficient.
- For private target repositories, `repo` is required.

## Inputs

| Input | Required | Description |
| --- | --- | --- |
| `release-id` | no | Release ID to resolve in the source repository |
| `release-tag` | no | Release tag to resolve in the source repository |
| `template-path` | yes | Template file path in the source repository |
| `output-path` | yes | Output file path in the target tap repository |
| `asset-map` | yes | Newline-delimited `key=pattern` mapping |
| `checksum-asset` | no | Checksum asset file name in the release |
| `target-repo` | yes | Target repository in `owner/name` format |
| `target-branch` | yes | Target branch in the target tap repository |
| `target-repo-token` | yes | Token used to write the target tap repository |
| `publish-mode` | yes | `direct`, `pr`, or `pr-auto-merge` |
| `only-if-changed` | no | Skip publish when output is unchanged (`true`/`false`, default: `true`) |
| `dry-run` | no | Resolve and render without mutation (`true`/`false`, default: `false`) |
| `commit-author-name` | no | Optional commit author name (must be paired with email) |
| `commit-author-email` | no | Optional commit author email (must be paired with name) |

## Outputs

| Output | Description | Availability |
| --- | --- | --- |
| `changed` | Whether the rendered output differs from the current file in the target repository | Always |
| `target-commit-sha` | Commit SHA created in the target repository | Set when a commit is created |
| `pull-request-number` | Pull request number | Set in `pr` and `pr-auto-merge` when a PR is created |
| `pull-request-url` | Pull request URL | Set in `pr` and `pr-auto-merge` when a PR is created |
| `resolved-release-id` | Resolved source release ID | Always |
| `resolved-release-tag` | Resolved source release tag | Always |

When `changed=false` and `only-if-changed=true`, commit- and PR-related outputs may be empty.

## Template Syntax and Variables

The template engine is [Mustache](https://mustache.github.io/) (`{{...}}` placeholders).

- Dot notation is supported (for example: `{{artifacts.default.sha256}}`).
- Variables are rendered as raw text (HTML escaping is disabled).
- If the template references unknown variables, the action fails.
- If rendered output still contains unresolved placeholders, the action fails.

### Available Template Variables

| Variable | Type | Description |
| --- | --- | --- |
| `version` | string | Release version derived from tag (for example `1.2.3` from `v1.2.3`) |
| `tag_name` | string | Release tag name (for example `v1.2.3`) |
| `release_id` | string | Resolved release ID |
| `release_name` | string | Release name |
| `release_url` | string | Release HTML URL |
| `artifacts.<key>.name` | string | Resolved asset file name for the key |
| `artifacts.<key>.url` | string | Browser download URL for the key |
| `artifacts.<key>.sha256` | string | SHA-256 checksum for the key |
| `artifact.name` | string | Single-artifact alias of `artifacts.<key>.name` |
| `artifact.url` | string | Single-artifact alias of `artifacts.<key>.url` |
| `artifact.sha256` | string | Single-artifact alias of `artifacts.<key>.sha256` |

`artifact.*` is available only when `asset-map` defines exactly one key.

### Template Example: Single Artifact (Minimal)

```mustache
cask "myapp" do
  version "{{version}}"
  sha256 "{{artifact.sha256}}"

  url "{{artifact.url}}"
  name "{{release_name}}"
end
```

This example requires `asset-map` to contain exactly one key.

### Template Example: Multiple Artifacts (Practical)

```mustache
cask "myapp" do
  version "{{version}}"

  if Hardware::CPU.arm?
    url "{{artifacts.darwin_arm64.url}}"
    sha256 "{{artifacts.darwin_arm64.sha256}}"
  else
    url "{{artifacts.darwin_amd64.url}}"
    sha256 "{{artifacts.darwin_amd64.sha256}}"
  end
end
```

This example uses explicit keys from `asset-map` and does not rely on `artifact.*`.

## asset-map Format and Resolution Rules

`asset-map` is newline-delimited `key=pattern` input.

```text
default=myapp-{{version}}.zip
darwin_arm64=myapp-{{version}}-darwin-arm64.zip
darwin_amd64=myapp-{{version}}-darwin-amd64.zip
```

Rules:

- Each line must be `key=pattern` with non-empty key and pattern.
- Keys must be unique.
- `*` in pattern works as glob wildcard.
- Pattern without `*` is treated as exact file name.
- Template-like variables are expanded in pattern values before matching.
- Supported pattern variables are: `{{version}}`, `{{tag_name}}`, `{{release_id}}`, `{{release_name}}`, `{{release_url}}`.
- Unknown pattern variables cause failure.
- Each key must resolve to exactly one release asset:
  - zero matches: failure
  - multiple matches: failure

### asset-map Examples

Single artifact:

```text
default=myapp-{{version}}.zip
```

Glob for architecture suffix:

```text
darwin=myapp-{{version}}-darwin-*.zip
```

## Example: direct mode

The workflow below uses one asset key (`default`), so a matching template can use `artifact.*`.

```yaml
name: update-tap-direct

on:
  workflow_dispatch:

jobs:
  update:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v4
      - uses: dayflower/brew-up@v0
        env:
          GITHUB_TOKEN: ${{ github.token }}
        with:
          release-tag: v1.2.3
          template-path: .github/homebrew/app.rb.mustache
          output-path: Casks/app.rb
          asset-map: |
            default=myapp-{{version}}.zip
          checksum-asset: checksums.txt
          target-repo: dayflower/homebrew-tap
          target-branch: main
          target-repo-token: ${{ secrets.TAP_REPO_TOKEN }}
          publish-mode: direct
```

## Example: pull request mode

The workflow below uses multiple asset keys, so the template should use `artifacts.<key>.*`.

```yaml
name: update-tap-pr

on:
  workflow_dispatch:

jobs:
  update:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v4
      - uses: dayflower/brew-up@v0
        env:
          GITHUB_TOKEN: ${{ github.token }}
        with:
          release-tag: v1.2.3
          template-path: .github/homebrew/app.rb.mustache
          output-path: Casks/app.rb
          asset-map: |
            default=myapp-{{version}}.zip
            darwin_arm64=myapp-{{version}}-darwin-arm64.zip
            darwin_amd64=myapp-{{version}}-darwin-amd64.zip
          target-repo: dayflower/homebrew-tap
          target-branch: main
          target-repo-token: ${{ secrets.TAP_REPO_TOKEN }}
          publish-mode: pr
          only-if-changed: true
```

## Example: pull request with auto-merge

Before using this mode, confirm the target repository satisfies [Auto-merge requirements](#auto-merge-requirements).

```yaml
name: update-tap-pr-auto-merge

on:
  workflow_dispatch:

jobs:
  update:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v4
      - uses: dayflower/brew-up@v0
        env:
          GITHUB_TOKEN: ${{ github.token }}
        with:
          release-tag: v1.2.3
          template-path: .github/homebrew/app.rb.mustache
          output-path: Casks/app.rb
          asset-map: |
            default=myapp-{{version}}.zip
          target-repo: dayflower/homebrew-tap
          target-branch: main
          target-repo-token: ${{ secrets.TAP_REPO_TOKEN }}
          publish-mode: pr-auto-merge
```

## Auto-merge requirements

`publish-mode: pr-auto-merge` creates a pull request, then enables GitHub native auto-merge with merge method `MERGE`.

GitHub documentation:

- [Managing auto-merge for pull requests in your repository](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-auto-merge-for-pull-requests-in-your-repository)
- [Automatically merging a pull request](https://docs.github.com/pull-requests/collaborating-with-pull-requests/incorporating-changes-from-a-pull-request/automatically-merging-a-pull-request)

Confirm all of the following in the target repository:

- Auto-merge is enabled in repository settings.
- Merge commits are allowed (because this action requests `MERGE` method).
- The identity behind `target-repo-token` has write access.
- Branch protection and required checks are configured as needed.

If required checks are not yet complete, GitHub keeps the PR in auto-merge waiting state.
If auto-merge cannot be enabled, this action fails.

## Development

### Release Playbook

Use `package.json` as the single source of truth for release versioning.
Do not edit `package.json` manually for releases.

1. Bump version with npm (this updates both `package.json` and `package-lock.json`):

   ```bash
   npm version patch --no-git-tag-version
   ```

   Replace `patch` with `minor` or `major` when needed.

2. Commit the version bump and related changes.
3. Run preflight checks:

   ```bash
   npm run release:preflight
   ```

   This runs `check`, `test`, and `build`, and fails if `lib/main.mjs` changes after build.

4. Create and push release tags:

   ```bash
   npm run release:tag:push
   ```

   This creates:
   - immutable tag: `vX.Y.Z` (from `package.json` version)
   - moving major tag: `vX` (force-updated to the same commit)

5. Create a GitHub Release from `vX.Y.Z`.

### Maintainer Smoke Workflow

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

## License

This project is licensed under the MIT License. See [LICENSE](./LICENSE) for details.
