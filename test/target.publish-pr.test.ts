import { describe, expect, it, vi } from "vitest";
import { publishPr } from "../src/target/publish-pr.js";

function makeClient() {
  return {
    rest: {
      repos: {
        getBranch: vi.fn(),
        createOrUpdateFileContents: vi.fn(),
      },
      git: {
        createRef: vi.fn(),
      },
      pulls: {
        create: vi.fn(),
      },
    },
  };
}

const baseConfig = {
  outputPath: "Casks/My App.rb",
  targetRepo: { owner: "owner", name: "tap", fullName: "owner/tap" },
  targetBranch: "main",
};

describe("publishPr", () => {
  it("creates branch, commit, and pull request", async () => {
    const client = makeClient();
    client.rest.repos.getBranch.mockResolvedValue({
      data: { commit: { sha: "base-sha" } },
    });
    client.rest.git.createRef.mockResolvedValue({});
    client.rest.repos.createOrUpdateFileContents.mockResolvedValue({
      data: { commit: { sha: "commit-sha" } },
    });
    client.rest.pulls.create.mockResolvedValue({
      data: { number: 12, html_url: "https://example.test/pr/12", node_id: "PR_node_12" },
    });

    const result = await publishPr(client, baseConfig, "rendered", {
      currentSha: "file-sha",
      releaseTag: "v1.2.3",
      runId: "777",
    });

    expect(client.rest.git.createRef).toHaveBeenCalledWith({
      owner: "owner",
      repo: "tap",
      ref: "refs/heads/brew-up/my-app/v1.2.3-777",
      sha: "base-sha",
    });
    expect(client.rest.repos.createOrUpdateFileContents).toHaveBeenCalledWith(
      expect.objectContaining({
        branch: "brew-up/my-app/v1.2.3-777",
        sha: "file-sha",
      }),
    );
    expect(client.rest.pulls.create).toHaveBeenCalledWith(
      expect.objectContaining({
        base: "main",
        head: "brew-up/my-app/v1.2.3-777",
      }),
    );
    expect(result).toEqual({
      commitSha: "commit-sha",
      pullRequestNumber: 12,
      pullRequestUrl: "https://example.test/pr/12",
      pullRequestNodeId: "PR_node_12",
      branchName: "brew-up/my-app/v1.2.3-777",
    });
  });

  it("sets author/committer when provided", async () => {
    const client = makeClient();
    client.rest.repos.getBranch.mockResolvedValue({
      data: { commit: { sha: "base-sha" } },
    });
    client.rest.git.createRef.mockResolvedValue({});
    client.rest.repos.createOrUpdateFileContents.mockResolvedValue({
      data: { commit: { sha: "commit-sha" } },
    });
    client.rest.pulls.create.mockResolvedValue({
      data: { number: 1, html_url: "https://example.test/pr/1", node_id: "PR_node_1" },
    });

    await publishPr(
      client,
      {
        ...baseConfig,
        commitAuthor: { name: "Alice", email: "alice@example.com" },
      },
      "rendered",
      { releaseTag: "v1.2.3", runId: "777" },
    );

    expect(client.rest.repos.createOrUpdateFileContents).toHaveBeenCalledWith(
      expect.objectContaining({
        author: { name: "Alice", email: "alice@example.com" },
        committer: { name: "Alice", email: "alice@example.com" },
      }),
    );
  });

  it("throws typed error on API failure", async () => {
    const client = makeClient();
    client.rest.repos.getBranch.mockRejectedValue(new Error("boom"));

    await expect(
      publishPr(client, baseConfig, "rendered", {
        releaseTag: "v1.2.3",
        runId: "777",
      }),
    ).rejects.toThrow(/Failed to publish pull request/);
  });
});
