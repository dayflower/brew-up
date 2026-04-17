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

    await expect(
      enableAutoMerge(client, "PR_node_7", "merge"),
    ).resolves.toBeUndefined();
    expect(client.graphql).toHaveBeenCalledWith(
      expect.stringContaining("enablePullRequestAutoMerge"),
      { pullRequestId: "PR_node_7", mergeMethod: "MERGE" },
    );
    expect(client.graphql).toHaveBeenCalledWith(
      expect.stringContaining("mergeMethod: $mergeMethod"),
      { pullRequestId: "PR_node_7", mergeMethod: "MERGE" },
    );
  });

  it("maps squash and rebase methods", async () => {
    const client = makeClient();
    client.graphql.mockResolvedValue({
      enablePullRequestAutoMerge: {
        pullRequest: {
          number: 8,
          autoMergeRequest: { enabledAt: "2026-04-08T00:00:00Z" },
        },
      },
    });

    await enableAutoMerge(client, "PR_node_8", "squash");
    await enableAutoMerge(client, "PR_node_8", "rebase");

    expect(client.graphql).toHaveBeenNthCalledWith(1, expect.any(String), {
      pullRequestId: "PR_node_8",
      mergeMethod: "SQUASH",
    });
    expect(client.graphql).toHaveBeenNthCalledWith(2, expect.any(String), {
      pullRequestId: "PR_node_8",
      mergeMethod: "REBASE",
    });
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

    await expect(enableAutoMerge(client, "PR_node_7", "merge")).rejects.toThrow(
      /Failed to enable pull request auto-merge/,
    );
  });

  it("fails when GraphQL API errors", async () => {
    const client = makeClient();
    client.graphql.mockRejectedValue(new Error("forbidden"));

    await expect(enableAutoMerge(client, "PR_node_7", "merge")).rejects.toThrow(
      /Failed to enable pull request auto-merge/,
    );
  });
});
