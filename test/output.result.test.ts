import { beforeEach, describe, expect, it, vi } from "vitest";

const coreMock = vi.hoisted(() => ({
  setOutput: vi.fn(),
}));

vi.mock("@actions/core", () => coreMock);

import { setBaseOutputs, setPublishOutputs } from "../src/output/result.js";

describe("output/result", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sets base outputs", () => {
    setBaseOutputs({
      changed: true,
      releaseId: 123,
      releaseTag: "v1.2.3",
    });

    expect(coreMock.setOutput).toHaveBeenCalledWith("changed", "true");
    expect(coreMock.setOutput).toHaveBeenCalledWith(
      "resolved-release-id",
      "123",
    );
    expect(coreMock.setOutput).toHaveBeenCalledWith(
      "resolved-release-tag",
      "v1.2.3",
    );
  });

  it("sets only available publish outputs", () => {
    setPublishOutputs({
      commitSha: "abc",
      pullRequestNumber: 99,
      pullRequestUrl: "https://example.test/pr/99",
    });

    expect(coreMock.setOutput).toHaveBeenCalledWith("target-commit-sha", "abc");
    expect(coreMock.setOutput).toHaveBeenCalledWith(
      "pull-request-number",
      "99",
    );
    expect(coreMock.setOutput).toHaveBeenCalledWith(
      "pull-request-url",
      "https://example.test/pr/99",
    );
  });
});
