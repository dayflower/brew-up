# Homebrew Tap Update Action Implementation Plan

## 1. Scope and Delivery Strategy

This plan implements a TypeScript-based JavaScript GitHub Action that:

- runs in source repository,
- resolves one release from source repository,
- resolves release assets and SHA-256 checksums,
- renders one file from one template,
- writes the result to tap repository,
- supports `direct`, `pr`, and `pr-auto-merge` publish modes,
- skips write operations when output is unchanged,
- supports `dry-run` mode,
- fails fast on validation errors.

Non-goals from `SPEC.md` are intentionally excluded from this plan.

## 2. Architecture Overview

Implement the action as a pipeline of isolated modules with a thin orchestration layer:

1. Input and validation layer
2. Release resolver
3. Asset resolver
4. Checksum resolver
5. Template renderer
6. Target repository writer (direct / PR / PR auto-merge)
7. Change detector and dry-run gate
8. Outputs and workflow summary emitter

### Proposed package/module layout

- `src/main.ts`: GitHub Action entrypoint and top-level orchestration
- `src/config/input.ts`: read and normalize action inputs
- `src/config/validate.ts`: input and mode validation
- `src/github/release.ts`: release resolution and release metadata fetch
- `src/github/assets.ts`: asset map parsing + asset matching
- `src/checksum/index.ts`: checksum source routing
- `src/checksum/from-asset.ts`: checksum lookup from `checksum-asset`
- `src/checksum/from-download.ts`: direct download + SHA-256 calculation
- `src/template/render.ts`: logic-less template rendering + unresolved variable checks
- `src/target/repo.ts`: checkout/access preparation for tap repository
- `src/target/change.ts`: file diff / changed detection
- `src/target/publish-direct.ts`: direct commit and push flow
- `src/target/publish-pr.ts`: branch, commit, push, PR creation
- `src/target/auto-merge.ts`: enable native auto-merge and verify success
- `src/output/result.ts`: action outputs
- `src/output/summary.ts`: workflow summary markdown
- `src/types.ts`: shared domain types
- `src/errors.ts`: typed domain errors mapped to actionable messages

Keep side effects inside GitHub/repository modules; keep business logic pure where possible.

## 3. Input Contract and Validation Plan

### 3.1 Action inputs to implement

- `release-id` (optional)
- `release-tag` (optional)
- `template-path` (required)
- `output-path` (required)
- `asset-map` (required)
- `checksum-asset` (optional)
- `target-repo` (required)
- `target-branch` (required)
- `target-repo-token` (required)
- `publish-mode` (required: `direct` | `pr` | `pr-auto-merge`)
- `auto-merge-method` (optional: `merge` | `squash` | `rebase`; default `merge`; used only for `pr-auto-merge`)
- `only-if-changed` (optional, default `true`)
- `dry-run` (optional, default `false`)
- `commit-author-name` (optional)
- `commit-author-email` (optional)
- optional branch naming helper input (for package/name identifier)

### 3.2 Validation rules

- reject invalid `publish-mode`
- reject invalid `auto-merge-method` only when `publish-mode=pr-auto-merge`
- reject missing required inputs
- validate `target-repo` format `owner/name`
- validate `asset-map` parseability and non-empty keys/values
- if one of `commit-author-name` / `commit-author-email` is set alone, fail (enforce paired behavior)
- normalize booleans strictly (`true`/`false` semantics)

Validation must complete before any mutation in tap repository.

## 4. Release and Asset Resolution Plan

### 4.1 Release resolution

Implement strict resolution order:

1. `release-id`
2. `release-tag`
3. `github.event.release.id`
4. `github.event.release.tag_name`

If unresolved, fail with a clear message listing attempted sources.

### 4.2 Asset-map parsing

- parse newline-delimited `key=value`
- trim whitespace
- reject duplicate keys
- allow opaque keys (no platform-specific logic)

### 4.3 Asset matching

- if pattern contains no `*`, exact match
- if pattern contains `*`, glob match
- each key must resolve to exactly one asset; otherwise fail

### 4.4 Artifact model

Build:

- `artifacts.<key>.name`
- `artifacts.<key>.url`
- `artifacts.<key>.sha256`

If exactly one key exists, also set `artifact.*` alias.

## 5. Checksum Resolution Plan

### 5.1 Strategy selection

- when `checksum-asset` exists: mandatory checksum-file mode
- otherwise: download each resolved artifact and compute SHA-256

No silent fallback from checksum-file mode to download mode.

### 5.2 Checksum-file mode

