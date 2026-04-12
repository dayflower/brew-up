import { BrewUpError } from "../errors.js";
import type { PublishDirectResult, ValidatedInputs } from "../types.js";
import {
  buildFileWriteRequest,
  type PublishMessageVariables,
} from "./publish-shared.js";

interface CreateOrUpdateFileResponse {
  commit?: {
    sha?: string;
  };
}

interface TargetRepoWriter {
  rest: {
    repos: {
      createOrUpdateFileContents(params: unknown): Promise<{
        data: CreateOrUpdateFileResponse;
      }>;
    };
  };
}

export async function publishDirect(
  client: TargetRepoWriter,
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
    messageVariables: PublishMessageVariables;
  },
): Promise<PublishDirectResult> {
  try {
    const response = await client.rest.repos.createOrUpdateFileContents(
      buildFileWriteRequest(
        config,
        config.targetBranch,
        renderedOutput,
        options,
      ),
    );

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
