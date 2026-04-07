import { describe, expect, it, vi } from "vitest";
import { resolveRelease } from "../src/github/release.js";

function makeClient() {
  return {
    rest: {
      repos: {
        getRelease: vi.fn(),
        getReleaseByTag: vi.fn(),
      },
    },
  };
}

function releaseResponse(id: number, tag: string) {
  return {
    data: {
      id,
      tag_name: tag,
      name: `Release ${tag}`,
      html_url: `https://example.test/releases/${id}`,
      assets: [
        {
          id: 99,
          name: "myapp.zip",
          browser_download_url: "https://example.test/myapp.zip",
          url: "https://api.example.test/assets/99",
        },
      ],
    },
  };
}

describe("resolveRelease", () => {
  it("uses release-id first", async () => {
    const client = makeClient();
    client.rest.repos.getRelease.mockResolvedValue(
      releaseResponse(1, "v1.0.0"),
    );

    const result = await resolveRelease(
      client,
      { owner: "a", repo: "b", eventReleaseId: 10, eventReleaseTag: "v10" },
      { releaseId: 1, releaseTag: "v2.0.0" },
    );

    expect(client.rest.repos.getRelease).toHaveBeenCalledWith({
      owner: "a",
      repo: "b",
      release_id: 1,
    });
    expect(client.rest.repos.getReleaseByTag).not.toHaveBeenCalled();
    expect(result.version).toBe("1.0.0");
  });

  it("uses release-tag when release-id is absent", async () => {
    const client = makeClient();
    client.rest.repos.getReleaseByTag.mockResolvedValue(
      releaseResponse(2, "v2.0.0"),
    );

    await resolveRelease(
      client,
      { owner: "a", repo: "b", eventReleaseId: 10, eventReleaseTag: "v10" },
      { releaseId: undefined, releaseTag: "v2.0.0" },
    );

    expect(client.rest.repos.getReleaseByTag).toHaveBeenCalledWith({
      owner: "a",
      repo: "b",
      tag: "v2.0.0",
    });
  });

  it("uses event release id when explicit inputs are absent", async () => {
    const client = makeClient();
    client.rest.repos.getRelease.mockResolvedValue(
      releaseResponse(10, "v10.0.0"),
    );

    await resolveRelease(
      client,
      { owner: "a", repo: "b", eventReleaseId: 10, eventReleaseTag: "v10.0.0" },
      { releaseId: undefined, releaseTag: undefined },
    );

    expect(client.rest.repos.getRelease).toHaveBeenCalledWith({
      owner: "a",
      repo: "b",
      release_id: 10,
    });
  });

  it("uses event release tag when event id is absent", async () => {
    const client = makeClient();
    client.rest.repos.getReleaseByTag.mockResolvedValue(
      releaseResponse(11, "v11.0.0"),
    );

    await resolveRelease(
      client,
      { owner: "a", repo: "b", eventReleaseTag: "v11.0.0" },
      { releaseId: undefined, releaseTag: undefined },
    );

    expect(client.rest.repos.getReleaseByTag).toHaveBeenCalledWith({
      owner: "a",
      repo: "b",
      tag: "v11.0.0",
    });
  });

  it("fails when no source can resolve release", async () => {
    const client = makeClient();

    await expect(
      resolveRelease(
        client,
        { owner: "a", repo: "b" },
        { releaseId: undefined, releaseTag: undefined },
      ),
    ).rejects.toThrow(/could not be resolved/);
  });
});
