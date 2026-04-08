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
    runId: 555,
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

const publishPrMock = vi.hoisted(() => ({
  publishPr: vi.fn(),
}));

const autoMergeMock = vi.hoisted(() => ({
  enableAutoMerge: vi.fn(),
}));

const outputResultMock = vi.hoisted(() => ({
  setBaseOutputs: vi.fn(),
  setPublishOutputs: vi.fn(),
}));

const outputSummaryMock = vi.hoisted(() => ({
  writeWorkflowSummary: vi.fn(),
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
vi.mock("../src/target/publish-pr.js", () => publishPrMock);
vi.mock("../src/target/auto-merge.js", () => autoMergeMock);
vi.mock("../src/output/result.js", () => outputResultMock);
vi.mock("../src/output/summary.js", () => outputSummaryMock);

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
  outputSummaryMock.writeWorkflowSummary.mockResolvedValue(undefined);

  return { validatedInputs };
}

describe("run milestone 4", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    coreMock.getInput.mockReturnValue("");
    process.env.GITHUB_TOKEN = "source-token";
    process.env.GITHUB_RUN_ID = "777";

    githubMock.getOctokit.mockImplementation((token: string) => ({
      token,
      rest: { repos: {}, pulls: {}, git: {} },
      graphql: vi.fn(),
    }));
  });

  it("skips publish on dry-run after change detection", async () => {
    const { validatedInputs } = setupBase();
    validateInputsMock.validateInputs.mockReturnValue({
      ...validatedInputs,
      dryRun: true,
    });
    changeMock.detectChange.mockResolvedValue({
      changed: true,
      currentSha: "abc",
    });

    await run();

    expect(changeMock.detectChange).toHaveBeenCalled();
    expect(publishDirectMock.publishDirect).not.toHaveBeenCalled();
    expect(publishPrMock.publishPr).not.toHaveBeenCalled();
    expect(outputResultMock.setBaseOutputs).toHaveBeenCalledWith({
      changed: true,
      releaseId: 123,
      releaseTag: "v1.2.3",
    });
    expect(outputSummaryMock.writeWorkflowSummary).toHaveBeenCalled();
    expect(coreMock.setFailed).not.toHaveBeenCalled();
  });

  it("skips publish when output is unchanged and only-if-changed=true", async () => {
    setupBase();
    changeMock.detectChange.mockResolvedValue({
      changed: false,
      currentSha: "abc",
    });

    await run();

    expect(publishDirectMock.publishDirect).not.toHaveBeenCalled();
    expect(publishPrMock.publishPr).not.toHaveBeenCalled();
    expect(outputSummaryMock.writeWorkflowSummary).toHaveBeenCalledWith(
      expect.objectContaining({
        changed: false,
        onlyIfChanged: true,
      }),
    );
    expect(coreMock.setFailed).not.toHaveBeenCalled();
  });

  it("publishes in direct mode when changed", async () => {
    const { validatedInputs } = setupBase();
    changeMock.detectChange.mockResolvedValue({
      changed: true,
      currentSha: "abc",
    });
    publishDirectMock.publishDirect.mockResolvedValue({
      commitSha: "commit123",
    });

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
    expect(publishPrMock.publishPr).not.toHaveBeenCalled();
    expect(outputResultMock.setPublishOutputs).toHaveBeenCalledWith({
      commitSha: "commit123",
    });
    expect(coreMock.setFailed).not.toHaveBeenCalled();
  });

  it("publishes in pr mode", async () => {
    const { validatedInputs } = setupBase();
    validateInputsMock.validateInputs.mockReturnValue({
      ...validatedInputs,
      publishMode: "pr" as const,
    });
    changeMock.detectChange.mockResolvedValue({
      changed: true,
      currentSha: "abc",
    });
    publishPrMock.publishPr.mockResolvedValue({
      commitSha: "commit123",
      pullRequestNumber: 11,
      pullRequestUrl: "https://example.test/pr/11",
      pullRequestNodeId: "PR_node_11",
      branchName: "brew-up/app/v1.2.3-777",
    });

    await run();

    expect(publishDirectMock.publishDirect).not.toHaveBeenCalled();
    expect(publishPrMock.publishPr).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ publishMode: "pr" }),
      "rendered",
      {
        currentSha: "abc",
        releaseTag: "v1.2.3",
        runId: "777",
      },
    );
    expect(autoMergeMock.enableAutoMerge).not.toHaveBeenCalled();
    expect(outputResultMock.setPublishOutputs).toHaveBeenCalledWith(
      expect.objectContaining({
        pullRequestNumber: 11,
        pullRequestUrl: "https://example.test/pr/11",
        autoMergeEnabled: false,
      }),
    );
  });

  it("publishes in pr-auto-merge mode and enables auto-merge", async () => {
    const { validatedInputs } = setupBase();
    validateInputsMock.validateInputs.mockReturnValue({
      ...validatedInputs,
      publishMode: "pr-auto-merge" as const,
    });
    changeMock.detectChange.mockResolvedValue({
      changed: true,
      currentSha: "abc",
    });
    publishPrMock.publishPr.mockResolvedValue({
      commitSha: "commit123",
      pullRequestNumber: 12,
      pullRequestUrl: "https://example.test/pr/12",
      pullRequestNodeId: "PR_node_12",
      branchName: "brew-up/app/v1.2.3-777",
    });

    await run();

    expect(publishPrMock.publishPr).toHaveBeenCalled();
    expect(autoMergeMock.enableAutoMerge).toHaveBeenCalledWith(
      expect.anything(),
      "PR_node_12",
    );
    expect(outputResultMock.setPublishOutputs).toHaveBeenCalledWith(
      expect.objectContaining({
        pullRequestNumber: 12,
        autoMergeEnabled: true,
      }),
    );
  });

  it("continues publish when unchanged and only-if-changed=false", async () => {
    const { validatedInputs } = setupBase();
    validateInputsMock.validateInputs.mockReturnValue({
      ...validatedInputs,
      onlyIfChanged: false,
    });
    changeMock.detectChange.mockResolvedValue({
      changed: false,
      currentSha: "abc",
    });
    publishDirectMock.publishDirect.mockResolvedValue({
      commitSha: "commit123",
    });

    await run();

    expect(publishDirectMock.publishDirect).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ onlyIfChanged: false }),
      "rendered",
      {
        currentSha: "abc",
        releaseTag: "v1.2.3",
      },
    );
  });
});
