import { beforeEach, describe, expect, it, vi } from "vitest";

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

const changeMock = vi.hoisted(() => ({
  detectChange: vi.fn(),
}));

const publishDirectMock = vi.hoisted(() => ({
  publishDirect: vi.fn(),
}));

vi.mock("@actions/core", () => coreMock);
vi.mock("@actions/github", () => githubMock);
vi.mock("../src/config/input.js", () => readInputsMock);
vi.mock("../src/config/validate.js", () => validateInputsMock);
vi.mock("../src/github/release.js", () => releaseMock);
vi.mock("../src/github/assets.js", () => assetsMock);
vi.mock("../src/checksum/index.js", () => checksumMock);
vi.mock("../src/template/render.js", () => templateMock);
vi.mock("../src/target/change.js", () => changeMock);
vi.mock("../src/target/publish-direct.js", () => publishDirectMock);

import { run } from "../src/main.js";

function setupBase() {
  const rawInputs = {
    releaseId: "",
    releaseTag: "v1.2.3",
    templatePath: "template.mustache",
    outputPath: "Casks/app.rb",
    assetMap: "default=app-{{version}}.zip",
    checksumAsset: "checksums.txt",
    targetRepo: "owner/tap",
    targetBranch: "main",
    targetRepoToken: "target-token",
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
    targetRepoToken: "target-token",
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
  releaseMock.resolveRelease.mockResolvedValue(release);
  assetsMock.resolveArtifacts.mockReturnValue(resolvedArtifacts);
  checksumMock.resolveChecksums.mockResolvedValue(checksummedArtifacts);
  templateMock.renderTemplate.mockResolvedValue("rendered");

  return { validatedInputs, release, resolvedArtifacts };
}

describe("run milestone 3", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    coreMock.getInput.mockReturnValue("");
    process.env.GITHUB_TOKEN = "source-token";

    githubMock.getOctokit.mockImplementation((token: string) => ({
      token,
      rest: { repos: {} },
    }));
  });

  it("skips publish on dry-run after change detection", async () => {
    const { validatedInputs } = setupBase();
    validateInputsMock.validateInputs.mockReturnValue({
      ...validatedInputs,
      dryRun: true,
    });
    changeMock.detectChange.mockResolvedValue({ changed: true, currentSha: "abc" });

    await run();

    expect(changeMock.detectChange).toHaveBeenCalled();
    expect(publishDirectMock.publishDirect).not.toHaveBeenCalled();
    expect(coreMock.setOutput).toHaveBeenCalledWith("changed", "true");
    expect(coreMock.setFailed).not.toHaveBeenCalled();
  });

  it("skips publish when output is unchanged", async () => {
    setupBase();
    changeMock.detectChange.mockResolvedValue({ changed: false, currentSha: "abc" });

    await run();

    expect(changeMock.detectChange).toHaveBeenCalled();
    expect(publishDirectMock.publishDirect).not.toHaveBeenCalled();
    expect(coreMock.setOutput).toHaveBeenCalledWith("changed", "false");
    expect(coreMock.setFailed).not.toHaveBeenCalled();
  });

  it("publishes in direct mode when changed", async () => {
    const { validatedInputs } = setupBase();
    changeMock.detectChange.mockResolvedValue({ changed: true, currentSha: "abc" });
    publishDirectMock.publishDirect.mockResolvedValue({ commitSha: "commit123" });

    await run();

    expect(githubMock.getOctokit).toHaveBeenNthCalledWith(1, "source-token");
    expect(githubMock.getOctokit).toHaveBeenNthCalledWith(
      2,
      validatedInputs.targetRepoToken,
    );
    expect(publishDirectMock.publishDirect).toHaveBeenCalledWith(
      expect.anything(),
      validatedInputs,
      "rendered",
      {
        currentSha: "abc",
        releaseTag: "v1.2.3",
      },
    );
    expect(coreMock.setOutput).toHaveBeenCalledWith("changed", "true");
    expect(coreMock.setOutput).toHaveBeenCalledWith("target-commit-sha", "commit123");
    expect(coreMock.setFailed).not.toHaveBeenCalled();
  });

  it("fails for pr mode until milestone 4", async () => {
    const { validatedInputs } = setupBase();
    validateInputsMock.validateInputs.mockReturnValue({
      ...validatedInputs,
      publishMode: "pr" as const,
    });
    changeMock.detectChange.mockResolvedValue({ changed: true, currentSha: "abc" });

    await run();

    expect(publishDirectMock.publishDirect).not.toHaveBeenCalled();
    expect(coreMock.setFailed).toHaveBeenCalledWith(
      expect.stringContaining("UNIMPLEMENTED_MILESTONE"),
    );
  });
});
