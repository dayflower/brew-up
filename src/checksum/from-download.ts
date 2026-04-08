import { createHash } from "node:crypto";
import type { ResolvedArtifacts } from "../types.js";
import { applySha256ToResolvedArtifacts } from "./apply-sha256.js";
import { fetchWithRetry } from "./fetch-retry.js";

async function calculateSha256FromUrl(
  name: string,
  url: string,
): Promise<string> {
  const response = await fetchWithRetry(
    url,
    `artifact "${name}" from "${url}" for checksum calculation`,
  );

  const hash = createHash("sha256");

  // Stream response chunks to avoid keeping full artifacts in memory.
  if (response.body) {
    const reader = response.body.getReader();

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (value) {
        hash.update(value);
      }
    }

    return hash.digest("hex");
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  hash.update(buffer);
  return hash.digest("hex");
}

export async function resolveChecksumsFromDownload(
  resolvedArtifacts: ResolvedArtifacts,
): Promise<ResolvedArtifacts> {
  return applySha256ToResolvedArtifacts(resolvedArtifacts, (artifact) =>
    calculateSha256FromUrl(artifact.name, artifact.url),
  );
}
