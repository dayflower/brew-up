import { describe, expect, it, vi } from "vitest";

const coreMock = vi.hoisted(() => ({
  getInput: vi.fn(),
  info: vi.fn(),
  setOutput: vi.fn(),
  setFailed: vi.fn(),
}));

const githubMock = vi.hoisted(() => ({
  context: {
    repo: { owner: "owner", repo: "repo" },
    payload: {},
  },
  getOctokit: vi.fn(),
}));

const readInputsMock = vi.hoisted(() => ({
  readInputs: vi.fn(),
}));

const validateInputsMock = vi.hoisted(() => ({
  validateInputs: vi.fn(),
}));

const releaseMock = vi.hoisted(() => ({
  resolveRelease: vi.fn(),
}));

const assetsMock = vi.hoisted(() => ({
  resolveArtifacts: vi.fn(),
}));

const checksumMock = vi.hoisted(() => ({
  resolveChecksums: vi.fn(),
}));

const templateMock = vi.hoisted(() => ({
  renderTemplate: vi.fn(),
}));

vi.mock("@actions/core", () => coreMock);
vi.mock("@actions/github", () => githubMock);
vi.mock("../src/config/input.js", () => readInputsMock);
vi.mock("../src/config/validate.js", () => validateInputsMock);
vi.mock("../src/github/release.js", () => releaseMock);
vi.mock("../src/github/assets.js", () => assetsMock);
vi.mock("../src/checksum/index.js", () => checksumMock);
vi.mock("../src/template/render.js", () => templateMock);

import { run } from "../src/main.js";

describe("run milestone 2", () => {
  it("executes release->assets->checksum->template flow without setFailed", async () => {
    const rawInputs = {
      releaseId: "",
      releaseTag: "v1.2.3",
      templatePath: "template.mustache",
      outputPath: "Casks/app.rb",
      assetMap: "default=app-{{version}}.zip",
      checksumAsset: "checksums.txt",
      targetRepo: "owner/tap",
      targetBranch: "main",
      targetRepoToken: "token",
      publishMode: "direct",
      onlyIfChanged: "true",
      dryRun: "false",
      commitAuthorName: "",
      commitAuthorEmail: "",
    };

    const validatedInputs = {
      releaseId: undefined,
      releaseTag: "v1.2.3",
      templatePath: "template.mustache",
      outputPath: "Casks/app.rb",
      assetMapEntries: [{ key: "default", pattern: "app-{{version}}.zip" }],
      checksumAsset: "checksums.txt",
      targetRepo: { owner: "owner", name: "tap", fullName: "owner/tap" },
      targetBranch: "main",
      targetRepoToken: "token",
      publishMode: "direct" as const,
      onlyIfChanged: true,
      dryRun: false,
    };

    const release = {
      id: 123,
      tagName: "v1.2.3",
      name: "Release",
      url: "https://example.test/release/123",
      version: "1.2.3",
      assets: [],
    };

    const resolvedArtifacts = {
      artifacts: {
        default: {
          key: "default",
          name: "app-1.2.3.zip",
          url: "https://example.test/app-1.2.3.zip",
          apiUrl: "https://api.example.test/assets/1",
        },
      },
    };

    const checksummedArtifacts = {
      artifacts: {
        default: {
          key: "default",
          name: "app-1.2.3.zip",
          url: "https://example.test/app-1.2.3.zip",
          apiUrl: "https://api.example.test/assets/1",
          sha256:
            "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        },
      },
    };

    readInputsMock.readInputs.mockReturnValue(rawInputs);
    validateInputsMock.validateInputs.mockReturnValue(validatedInputs);
    githubMock.getOctokit.mockReturnValue({ rest: { repos: {} } });
    releaseMock.resolveRelease.mockResolvedValue(release);
    assetsMock.resolveArtifacts.mockReturnValue(resolvedArtifacts);
    checksumMock.resolveChecksums.mockResolvedValue(checksummedArtifacts);
    templateMock.renderTemplate.mockResolvedValue("rendered");
    coreMock.getInput.mockReturnValue("");

    process.env.GITHUB_TOKEN = "token";

    await run();

    expect(releaseMock.resolveRelease).toHaveBeenCalled();
    expect(assetsMock.resolveArtifacts).toHaveBeenCalled();
    expect(checksumMock.resolveChecksums).toHaveBeenCalledWith({
      checksumAsset: "checksums.txt",
      release,
      resolvedArtifacts,
    });
    expect(templateMock.renderTemplate).toHaveBeenCalled();
    expect(coreMock.setFailed).not.toHaveBeenCalled();
    expect(coreMock.setOutput).toHaveBeenCalledWith("resolved-release-id", "123");
    expect(coreMock.setOutput).toHaveBeenCalledWith("resolved-release-tag", "v1.2.3");
  });
});
