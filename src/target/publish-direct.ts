import { BrewUpError } from "../errors.js";
import type { PublishDirectResult, ValidatedInputs } from "../types.js";

interface CommitIdentity {
  name: string;
  email: string;
}

interface CreateOrUpdateFileResponse {
  commit?: {
    sha?: string;
  };
}

interface TargetRepoWriter {
  rest: {
    repos: {
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
      }): Promise<{ data: CreateOrUpdateFileResponse }>;
    };
  };
}

function buildCommitMessage(outputPath: string, tagName: string): string {
  return `brew-up: update ${outputPath} for ${tagName}`;
}

export async function publishDirect(
  client: TargetRepoWriter,
  config: Pick<
    ValidatedInputs,
    "outputPath" | "targetRepo" | "targetBranch" | "commitAuthor"
  >,
  renderedOutput: string,
  options: { currentSha?: string; releaseTag: string },
): Promise<PublishDirectResult> {
  try {
    const response = await client.rest.repos.createOrUpdateFileContents({
      owner: config.targetRepo.owner,
      repo: config.targetRepo.name,
      path: config.outputPath,
      branch: config.targetBranch,
      message: buildCommitMessage(config.outputPath, options.releaseTag),
      content: Buffer.from(renderedOutput, "utf8").toString("base64"),
      sha: options.currentSha,
      committer: config.commitAuthor,
      author: config.commitAuthor,
    });

    const commitSha = response.data.commit?.sha;
    if (!commitSha) {
      throw new BrewUpError(
        "TARGET_REPO_WRITE_FAILED",
        "Missing commit SHA from target repository write response.",
      );
    }

    return { commitSha };
  } catch (error) {
    throw new BrewUpError(
      "TARGET_REPO_WRITE_FAILED",
      `Failed to publish output file to ${config.targetRepo.fullName}:${config.outputPath}.`,
      error instanceof Error ? error.message : undefined,
    );
  }
}
