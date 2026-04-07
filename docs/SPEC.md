# Homebrew Tap Update GitHub Action Specification

## Overview

This action automates the process of updating a Homebrew tap repository from release artifacts produced in a source repository.
It is intended for workflows where an application repository publishes release assets, then generates a Homebrew-related file from a template and writes that file into a separate tap repository.

This specification uses the following terms:

- repository A: the source repository that contains the macOS application code, release workflow, and file template
- repository B: the target repository that contains Homebrew tap files such as Casks or Formulae

The action runs from repository A.
It generates a single output file from a template stored in repository A, then writes that file into repository B.

The action is intended to be used after a GitHub Release in repository A has already been created and populated with release assets.

## Goals

- Generate one file from a template checked out in repository A.
- Resolve release assets from a GitHub Release in repository A.
- Inject asset URLs and SHA-256 checksums into template variables.
- Support both single-artifact and multi-artifact layouts.
- Write the generated file into repository B.
- Support direct push, pull request creation, and pull request with auto-merge.
- Avoid creating commits or pull requests when the generated file is unchanged.
- Support dry-run execution.
- Remain extensible for future Linux and Windows artifacts without changing the core model.

## Non-Goals

- Generating more than one output file in a single action invocation.
- Distinguishing Cask vs Formula as separate action concepts.
- Providing template-side control flow beyond a logic-less template engine.
- Silently ignoring missing assets or ambiguous asset resolution.

## Execution Model

The action is a JavaScript GitHub Action implemented in TypeScript.

It assumes:

- repository A has already been checked out in the workflow workspace.
- the template file is available in the checked-out contents of repository A.
- a GitHub Release already exists in repository A.
- repository B can be accessed using a user-provided token, typically from GitHub Actions secrets.

## Release Resolution

The action supports multiple ways to identify the release in repository A.

### Inputs

- `release-id` (optional)
- `release-tag` (optional)

### Resolution Order

The action resolves the release using the following order:

1. `release-id`
2. `release-tag`
3. `github.event.release.id`
4. `github.event.release.tag_name`

If none of the above are available, the action must fail.

### Draft and Prerelease Support

Draft releases and prereleases are allowed.
They are not treated differently by the action, as long as the release can be resolved through the rules above.

## Template Model

The action reads a single template file from repository A and renders one output file.

### Template Engine

A logic-less template engine is used.
The template itself may contain static text blocks for platform-specific sections, but the engine does not provide control flow.

### Inputs

- `template-path`: path to the template file in repository A
- `output-path`: path to the generated file in repository B

## Artifact Resolution

Artifacts are resolved from the release assets attached to the selected GitHub Release.

### Input

- `asset-map`: newline-delimited key/value pairs

Example:

```text
default=myapp-{{version}}.zip
darwin_arm64=myapp-{{version}}-darwin-arm64.zip
darwin_amd64=myapp-{{version}}-darwin-amd64.zip
linux_amd64=myapp-{{version}}-linux-amd64.tar.gz
windows_amd64=myapp-{{version}}-windows-amd64.zip
```

The value side is a pattern used to resolve a release asset.

### Matching Rules

- If the value contains no `*`, it is treated as an exact asset name match.
- If the value contains `*`, it is treated as a glob pattern.
- Each key must resolve to exactly one asset.
- If a key resolves to zero assets, the action must fail.
- If a key resolves to more than one asset, the action must fail.

### Platform Key Model

The action treats artifact keys as opaque identifiers.
It does not hardcode platform or architecture semantics.

Recommended naming convention:

- `default`
- `darwin_universal`
- `darwin_arm64`
- `darwin_amd64`
- `linux_arm64`
- `linux_amd64`
- `windows_arm64`
- `windows_amd64`

This keeps the implementation generic while allowing future expansion to Linux and Windows.

### Single-Artifact Alias

If exactly one artifact key is defined in `asset-map`, the action also exposes a convenience alias named `artifact`.

This allows simple templates to use:

- `artifact.name`
- `artifact.url`
- `artifact.sha256`

instead of requiring `artifacts.<key>.*`.

## Checksum Resolution

The action always injects SHA-256 checksums.

### Input

- `checksum-asset` (optional)

### Behavior

- If `checksum-asset` is specified, the action must locate that release asset and obtain checksums from it.
- If `checksum-asset` is specified but the asset cannot be found, the action must fail.
- If `checksum-asset` is not specified, the action must download each resolved asset and calculate its SHA-256 checksum directly.

Checksum lookup from `checksum-asset` is optional behavior, but once requested it is mandatory and must not silently fall back to direct download.

## Template Variables

The action provides the following template variables.

