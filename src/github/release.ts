import { BrewUpError } from '../errors';
import type {
  ReleaseAsset,
  ResolvedRelease,
  SourceReleaseContext,
  ValidatedInputs
} from '../types';

interface ReleaseApiAsset {
  id: number;
  name: string;
  browser_download_url: string;
  url: string;
}

interface ReleaseApiResponse {
  id: number;
  tag_name: string;
  name: string | null;
  html_url: string;
  assets: ReleaseApiAsset[];
}

interface ReleaseApiClient {
  rest: {
    repos: {
      getRelease(params: {
        owner: string;
        repo: string;
        release_id: number;
      }): Promise<{ data: ReleaseApiResponse }>;
      getReleaseByTag(params: {
        owner: string;
        repo: string;
        tag: string;
      }): Promise<{ data: ReleaseApiResponse }>;
    };
  };
}

function toReleaseAsset(asset: ReleaseApiAsset): ReleaseAsset {
  return {
    id: asset.id,
    name: asset.name,
    browserDownloadUrl: asset.browser_download_url,
    apiUrl: asset.url
  };
}

function toResolvedRelease(release: ReleaseApiResponse): ResolvedRelease {
  const tagName = release.tag_name;
  return {
    id: release.id,
    tagName,
    name: release.name ?? tagName,
    url: release.html_url,
    version: tagName.startsWith('v') ? tagName.slice(1) : tagName,
    assets: release.assets.map(toReleaseAsset)
  };
}

async function resolveById(
  client: ReleaseApiClient,
  owner: string,
  repo: string,
  releaseId: number
): Promise<ResolvedRelease> {
  try {
    const response = await client.rest.repos.getRelease({
      owner,
      repo,
      release_id: releaseId
    });
    return toResolvedRelease(response.data);
  } catch (error) {
    throw new BrewUpError(
      'RELEASE_LOOKUP_FAILED',
      `Failed to resolve release by id: ${releaseId}.`,
      error instanceof Error ? error.message : undefined
    );
  }
}

async function resolveByTag(
  client: ReleaseApiClient,
  owner: string,
  repo: string,
  tag: string
): Promise<ResolvedRelease> {
  try {
    const response = await client.rest.repos.getReleaseByTag({
      owner,
      repo,
      tag
    });
    return toResolvedRelease(response.data);
  } catch (error) {
    throw new BrewUpError(
      'RELEASE_LOOKUP_FAILED',
      `Failed to resolve release by tag: ${tag}.`,
      error instanceof Error ? error.message : undefined
    );
  }
}

export async function resolveRelease(
  client: ReleaseApiClient,
  source: SourceReleaseContext,
  config: Pick<ValidatedInputs, 'releaseId' | 'releaseTag'>
): Promise<ResolvedRelease> {
  const owner = source.owner;
  const repo = source.repo;

  if (config.releaseId !== undefined) {
    return resolveById(client, owner, repo, config.releaseId);
  }

  if (config.releaseTag !== undefined) {
    return resolveByTag(client, owner, repo, config.releaseTag);
  }

  if (source.eventReleaseId !== undefined) {
    return resolveById(client, owner, repo, source.eventReleaseId);
  }

  if (source.eventReleaseTag !== undefined) {
    return resolveByTag(client, owner, repo, source.eventReleaseTag);
  }

  throw new BrewUpError(
    'RELEASE_NOT_RESOLVED',
    'Release could not be resolved from inputs or event payload.',
    'Tried release-id, release-tag, github.event.release.id, github.event.release.tag_name.'
  );
}
