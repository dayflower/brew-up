import { BrewUpError } from "../errors.js";
import type { AutoMergeMethod } from "../types.js";

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
mutation EnableAutoMerge($pullRequestId: ID!, $mergeMethod: PullRequestMergeMethod!) {
  enablePullRequestAutoMerge(input: { pullRequestId: $pullRequestId, mergeMethod: $mergeMethod }) {
    pullRequest {
      number
      autoMergeRequest {
        enabledAt
      }
    }
  }
}
`;

function toGraphqlMergeMethod(
  method: AutoMergeMethod,
): "MERGE" | "SQUASH" | "REBASE" {
  if (method === "merge") {
    return "MERGE";
  }
  if (method === "squash") {
    return "SQUASH";
  }
  return "REBASE";
}

export async function enableAutoMerge(
  client: AutoMergeClient,
  pullRequestNodeId: string,
  method: AutoMergeMethod,
): Promise<void> {
  try {
    const result = await client.graphql<EnableAutoMergeResponse>(
      ENABLE_AUTO_MERGE_MUTATION,
      {
        pullRequestId: pullRequestNodeId,
        mergeMethod: toGraphqlMergeMethod(method),
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
