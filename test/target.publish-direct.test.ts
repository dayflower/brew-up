import { describe, expect, it, vi } from "vitest";
import { publishDirect } from "../src/target/publish-direct.js";

function makeClient() {
  return {
    rest: {
      repos: {
        createOrUpdateFileContents: vi.fn(),
      },
    },
  };
}

const baseConfig = {
  outputPath: "Casks/app.rb",
  targetRepo: { owner: "owner", name: "tap", fullName: "owner/tap" },
  targetBranch: "main",
};

describe("publishDirect", () => {
  it("creates a new file when currentSha is absent", async () => {
    const client = makeClient();
    client.rest.repos.createOrUpdateFileContents.mockResolvedValue({
      data: { commit: { sha: "commit123" } },
    });

    const result = await publishDirect(client, baseConfig, "rendered", {
      releaseTag: "v1.2.3",
    });

    expect(result).toEqual({ commitSha: "commit123" });
    expect(client.rest.repos.createOrUpdateFileContents).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: "owner",
        repo: "tap",
        path: "Casks/app.rb",
        branch: "main",
        sha: undefined,
      }),
    );
  });

  it("updates existing file when currentSha exists", async () => {
    const client = makeClient();
    client.rest.repos.createOrUpdateFileContents.mockResolvedValue({
      data: { commit: { sha: "commit456" } },
    });

    await publishDirect(client, baseConfig, "rendered", {
      currentSha: "oldsha",
      releaseTag: "v1.2.3",
    });

    expect(client.rest.repos.createOrUpdateFileContents).toHaveBeenCalledWith(
      expect.objectContaining({
        sha: "oldsha",
      }),
    );
  });

  it("sets author and committer when commitAuthor is provided", async () => {
    const client = makeClient();
    client.rest.repos.createOrUpdateFileContents.mockResolvedValue({
      data: { commit: { sha: "commit789" } },
    });

    await publishDirect(
      client,
      {
        ...baseConfig,
        commitAuthor: {
          name: "Alice",
          email: "alice@example.com",
        },
      },
      "rendered",
      {
        releaseTag: "v1.2.3",
      },
    );

    expect(client.rest.repos.createOrUpdateFileContents).toHaveBeenCalledWith(
      expect.objectContaining({
        author: { name: "Alice", email: "alice@example.com" },
        committer: { name: "Alice", email: "alice@example.com" },
      }),
    );
  });

  it("fails with target repo write error on API failure", async () => {
    const client = makeClient();
    client.rest.repos.createOrUpdateFileContents.mockRejectedValue(
      new Error("boom"),
    );

    await expect(
      publishDirect(client, baseConfig, "rendered", {
        releaseTag: "v1.2.3",
      }),
    ).rejects.toThrow(/Failed to publish output file/);
  });
});
