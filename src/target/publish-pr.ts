import { BrewUpError } from "../errors.js";
import type { PublishPrResult, ValidatedInputs } from "../types.js";

interface CommitIdentity {
  name: string;
  email: string;
}

interface PullRequestResponse {
  number: number;
  html_url: string;
  node_id: string;
}

interface PullRequestWriter {
  rest: {
    repos: {
      getBranch(params: {
        owner: string;
        repo: string;
        branch: string;
      }): Promise<{ data: { commit: { sha: string } } }>;
      createOrUpdateFileContents(params: {
        owner: string;
        repo: string;
        path: string;
        branch: string;
        message: string;
        content: string;
        sha?: string;
        committer?: CommitIdentity;
        author?: CommitIdentity;
      }): Promise<{ data: { commit?: { sha?: string } } }>;
    };
    git: {
      createRef(params: {
        owner: string;
        repo: string;
        ref: string;
        sha: string;
      }): Promise<unknown>;
    };
    pulls: {
      create(params: {
        owner: string;
        repo: string;
        base: string;
        head: string;
        title: string;
      }): Promise<{ data: PullRequestResponse }>;
    };
  };
}

function sanitizeBranchPart(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return normalized || "tap-update";
}

function derivePackageNameFromOutputPath(outputPath: string): string {
  const fileName = outputPath.split("/").pop() ?? outputPath;
  const withoutExt = fileName.replace(/\.[^.]+$/, "");
  return sanitizeBranchPart(withoutExt);
}

function buildBranchName(outputPath: string, releaseTag: string, runId: string): string {
  const packageName = derivePackageNameFromOutputPath(outputPath);
  return `brew-up/${packageName}/${sanitizeBranchPart(releaseTag)}-${sanitizeBranchPart(runId)}`;
}

function buildCommitMessage(outputPath: string, tagName: string): string {
  return `brew-up: update ${outputPath} for ${tagName}`;
}

export async function publishPr(
  client: PullRequestWriter,
  config: Pick<
    ValidatedInputs,
    "outputPath" | "targetRepo" | "targetBranch" | "commitAuthor"
  >,
  renderedOutput: string,
  options: { currentSha?: string; releaseTag: string; runId: string },
): Promise<PublishPrResult> {
  const branchName = buildBranchName(
    config.outputPath,
    options.releaseTag,
    options.runId,
  );

  try {
    const branchResponse = await client.rest.repos.getBranch({
      owner: config.targetRepo.owner,
      repo: config.targetRepo.name,
      branch: config.targetBranch,
    });

    await client.rest.git.createRef({
      owner: config.targetRepo.owner,
      repo: config.targetRepo.name,
      ref: `refs/heads/${branchName}`,
      sha: branchResponse.data.commit.sha,
    });

    const commitResponse = await client.rest.repos.createOrUpdateFileContents({
      owner: config.targetRepo.owner,
      repo: config.targetRepo.name,
      path: config.outputPath,
      branch: branchName,
      message: buildCommitMessage(config.outputPath, options.releaseTag),
      content: Buffer.from(renderedOutput, "utf8").toString("base64"),
      sha: options.currentSha,
      committer: config.commitAuthor,
      author: config.commitAuthor,
    });

    const prResponse = await client.rest.pulls.create({
      owner: config.targetRepo.owner,
      repo: config.targetRepo.name,
      base: config.targetBranch,
      head: branchName,
      title: buildCommitMessage(config.outputPath, options.releaseTag),
    });

    const commitSha = commitResponse.data.commit?.sha;
    if (!commitSha) {
      throw new BrewUpError(
        "TARGET_REPO_WRITE_FAILED",
        "Missing commit SHA from target repository write response.",
      );
    }

    return {
      commitSha,
      pullRequestNumber: prResponse.data.number,
      pullRequestUrl: prResponse.data.html_url,
      pullRequestNodeId: prResponse.data.node_id,
      branchName,
    };
  } catch (error) {
    throw new BrewUpError(
      "PULL_REQUEST_CREATE_FAILED",
      `Failed to publish pull request to ${config.targetRepo.fullName}:${config.outputPath}.`,
      error instanceof Error ? error.message : undefined,
    );
  }
}
