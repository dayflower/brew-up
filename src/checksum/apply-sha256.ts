import type { ResolvedArtifact, ResolvedArtifacts } from "../types.js";

type Sha256Resolver = (artifact: ResolvedArtifact) => Promise<string> | string;

export async function applySha256ToResolvedArtifacts(
  resolvedArtifacts: ResolvedArtifacts,
  resolveSha256: Sha256Resolver,
): Promise<ResolvedArtifacts> {
  const artifactsWithChecksums = Object.fromEntries(
    await Promise.all(
      Object.entries(resolvedArtifacts.artifacts).map(
        async ([key, artifact]) => [
          key,
          {
            ...artifact,
            sha256: await resolveSha256(artifact),
          },
        ],
      ),
    ),
  );

  return {
    artifacts: artifactsWithChecksums,
    artifact: resolvedArtifacts.artifact
      ? artifactsWithChecksums[resolvedArtifacts.artifact.key]
      : undefined,
  };
}
