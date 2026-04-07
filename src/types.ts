export type PublishMode = 'direct' | 'pr' | 'pr-auto-merge';

export interface RawInputs {
  releaseId: string;
  releaseTag: string;
  templatePath: string;
  outputPath: string;
  assetMap: string;
  checksumAsset: string;
  targetRepo: string;
  targetBranch: string;
  targetRepoToken: string;
  publishMode: string;
  onlyIfChanged: string;
  dryRun: string;
  commitAuthorName: string;
  commitAuthorEmail: string;
}

export interface AssetMapEntry {
  key: string;
  pattern: string;
}

export interface ValidatedInputs {
  releaseId?: number;
  releaseTag?: string;
  templatePath: string;
  outputPath: string;
  assetMapEntries: AssetMapEntry[];
  checksumAsset?: string;
  targetRepo: {
    owner: string;
    name: string;
    fullName: string;
  };
  targetBranch: string;
  targetRepoToken: string;
  publishMode: PublishMode;
  onlyIfChanged: boolean;
  dryRun: boolean;
  commitAuthor?: {
    name: string;
    email: string;
  };
}

export interface SourceReleaseContext {
  owner: string;
  repo: string;
  eventReleaseId?: number;
  eventReleaseTag?: string;
}

export interface ReleaseAsset {
  id: number;
  name: string;
  browserDownloadUrl: string;
  apiUrl: string;
}

export interface ResolvedRelease {
  id: number;
  tagName: string;
  name: string;
  url: string;
  version: string;
  assets: ReleaseAsset[];
}

export interface ResolvedArtifact {
  key: string;
  name: string;
  url: string;
  apiUrl: string;
}

export interface ResolvedArtifacts {
  artifacts: Record<string, ResolvedArtifact>;
  artifact?: ResolvedArtifact;
}

export interface ReleaseTemplateVariables {
  version: string;
  tag_name: string;
  release_id: string;
  release_name: string;
  release_url: string;
}
