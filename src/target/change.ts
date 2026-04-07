import { BrewUpError } from "../errors.js";
import type { ChangeDetectionResult, ValidatedInputs } from "../types.js";

interface GetContentFileResponse {
  type: "file";
  encoding: "base64" | string;
  content: string;
  sha: string;
}

interface TargetRepoReader {
  rest: {
    repos: {
      getContent(params: {
        owner: string;
        repo: string;
        path: string;
        ref: string;
      }): Promise<{ data: GetContentFileResponse | unknown[] }>;
    };
  };
}

function isNotFoundError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    (error as { status?: unknown }).status === 404
  );
}

function decodeContent(content: GetContentFileResponse): string {
  if (content.encoding !== "base64") {
    throw new BrewUpError(
      "TARGET_OUTPUT_READ_FAILED",
      `Unsupported content encoding for target file: ${content.encoding}.`,
    );
  }

  return Buffer.from(content.content, "base64").toString("utf8");
}

export async function detectChange(
  client: TargetRepoReader,
  config: Pick<ValidatedInputs, "outputPath" | "targetRepo" | "targetBranch">,
  renderedOutput: string,
): Promise<ChangeDetectionResult> {
  try {
    const response = await client.rest.repos.getContent({
      owner: config.targetRepo.owner,
      repo: config.targetRepo.name,
      path: config.outputPath,
      ref: config.targetBranch,
    });

    if (Array.isArray(response.data) || response.data.type !== "file") {
      throw new BrewUpError(
        "TARGET_OUTPUT_READ_FAILED",
        `Target path is not a file: ${config.outputPath}.`,
      );
    }

    const currentContent = decodeContent(response.data);
    return {
      changed: currentContent !== renderedOutput,
      currentSha: response.data.sha,
    };
  } catch (error) {
    if (isNotFoundError(error)) {
      return { changed: true };
    }

    if (error instanceof BrewUpError) {
      throw error;
    }

    throw new BrewUpError(
      "TARGET_OUTPUT_READ_FAILED",
      `Failed to read target output file: ${config.outputPath}.`,
      error instanceof Error ? error.message : undefined,
    );
  }
}
