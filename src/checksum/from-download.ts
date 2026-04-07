import { createHash } from "node:crypto";
import { BrewUpError } from "../errors.js";
import type { ResolvedArtifacts } from "../types.js";

async function calculateSha256FromUrl(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new BrewUpError(
      "CHECKSUM_FETCH_FAILED",
      `Failed to download artifact from "${url}" for checksum calculation.`,
      `HTTP status: ${response.status}`,
    );
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const hash = createHash("sha256");
  hash.update(buffer);
  return hash.digest("hex");
}

export async function resolveChecksumsFromDownload(
  resolvedArtifacts: ResolvedArtifacts,
): Promise<ResolvedArtifacts> {
  const artifactsWithChecksums = Object.fromEntries(
    await Promise.all(
      Object.entries(resolvedArtifacts.artifacts).map(async ([key, artifact]) => [
        key,
        {
          ...artifact,
          sha256: await calculateSha256FromUrl(artifact.url),
        },
      ]),
    ),
  );

  const artifact = resolvedArtifacts.artifact
    ? artifactsWithChecksums[resolvedArtifacts.artifact.key]
    : undefined;

  return {
    artifacts: artifactsWithChecksums,
    artifact,
  };
}
