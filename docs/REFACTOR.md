# REFACTOR Plan for `brew-up` (Incremental)

## Summary
This refactor plan improves maintainability and safety without changing external behavior.
Work is split into small, test-verified steps, prioritizing memory safety in checksum calculation, duplication removal, and clearer orchestration in `main`.

## Implementation Changes

### 1) Checksum streaming and shared mapping utilities
- Replace full-buffer checksum computation in `src/checksum/from-download.ts` with streaming hash calculation to avoid loading full assets into memory.
- Introduce a shared helper in `src/checksum` to apply SHA-256 values to `ResolvedArtifacts` and preserve `artifact` alias consistency.
- Refactor `src/checksum/from-asset.ts` and `src/checksum/from-download.ts` to use the shared helper and remove duplicated reconstruction logic.

### 2) Main orchestration simplification
- Extract summary input construction in `src/main.ts` into a single helper used by all branches.
- Consolidate skip-path handling (`unchanged + only-if-changed`, `dry-run`) into a small decision helper to reduce branch duplication.
- Keep publish mode behavior unchanged (`direct`, `pr`, `pr-auto-merge`) while reducing cognitive load of the `run` function.

### 3) Target publish flow deduplication
- Extract a common commit message builder for publish modules.
- Extract a shared file-write request builder for `createOrUpdateFileContents` input shape used by both direct and PR paths.
- Keep branch-name generation logic in PR module, but isolate it from API side effects for easier unit testing.

### 4) Test suite maintainability improvements
- Split large orchestration test (`test/main.milestone2.test.ts`) into scenario-focused blocks with shared fixture factories.
- Add focused tests for streaming checksum behavior (large payload simulation and success/failure parity with existing behavior).
- Keep existing coverage expectations while reducing test setup duplication.

## Public Interfaces and Types
- No changes to action inputs, outputs, or documented behavior in `action.yml`.
- No changes to publish mode semantics or release/asset resolution rules.
- Internal utility-level type additions are allowed if they reduce duplication (for example, checksum mapper helper types), but exported external contracts should remain stable.

## Test Plan

### 1) Baseline verification after each step
- Run `npm run test`, `npm run check`, and `npm run build` after each incremental slice.

### 2) New and updated test scenarios
- Checksum download path computes SHA-256 via stream and still retries transient failures.
- Checksum asset path still enforces parse rules and ambiguity/missing-entry errors.
- Main flow still:
  - Skips on unchanged output when `only-if-changed=true`.
  - Skips publish on `dry-run=true`.
  - Publishes correctly in `direct`, `pr`, and `pr-auto-merge`.

### 3) Regression gates
- Ensure all existing tests pass without changing expected output fields or summary behavior.
- Confirm no behavior regressions in error codes/messages where tests already assert them.

## Assumptions and Defaults
- Refactor is behavior-preserving; no feature additions are in scope.
- Incremental rollout is preferred over a single large rewrite.
- This document is maintained in English per repository documentation conventions.
- Commit creation is explicitly out of scope for this task.
