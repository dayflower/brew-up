import { BrewUpError } from "../errors.js";
import type { PublishPrResult, ValidatedInputs } from "../types.js";
import {
  buildFileWriteRequest,
  buildPublishMessage,
  type PublishMessageVariables,
} from "./publish-shared.js";

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
        committer?: { name: string; email: string };
        author?: { name: string; email: string };
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

function buildBranchName(
  outputPath: string,
  releaseTag: string,
  runId: string,
): string {
  const packageName = derivePackageNameFromOutputPath(outputPath);
  return `brew-up/${packageName}/${sanitizeBranchPart(releaseTag)}-${sanitizeBranchPart(runId)}`;
}

interface PrPublishPlan {
  branchName: string;
  branchRef: string;
  pullRequestTitle: string;
}

function buildPrPublishPlan(
  config: Pick<ValidatedInputs, "outputPath" | "publishMessageTemplate">,
  options: {
    releaseTag: string;
    runId: string;
    messageVariables: PublishMessageVariables;
  },
): PrPublishPlan {
  const branchName = buildBranchName(
    config.outputPath,
    options.releaseTag,
    options.runId,
  );
  return {
    branchName,
    branchRef: `refs/heads/${branchName}`,
    pullRequestTitle: buildPublishMessage(
      config.publishMessageTemplate,
      options.messageVariables,
    ),
  };
}

export async function publishPr(
  client: PullRequestWriter,
  config: Pick<
    ValidatedInputs,
    | "outputPath"
    | "targetRepo"
    | "targetBranch"
    | "commitAuthor"
    | "publishMessageTemplate"
  >,
  renderedOutput: string,
  options: {
    currentSha?: string;
    releaseTag: string;
    runId: string;
    messageVariables: PublishMessageVariables;
  },
): Promise<PublishPrResult> {
  const plan = buildPrPublishPlan(config, options);

  try {
    const branchResponse = await client.rest.repos.getBranch({
      owner: config.targetRepo.owner,
      repo: config.targetRepo.name,
      branch: config.targetBranch,
    });

    await client.rest.git.createRef({
      owner: config.targetRepo.owner,
      repo: config.targetRepo.name,
      ref: plan.branchRef,
      sha: branchResponse.data.commit.sha,
    });

    const commitResponse = await client.rest.repos.createOrUpdateFileContents(
      buildFileWriteRequest(config, plan.branchName, renderedOutput, options),
    );

    const prResponse = await client.rest.pulls.create({
      owner: config.targetRepo.owner,
      repo: config.targetRepo.name,
      base: config.targetBranch,
      head: plan.branchName,
      title: plan.pullRequestTitle,
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
      branchName: plan.branchName,
    };
  } catch (error) {
    throw new BrewUpError(
      "PULL_REQUEST_CREATE_FAILED",
      `Failed to publish pull request to ${config.targetRepo.fullName}:${config.outputPath}.`,
      error instanceof Error ? error.message : undefined,
    );
  }
}
