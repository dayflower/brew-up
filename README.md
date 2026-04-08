# brew-up

`brew-up` is a JavaScript GitHub Action that renders one file from a template in repository A and publishes it to repository B (Homebrew tap repository).

It resolves one release, maps release assets, injects SHA-256 checksums, and supports three publish modes: `direct`, `pr`, and `pr-auto-merge`.

## Requirements

- GitHub Actions workflow runs in repository A after release assets are available.
- `target-repo-token` can write to repository B.
- `GITHUB_TOKEN` is available for reading release metadata in repository A.

For `pr-auto-merge`, the token for repository B must also be allowed to create pull requests and enable auto-merge.

## Inputs

| Input | Required | Description |
| --- | --- | --- |
| `release-id` | no | Release ID to resolve in repository A |
| `release-tag` | no | Release tag to resolve in repository A |
| `template-path` | yes | Template file path in repository A |
| `output-path` | yes | Output file path in repository B |
| `asset-map` | yes | Newline-delimited `key=pattern` mapping |
| `checksum-asset` | no | Checksum asset file name in the release |
| `target-repo` | yes | Target repository in `owner/name` format |
| `target-branch` | yes | Target branch in repository B |
| `target-repo-token` | yes | Token used to write repository B |
| `publish-mode` | yes | `direct`, `pr`, or `pr-auto-merge` |
| `only-if-changed` | no | Skip publish when output is unchanged (`true`/`false`, default: `true`) |
| `dry-run` | no | Resolve and render without mutation (`true`/`false`, default: `false`) |
| `commit-author-name` | no | Optional commit author name (must be paired with email) |
| `commit-author-email` | no | Optional commit author email (must be paired with name) |

## Outputs

- `changed`
- `target-commit-sha`
- `pull-request-number`
- `pull-request-url`
- `resolved-release-id`
- `resolved-release-tag`

## Example: direct mode

```yaml
name: update-tap-direct

on:
  workflow_dispatch:

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dayflower/brew-up@v0
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

```yaml
name: update-tap-pr

on:
  workflow_dispatch:

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dayflower/brew-up@v0
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

```yaml
name: update-tap-pr-auto-merge

on:
  workflow_dispatch:

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dayflower/brew-up@v0
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

## Smoke workflow

This repository includes `.github/workflows/e2e-smoke.yml` for manual end-to-end validation against a real repository pair.

- Trigger with `workflow_dispatch`
- Provide runtime inputs such as release/tag and `asset-map`
- Store repository B token in `secrets.BREW_UP_TARGET_REPO_TOKEN`

Use `dry-run=true` first, then run with `dry-run=false` when ready.