- locate checksum asset by exact name (or explicitly documented matching behavior)
- download and parse checksum lines robustly
- map each resolved artifact to one checksum entry
- fail on missing checksum for any resolved artifact

### 5.3 Download mode

- stream-download each asset
- compute SHA-256 in a memory-safe manner
- include retries/backoff for transient network failures where feasible

## 6. Template Rendering Plan

- use a logic-less template engine compatible with simple variable interpolation
- render from `template-path` in source repository
- detect unresolved placeholders after rendering and fail if any remain
- write rendered content to in-memory buffer first (do not mutate target yet)

Template context includes release variables, `artifacts.*`, and optional `artifact.*` alias.

## 7. Tap Repository and Publish Plan

### 7.1 Tap repository access

- authenticate with `target-repo-token`
- checkout or clone tap repository into a dedicated workspace path
- checkout `target-branch` or fail if inaccessible

### 7.2 Change detection

- compare existing `output-path` content and rendered content
- set `changed=false` when equal
- if unchanged and `only-if-changed=true`, exit success without commit/PR

### 7.3 Dry-run behavior

When `dry-run=true`, perform all resolution/render/comparison steps, set outputs and summary, then exit before any mutation.

### 7.4 Publish modes

- `direct`: commit to `target-branch`, push
- `pr`: create working branch `brew-up/<name>/<version-or-tag>-<run_id>`, commit, push, open PR
- `pr-auto-merge`: same as `pr`, then request native GitHub auto-merge; fail if auto-merge enablement fails

### 7.5 Commit author handling

- if both author inputs exist, set explicit author
- else rely on environment defaults

## 8. Outputs and Summary Plan

Implement outputs:

- `changed`
- `target-commit-sha` (when commit exists)
- `pull-request-number` (when PR exists)
- `pull-request-url` (when PR exists)
- `resolved-release-id`
- `resolved-release-tag`

Generate workflow summary including:

- resolved release details
- resolved assets and URLs
- checksum source
- changed/unchanged result
- commit/PR/auto-merge result

## 9. Error Handling and Observability

- use typed errors with user-facing remediation hints
- fail fast on spec-defined validation cases
- keep logs structured by phase for troubleshooting
- ensure no partial write in failed pre-publish phases

## 10. Testing Plan

### 10.1 Unit tests

- release resolution order
- asset-map parser edge cases
- exact vs glob matching and ambiguity failures
- checksum parser behavior and missing checksum failures
- unresolved template variable detection
- branch name generation and sanitization

### 10.2 Integration tests (mocked GitHub API)

- happy path for each publish mode
- unchanged output short-circuit
- dry-run short-circuit
- `checksum-asset` mode success/failure
- auto-merge enable success/failure

### 10.3 End-to-end smoke workflow

Run in a test repository pair (A/B) with a fixture release to validate real token permissions, PR creation, and auto-merge behavior.

## 11. Incremental Milestones

### Milestone 1: Foundation

- action scaffold, input loading, validation, typed errors
- release resolver + asset resolver
- unit tests for parsing/resolution

Exit criteria: release + artifacts are resolved deterministically with test coverage.

### Milestone 2: Checksums and templating

- checksum modes (`checksum-asset` and download)
- template rendering and unresolved-variable validation
- unit/integration tests

Exit criteria: rendered output is fully materialized with complete checksums.

### Milestone 3: Target repo writeback

- repo B checkout/access
- change detection + dry-run
- direct publish mode

Exit criteria: direct mode works safely with unchanged and dry-run behavior.

### Milestone 4: PR and auto-merge flows

- `pr` mode branch/PR creation
- `pr-auto-merge` enablement and failure handling
- outputs and summary finalization

Exit criteria: all publish modes satisfy spec requirements.

### Milestone 5: Hardening

- end-to-end smoke workflow
- retry/error message improvements
- documentation cleanup (`README` usage examples)

Exit criteria: production-ready action with clear operational guidance.

## 12. Risks and Mitigations

- API permission mismatches (token scopes): document required permissions and validate early.
- Ambiguous glob patterns in real releases: enforce strict one-match rule with explicit diagnostics.
- Auto-merge policy constraints: surface repository-policy failure reasons directly.
- Network instability for asset downloads: add retry strategy and bounded timeout.
- Template drift/unresolved tokens: fail loudly and include unresolved token names.

## 13. Definition of Done

The implementation is complete when:

- all spec-mandated validation failures are enforced,
- all three publish modes work as specified,
- unchanged and dry-run behavior prevent mutations correctly,
- required outputs and workflow summary are emitted,
- test suite covers core logic and critical failure paths,
- documentation explains setup, inputs, and examples for each publish mode.
