import type { ValidatedInputs } from "../types.js";

interface CommitIdentity {
  name: string;
  email: string;
}

interface CreateOrUpdateFileRequest {
  owner: string;
  repo: string;
  path: string;
  branch: string;
  message: string;
  content: string;
  sha?: string;
  committer?: CommitIdentity;
  author?: CommitIdentity;
}

type PublishConfig = Pick<
  ValidatedInputs,
  "outputPath" | "targetRepo" | "commitAuthor"
>;

export function buildCommitMessage(
  outputPath: string,
  tagName: string,
): string {
  return `brew-up: update ${outputPath} for ${tagName}`;
}

export function buildFileWriteRequest(
  config: PublishConfig,
  branch: string,
  renderedOutput: string,
  options: { currentSha?: string; releaseTag: string },
): CreateOrUpdateFileRequest {
  return {
    owner: config.targetRepo.owner,
    repo: config.targetRepo.name,
    path: config.outputPath,
    branch,
    message: buildCommitMessage(config.outputPath, options.releaseTag),
    content: Buffer.from(renderedOutput, "utf8").toString("base64"),
    sha: options.currentSha,
    committer: config.commitAuthor,
    author: config.commitAuthor,
  };
}
