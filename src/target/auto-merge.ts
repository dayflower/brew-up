import { BrewUpError } from "../errors.js";

interface AutoMergeClient {
  graphql<T>(query: string, variables: Record<string, unknown>): Promise<T>;
}

interface EnableAutoMergeResponse {
  enablePullRequestAutoMerge: {
    pullRequest: {
      number: number;
      autoMergeRequest: {
        enabledAt: string;
      } | null;
    } | null;
  } | null;
}

const ENABLE_AUTO_MERGE_MUTATION = `
mutation EnableAutoMerge($pullRequestId: ID!) {
  enablePullRequestAutoMerge(input: { pullRequestId: $pullRequestId, mergeMethod: MERGE }) {
    pullRequest {
      number
      autoMergeRequest {
        enabledAt
      }
    }
  }
}
`;

export async function enableAutoMerge(
  client: AutoMergeClient,
  pullRequestNodeId: string,
): Promise<void> {
  try {
    const result = await client.graphql<EnableAutoMergeResponse>(
      ENABLE_AUTO_MERGE_MUTATION,
      {
        pullRequestId: pullRequestNodeId,
      },
    );

    if (!result.enablePullRequestAutoMerge?.pullRequest?.autoMergeRequest) {
      throw new BrewUpError(
        "AUTO_MERGE_ENABLE_FAILED",
        "Failed to enable pull request auto-merge.",
      );
    }
  } catch (error) {
    if (error instanceof BrewUpError) {
      throw error;
    }
    throw new BrewUpError(
      "AUTO_MERGE_ENABLE_FAILED",
      "Failed to enable pull request auto-merge.",
      error instanceof Error ? error.message : undefined,
    );
  }
}
