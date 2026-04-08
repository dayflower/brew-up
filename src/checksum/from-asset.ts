import path from "node:path";
import { BrewUpError } from "../errors.js";
import type { ResolvedArtifacts, ReleaseAsset } from "../types.js";
import { fetchWithRetry } from "./fetch-retry.js";

interface ChecksumAssetEntry {
  fileName: string;
  sha256: string;
}

const GNU_SHA256_LINE = /^([a-fA-F0-9]{64})\s\s?\*?(.+)$/;
const BSD_SHA256_LINE = /^SHA256\s+\((.+)\)\s+=\s+([a-fA-F0-9]{64})$/i;

function parseChecksumLine(line: string): ChecksumAssetEntry | undefined {
  const trimmed = line.trim();
  if (trimmed.length === 0 || trimmed.startsWith("#")) {
    return undefined;
  }

  const gnuMatch = GNU_SHA256_LINE.exec(trimmed);
  if (gnuMatch) {
    return {
      fileName: gnuMatch[2].trim(),
      sha256: gnuMatch[1].toLowerCase(),
    };
  }

  const bsdMatch = BSD_SHA256_LINE.exec(trimmed);
  if (bsdMatch) {
    return {
      fileName: bsdMatch[1].trim(),
      sha256: bsdMatch[2].toLowerCase(),
    };
  }

  throw new BrewUpError(
    "CHECKSUM_PARSE_FAILED",
    `Invalid checksum line format: "${line}".`,
    "Supported formats: '<sha256>  <file>' and 'SHA256 (<file>) = <sha256>'.",
  );
}

function parseChecksumEntries(content: string): ChecksumAssetEntry[] {
  return content
    .split(/\r?\n/)
    .map((line) => parseChecksumLine(line))
    .filter((entry): entry is ChecksumAssetEntry => entry !== undefined);
}

function resolveChecksumForArtifact(
  artifactName: string,
  checksumEntries: ChecksumAssetEntry[],
): string {
  const exactMatches = checksumEntries.filter(
    (entry) => entry.fileName === artifactName,
  );
  if (exactMatches.length > 1) {
    throw new BrewUpError(
      "CHECKSUM_AMBIGUOUS",
      `Multiple checksum entries matched artifact "${artifactName}" by exact name.`,
    );
  }
  if (exactMatches.length === 1) {
    return exactMatches[0].sha256;
  }

  const baseNameMatches = checksumEntries.filter(
    (entry) => path.basename(entry.fileName) === artifactName,
  );
  if (baseNameMatches.length > 1) {
    throw new BrewUpError(
      "CHECKSUM_AMBIGUOUS",
      `Multiple checksum entries matched artifact "${artifactName}" by basename.`,
    );
  }
  if (baseNameMatches.length === 1) {
    return baseNameMatches[0].sha256;
  }

  throw new BrewUpError(
    "CHECKSUM_NOT_FOUND",
    `Checksum entry not found for artifact "${artifactName}".`,
  );
}

async function fetchChecksumAssetText(
  checksumAsset: ReleaseAsset,
): Promise<string> {
  const response = await fetchWithRetry(
    checksumAsset.browserDownloadUrl,
    `checksum asset "${checksumAsset.name}" from "${checksumAsset.browserDownloadUrl}"`,
  );

  return response.text();
}

export async function resolveChecksumsFromAsset(
  checksumAssetName: string,
  releaseAssets: ReleaseAsset[],
  resolvedArtifacts: ResolvedArtifacts,
): Promise<ResolvedArtifacts> {
  const checksumAsset = releaseAssets.find(
    (asset) => asset.name === checksumAssetName,
  );
  if (!checksumAsset) {
    throw new BrewUpError(
      "CHECKSUM_ASSET_NOT_FOUND",
      `checksum-asset "${checksumAssetName}" was not found in the release assets.`,
    );
  }

  const checksumContent = await fetchChecksumAssetText(checksumAsset);
  const checksumEntries = parseChecksumEntries(checksumContent);

  if (checksumEntries.length === 0) {
    throw new BrewUpError(
      "CHECKSUM_PARSE_FAILED",
      `checksum-asset "${checksumAssetName}" contains no checksum entries.`,
    );
  }

  const artifactsWithChecksums = Object.fromEntries(
    Object.entries(resolvedArtifacts.artifacts).map(([key, artifact]) => [
      key,
      {
        ...artifact,
        sha256: resolveChecksumForArtifact(artifact.name, checksumEntries),
      },
    ]),
  );

  const artifact = resolvedArtifacts.artifact
    ? artifactsWithChecksums[resolvedArtifacts.artifact.key]
    : undefined;

  return {
    artifacts: artifactsWithChecksums,
    artifact,
  };
}
