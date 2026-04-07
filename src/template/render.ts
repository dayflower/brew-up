import { readFile } from "node:fs/promises";
import Mustache from "mustache";
import { BrewUpError } from "../errors.js";
import type {
  ReleaseTemplateVariables,
  ResolvedArtifact,
  ResolvedArtifacts,
} from "../types.js";

const PLACEHOLDER_PATTERN = /\{\{\{?\s*([a-zA-Z0-9_.]+)\s*\}\}?\}/g;

type TemplateArtifactValue = Pick<ResolvedArtifact, "name" | "url" | "sha256">;

interface TemplateContext extends ReleaseTemplateVariables {
  artifacts: Record<string, TemplateArtifactValue>;
  artifact?: TemplateArtifactValue;
}

function hasPath(target: unknown, path: string): boolean {
  const keys = path.split(".");
  let current: unknown = target;

  for (const key of keys) {
    if (
      current === null ||
      current === undefined ||
      typeof current !== "object" ||
      !(key in current)
    ) {
      return false;
    }

    current = (current as Record<string, unknown>)[key];
  }

  return true;
}

function collectMissingVariables(
  template: string,
  context: TemplateContext,
): string[] {
  const missing = new Set<string>();

  for (const match of template.matchAll(PLACEHOLDER_PATTERN)) {
    const variableName = match[1];
    if (!hasPath(context, variableName)) {
      missing.add(variableName);
    }
  }

  return [...missing.values()].sort();
}

function buildTemplateContext(
  releaseVariables: ReleaseTemplateVariables,
  resolvedArtifacts: ResolvedArtifacts,
): TemplateContext {
  const artifacts = Object.fromEntries(
    Object.entries(resolvedArtifacts.artifacts).map(([key, artifact]) => [
      key,
      {
        name: artifact.name,
        url: artifact.url,
        sha256: artifact.sha256,
      },
    ]),
  );

  const artifact = resolvedArtifacts.artifact
    ? {
        name: resolvedArtifacts.artifact.name,
        url: resolvedArtifacts.artifact.url,
        sha256: resolvedArtifacts.artifact.sha256,
      }
    : undefined;

  return {
    ...releaseVariables,
    artifacts,
    artifact,
  };
}

export async function renderTemplate(
  templatePath: string,
  releaseVariables: ReleaseTemplateVariables,
  resolvedArtifacts: ResolvedArtifacts,
): Promise<string> {
  const template = await readFile(templatePath, "utf8");
  const context = buildTemplateContext(releaseVariables, resolvedArtifacts);

  const unresolvedBeforeRender = collectMissingVariables(template, context);
  if (unresolvedBeforeRender.length > 0) {
    throw new BrewUpError(
      "TEMPLATE_UNRESOLVED_VARIABLE",
      "Template references unresolved variables.",
      `Missing variables: ${unresolvedBeforeRender.join(", ")}`,
    );
  }

  const rendered = Mustache.render(template, context);
  const unresolvedAfterRender = [...new Set(rendered.matchAll(PLACEHOLDER_PATTERN))]
    .map((match) => match[1])
    .sort();

  if (unresolvedAfterRender.length > 0) {
    throw new BrewUpError(
      "TEMPLATE_UNRESOLVED_VARIABLE",
      "Rendered output still contains unresolved template placeholders.",
      `Remaining placeholders: ${unresolvedAfterRender.join(", ")}`,
    );
  }

  return rendered;
}