### Release Variables

- `version`
- `tag_name`
- `release_id`
- `release_name`
- `release_url`

### Artifact Variables

For each resolved artifact key:

- `artifacts.<key>.name`
- `artifacts.<key>.url`
- `artifacts.<key>.sha256`

If and only if exactly one artifact key exists:

- `artifact.name`
- `artifact.url`
- `artifact.sha256`

## Target Repository Writeback

The action writes the generated file into repository B.

### Inputs

- `target-repo`: repository B in `owner/name` format
- `target-branch`: target branch in repository B, typically `main`
- `target-repo-token`: token used to write to repository B

Supported token types:

- classic personal access token
- fine-grained personal access token

### Branch Naming

For pull request modes, the action creates a working branch using this shape:

`brew-up/<package-or-name>/<version-or-tag>-<github-run-id>`

If a package name input exists, it should be used.
Otherwise, another stable identifier may be used.
The final segment should include `github.run_id` to reduce collision risk and improve traceability.

## Publish Modes

### Input

- `publish-mode`

Allowed values:

- `direct`
- `pr`
- `pr-auto-merge`

### `direct`

- Commit the generated file directly to `target-branch`
- Push directly to repository B

### `pr`

- Create a working branch in repository B
- Commit and push the generated file to that branch
- Open a pull request targeting `target-branch`

### `pr-auto-merge`

- Create a working branch in repository B
- Commit and push the generated file to that branch
- Open a pull request targeting `target-branch`
- Enable GitHub auto-merge for that pull request

This mode relies on GitHub's native auto-merge capability rather than attempting immediate merge through the API.

## Auto-Merge Policy

For `pr-auto-merge`, the action must:

1. create the pull request
2. request native GitHub auto-merge on that pull request
3. fail if auto-merge cannot be enabled

This design is preferred because it works more cleanly with branch protection, required checks, and repository policy than forcing an immediate merge.

## Change Detection

### Input

- `only-if-changed` (default: `true`)

### Behavior

- The action checks whether the generated file differs from the current file in repository B.
- If there is no content change and `only-if-changed=true`, the action exits successfully without creating a commit, push, or pull request.
- If there is a content change, normal publishing behavior continues.

## Dry Run

### Input

- `dry-run` (default: `false`)

### Behavior

When `dry-run=true`:

- the action resolves the release
- resolves assets
- resolves checksums
- renders the output file
- computes whether the target file would change

It must not:

- push commits
- create branches
- create pull requests
- enable auto-merge

Dry-run should still surface validation failures, including missing assets, ambiguous asset matches, unresolved template variables, or checksum lookup failures.

## Commit Author Behavior

### Inputs

- `commit-author-name` (optional)
- `commit-author-email` (optional)

### Behavior

If both are provided, the action uses them for the commit author identity.

If they are not provided, the action does not override the commit author explicitly and may rely on the authenticated Git configuration or token-associated defaults in the workflow environment.

## Validation Rules

The action must fail in the following cases:

- no release can be resolved
- an asset map entry resolves to zero assets
- an asset map entry resolves to more than one asset
- `checksum-asset` is specified but cannot be found
- a checksum required for a resolved artifact cannot be found in the checksum asset
- template rendering leaves unresolved variables
- `publish-mode` is invalid
- repository B cannot be accessed or updated as required
- auto-merge cannot be enabled in `pr-auto-merge` mode

## Recommended Outputs

The action should expose outputs for downstream workflow use.

Recommended outputs:

- `changed`: `true` or `false`
- `target-commit-sha`: commit SHA if a commit was created
- `pull-request-number`: PR number if a PR was created
- `pull-request-url`: PR URL if a PR was created
- `resolved-release-id`
- `resolved-release-tag`

## Recommended Operational Behavior

- Validate all required inputs before mutating repository B.
- Emit a workflow summary describing:
  - resolved release
  - resolved asset names
  - resolved URLs
  - checksum source
  - whether the output changed
  - resulting commit or pull request details
- Treat unchanged output as success, not as failure.
- Keep all write operations after validation and rendering steps.

## Example High-Level Flow

1. Resolve release from explicit input or event context.
2. Fetch release asset metadata from repository A.
3. Resolve each `asset-map` entry to exactly one asset.
4. Resolve SHA-256 values from `checksum-asset` or direct downloads.
5. Render the template from repository A.
6. Check out repository B.
7. Compare rendered output with the existing target file.
8. If unchanged and `only-if-changed=true`, exit successfully.
9. If `dry-run=true`, exit successfully after reporting the planned result.
10. Otherwise publish using `direct`, `pr`, or `pr-auto-merge`.
