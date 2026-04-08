import { describe, expect, it, vi } from "vitest";
import { enableAutoMerge } from "../src/target/auto-merge.js";

function makeClient() {
  return {
    graphql: vi.fn(),
  };
}

describe("enableAutoMerge", () => {
  it("enables auto-merge with merge method", async () => {
    const client = makeClient();
    client.graphql.mockResolvedValue({
      enablePullRequestAutoMerge: {
        pullRequest: {
          number: 7,
          autoMergeRequest: { enabledAt: "2026-04-08T00:00:00Z" },
        },
      },
    });

    await expect(enableAutoMerge(client, "PR_node_7")).resolves.toBeUndefined();
    expect(client.graphql).toHaveBeenCalledWith(
      expect.stringContaining("enablePullRequestAutoMerge"),
      { pullRequestId: "PR_node_7" },
    );
    expect(client.graphql).toHaveBeenCalledWith(
      expect.stringContaining("mergeMethod: MERGE"),
      { pullRequestId: "PR_node_7" },
    );
  });

  it("fails when auto-merge response is missing", async () => {
    const client = makeClient();
    client.graphql.mockResolvedValue({
      enablePullRequestAutoMerge: {
        pullRequest: {
          number: 7,
          autoMergeRequest: null,
        },
      },
    });

    await expect(enableAutoMerge(client, "PR_node_7")).rejects.toThrow(
      /Failed to enable pull request auto-merge/,
    );
  });

  it("fails when GraphQL API errors", async () => {
    const client = makeClient();
    client.graphql.mockRejectedValue(new Error("forbidden"));

    await expect(enableAutoMerge(client, "PR_node_7")).rejects.toThrow(
      /Failed to enable pull request auto-merge/,
    );
  });
});
