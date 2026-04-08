# AGENTS

## Project Purpose
`brew-up` is a GitHub Action that generates and publishes a Homebrew tap file from release assets.
It resolves a release, maps assets, injects checksums, and writes the rendered output to a target tap repository.

## Setup and Commands
- `npm install`
- `npm run build`
- `npm run test`
- `npm run lint`
- `npm run lint:fix`
- `npm run format`
- `npm run format:check`
- `npm run check`

## Source of Truth
- Specification: `docs/SPEC.md`
- Implementation plan: `docs/PLAN.md`
- Action inputs and runtime entrypoint: `action.yml`

## Coding Rules
- Use TypeScript for implementation changes.
- Preserve existing project style and conventions.
- Avoid unnecessary large refactors.
- Keep changes tightly scoped to the task objective.
- Prefer `npm run lint:fix` when automatic fixes are needed.
- Use `npm run format` for formatting and `npm run format:check` for CI/verification.

## Commit Rule
- Commit message must be a single-line title.
- Do not add body paragraphs.
- Add one blank line after the title, then add:
  `Co-authored-by: codex <codex@openai.com>`

## Safety
- Do not run destructive Git operations such as `git reset --hard` unless explicitly requested.
- Do not revert unrelated existing workspace changes.
