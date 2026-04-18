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
  publishTitleTemplate: "release {{tag_name}}",
  publishBodyTemplate: "",
  publishAttribution: "off" as const,
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
      data: {
        number: 12,
        html_url: "https://example.test/pr/12",
        node_id: "PR_node_12",
      },
    });

    const result = await publishPr(client, baseConfig, "rendered", {
      currentSha: "file-sha",
      releaseTag: "v1.2.3",
      runId: "777",
      messageVariables: {
        version: "1.2.3",
        output_path: "Casks/My App.rb",
        tag_name: "v1.2.3",
        release_id: "123",
        release_name: "Release",
        release_url: "https://example.test/release/123",
      },
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
        title: "release v1.2.3",
        body: undefined,
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
      data: {
        number: 1,
        html_url: "https://example.test/pr/1",
        node_id: "PR_node_1",
      },
    });

    await publishPr(
      client,
      {
        ...baseConfig,
        commitAuthor: { name: "Alice", email: "alice@example.com" },
      },
      "rendered",
      {
        releaseTag: "v1.2.3",
        runId: "777",
        messageVariables: {
          version: "1.2.3",
          output_path: "Casks/My App.rb",
          tag_name: "v1.2.3",
          release_id: "123",
          release_name: "Release",
          release_url: "https://example.test/release/123",
        },
      },
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
        messageVariables: {
          version: "1.2.3",
          output_path: "Casks/My App.rb",
          tag_name: "v1.2.3",
          release_id: "123",
          release_name: "Release",
          release_url: "https://example.test/release/123",
        },
      }),
    ).rejects.toThrow(/Failed to publish pull request/);
  });

  it("replaces unknown variables with UNKNOWN in PR title", async () => {
    const client = makeClient();
    client.rest.repos.getBranch.mockResolvedValue({
      data: { commit: { sha: "base-sha" } },
    });
    client.rest.git.createRef.mockResolvedValue({});
    client.rest.repos.createOrUpdateFileContents.mockResolvedValue({
      data: { commit: { sha: "commit-sha" } },
    });
    client.rest.pulls.create.mockResolvedValue({
      data: {
        number: 13,
        html_url: "https://example.test/pr/13",
        node_id: "PR_node_13",
      },
    });

    await publishPr(
      client,
      {
        ...baseConfig,
        publishTitleTemplate: "release {{tag_name}} {{missing_value}}",
      },
      "rendered",
      {
        releaseTag: "v1.2.3",
        runId: "777",
        messageVariables: {
          version: "1.2.3",
          output_path: "Casks/My App.rb",
          tag_name: "v1.2.3",
          release_id: "123",
          release_name: "Release",
          release_url: "https://example.test/release/123",
        },
      },
    );

    expect(client.rest.pulls.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "release v1.2.3 UNKNOWN",
      }),
    );
  });

  it("sets PR description body template and attribution", async () => {
    const client = makeClient();
    client.rest.repos.getBranch.mockResolvedValue({
      data: { commit: { sha: "base-sha" } },
    });
    client.rest.git.createRef.mockResolvedValue({});
    client.rest.repos.createOrUpdateFileContents.mockResolvedValue({
      data: { commit: { sha: "commit-sha" } },
    });
    client.rest.pulls.create.mockResolvedValue({
      data: {
        number: 14,
        html_url: "https://example.test/pr/14",
        node_id: "PR_node_14",
      },
    });

    await publishPr(
      client,
      {
        ...baseConfig,
        publishBodyTemplate: "Source: {{release_url}}",
        publishAttribution: "both",
      },
      "rendered",
      {
        releaseTag: "v1.2.3",
        runId: "777",
        messageVariables: {
          version: "1.2.3",
          output_path: "Casks/My App.rb",
          tag_name: "v1.2.3",
          release_id: "123",
          release_name: "Release",
          release_url: "https://example.test/release/123",
        },
      },
    );

    expect(client.rest.pulls.create).toHaveBeenCalledWith(
      expect.objectContaining({
        body: "Source: https://example.test/release/123\n\nGenerated by [brew-up](https://github.com/dayflower/brew-up)",
      }),
    );
  });
});
