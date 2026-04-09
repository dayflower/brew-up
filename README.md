# brew-up

`brew-up` is a JavaScript GitHub Action that renders one file from a template in the source repository and publishes it to the target tap repository.

It resolves one release, maps release assets, injects SHA-256 checksums, and supports three publish modes: `direct`, `pr`, and `pr-auto-merge`.

## Requirements

- GitHub Actions workflow runs in the source repository after release assets are available.
- `target-repo-token` can write to the target tap repository.
- `GITHUB_TOKEN` is available for reading release metadata in the source repository.

For `pr-auto-merge`, the token for the target tap repository must also be allowed to create pull requests and enable auto-merge.

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

This repository includes `.github/workflows/e2e-smoke.yml` for manual end-to-end validation across a source repository and a target tap repository.

- Trigger with `workflow_dispatch` in the source repository.
- Ensure the source repository has both:
  - a template file (for example `.github/homebrew/brew-up-smoke.rb.mustache`)
  - a GitHub Release that already contains assets matching your `asset-map` patterns
- Store the target tap repository token in a source-repository secret.
  - Default secret name: `BREW_UP_TARGET_REPO_TOKEN`
  - Override secret name with the `target-repo-token-secret-name` input

`asset-map` expects newline-delimited `key=pattern` entries. Examples:

```text
default=myapp-{{version}}.zip
```

```text
darwin_arm64=myapp-{{version}}-darwin-arm64.zip
darwin_amd64=myapp-{{version}}-darwin-amd64.zip
```

Use `dry-run=true` first, then run with `dry-run=false` when ready.

## License

This project is licensed under the MIT License. See [LICENSE](./LICENSE) for details.
