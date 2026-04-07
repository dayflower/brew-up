import { BrewUpError } from "../errors";
import type {
  AssetMapEntry,
  ReleaseAsset,
  ReleaseTemplateVariables,
  ResolvedArtifact,
  ResolvedArtifacts,
} from "../types";

const TEMPLATE_VAR_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function patternToRegExp(pattern: string): RegExp {
  const escaped = escapeRegExp(pattern).replace(/\\\*/g, ".*");
  return new RegExp(`^${escaped}$`);
}

function matchAsset(pattern: string, assets: ReleaseAsset[]): ReleaseAsset[] {
  if (!pattern.includes("*")) {
    return assets.filter((asset) => asset.name === pattern);
  }

  const regexp = patternToRegExp(pattern);
  return assets.filter((asset) => regexp.test(asset.name));
}

export function parseAssetMap(input: string): AssetMapEntry[] {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    throw new BrewUpError(
      "INVALID_ASSET_MAP",
      "Input asset-map must not be empty.",
    );
  }

  const entries: AssetMapEntry[] = [];
  const seenKeys = new Set<string>();

  for (const line of lines) {
    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0 || separatorIndex === line.length - 1) {
      throw new BrewUpError(
        "INVALID_ASSET_MAP",
        `Invalid asset-map line: "${line}".`,
        "Each line must follow key=value and both key and value must be non-empty.",
      );
    }

    const key = line.slice(0, separatorIndex).trim();
    const pattern = line.slice(separatorIndex + 1).trim();

    if (key.length === 0 || pattern.length === 0) {
      throw new BrewUpError(
        "INVALID_ASSET_MAP",
        `Invalid asset-map line: "${line}".`,
        "Each line must follow key=value and both key and value must be non-empty.",
      );
    }

    if (seenKeys.has(key)) {
      throw new BrewUpError(
        "INVALID_ASSET_MAP",
        `Duplicate asset-map key: "${key}".`,
      );
    }

    seenKeys.add(key);
    entries.push({ key, pattern });
  }

  return entries;
}

export function expandAssetPattern(
  pattern: string,
  variables: ReleaseTemplateVariables,
): string {
  return pattern.replace(
    TEMPLATE_VAR_PATTERN,
    (_match, variableName: string) => {
      const key = variableName as keyof ReleaseTemplateVariables;
      if (!(key in variables)) {
        throw new BrewUpError(
          "INVALID_ASSET_MAP",
          `asset-map references unknown variable "${variableName}".`,
        );
      }

      return variables[key];
    },
  );
}

export function resolveArtifacts(
  entries: AssetMapEntry[],
  assets: ReleaseAsset[],
  variables: ReleaseTemplateVariables,
): ResolvedArtifacts {
  const artifacts: Record<string, ResolvedArtifact> = {};

  for (const entry of entries) {
    const expandedPattern = expandAssetPattern(entry.pattern, variables);
    const matches = matchAsset(expandedPattern, assets);

    if (matches.length === 0) {
      throw new BrewUpError(
        "ASSET_NOT_FOUND",
        `Asset key "${entry.key}" matched no release assets.`,
        `Expanded pattern: "${expandedPattern}"`,
      );
    }

    if (matches.length > 1) {
      const names = matches.map((asset) => asset.name).join(", ");
      throw new BrewUpError(
        "ASSET_AMBIGUOUS",
        `Asset key "${entry.key}" matched multiple assets.`,
        `Expanded pattern: "${expandedPattern}", matches: ${names}`,
      );
    }

    const asset = matches[0];
    artifacts[entry.key] = {
      key: entry.key,
      name: asset.name,
      url: asset.browserDownloadUrl,
      apiUrl: asset.apiUrl,
    };
  }

  const values = Object.values(artifacts);
  if (values.length === 1) {
    return {
      artifacts,
      artifact: values[0],
    };
  }

  return { artifacts };
}
