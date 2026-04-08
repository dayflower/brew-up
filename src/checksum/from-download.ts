import { createHash } from "node:crypto";
import type { ResolvedArtifacts } from "../types.js";
import { fetchWithRetry } from "./fetch-retry.js";

async function calculateSha256FromUrl(
  name: string,
  url: string,
): Promise<string> {
  const response = await fetchWithRetry(
    url,
    `artifact "${name}" from "${url}" for checksum calculation`,
  );

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
      Object.entries(resolvedArtifacts.artifacts).map(
        async ([key, artifact]) => [
          key,
          {
            ...artifact,
            sha256: await calculateSha256FromUrl(artifact.name, artifact.url),
          },
        ],
      ),
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
