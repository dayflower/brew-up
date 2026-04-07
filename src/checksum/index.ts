import type { ResolvedArtifacts, ResolvedRelease } from "../types.js";
import { resolveChecksumsFromAsset } from "./from-asset.js";
import { resolveChecksumsFromDownload } from "./from-download.js";

interface ResolveChecksumsInput {
  checksumAsset?: string;
  release: ResolvedRelease;
  resolvedArtifacts: ResolvedArtifacts;
}

export async function resolveChecksums({
  checksumAsset,
  release,
  resolvedArtifacts,
}: ResolveChecksumsInput): Promise<ResolvedArtifacts> {
  if (checksumAsset) {
    return resolveChecksumsFromAsset(
      checksumAsset,
      release.assets,
      resolvedArtifacts,
    );
  }

  return resolveChecksumsFromDownload(resolvedArtifacts);
}
