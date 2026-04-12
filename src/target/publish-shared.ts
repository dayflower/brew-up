import Mustache from "mustache";
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
  "outputPath" | "targetRepo" | "commitAuthor" | "publishMessageTemplate"
>;

export interface PublishMessageVariables {
  version: string;
  tag_name: string;
  release_id: string;
  release_name: string;
  release_url: string;
}

const PLACEHOLDER_PATTERN = /\{\{\{?\s*([a-zA-Z0-9_.]+)\s*\}\}?\}/g;

function hasPath(target: unknown, path: string): boolean {
  const keys = path.split(".");
  let current: unknown = target;

  for (const key of keys) {
    if (
      current === null ||
      current === undefined ||
      typeof current !== "object" ||
      !(key in current)
    ) {
      return false;
    }

    current = (current as Record<string, unknown>)[key];
  }

  return true;
}

function replaceMissingPlaceholdersWithUnknown(
  template: string,
  context: PublishMessageVariables,
): string {
  return template.replaceAll(PLACEHOLDER_PATTERN, (fullMatch, variableName) => {
    return hasPath(context, variableName) ? fullMatch : "UNKNOWN";
  });
}

export function buildPublishMessage(
  publishMessageTemplate: string,
  variables: PublishMessageVariables,
): string {
  const template = replaceMissingPlaceholdersWithUnknown(
    publishMessageTemplate,
    variables,
  );
  return Mustache.render(template, variables, undefined, {
    escape: (value) => String(value),
  });
}

export function buildFileWriteRequest(
  config: PublishConfig,
  branch: string,
  renderedOutput: string,
  options: { currentSha?: string; messageVariables: PublishMessageVariables },
): CreateOrUpdateFileRequest {
  return {
    owner: config.targetRepo.owner,
    repo: config.targetRepo.name,
    path: config.outputPath,
    branch,
    message: buildPublishMessage(
      config.publishMessageTemplate,
      options.messageVariables,
    ),
    content: Buffer.from(renderedOutput, "utf8").toString("base64"),
    sha: options.currentSha,
    committer: config.commitAuthor,
    author: config.commitAuthor,
  };
}
