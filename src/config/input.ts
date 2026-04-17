import type { RawInputs } from "../types.js";

function readInput(
  getInput: (name: string, options?: { required?: boolean }) => string,
  name: string,
  required = false,
): string {
  return getInput(name, { required }).trim();
}

export function readInputs(
  getInput: (name: string, options?: { required?: boolean }) => string,
): RawInputs {
  return {
    releaseId: readInput(getInput, "release-id"),
    releaseTag: readInput(getInput, "release-tag"),
    templatePath: readInput(getInput, "template-path", true),
    outputPath: readInput(getInput, "output-path", true),
    assetMap: readInput(getInput, "asset-map", true),
    checksumAsset: readInput(getInput, "checksum-asset"),
    targetRepo: readInput(getInput, "target-repo", true),
    targetBranch: readInput(getInput, "target-branch", true),
    targetRepoToken: readInput(getInput, "target-repo-token", true),
    publishMode: readInput(getInput, "publish-mode", true),
    autoMergeMethod: readInput(getInput, "auto-merge-method") || "merge",
    onlyIfChanged: readInput(getInput, "only-if-changed") || "true",
    dryRun: readInput(getInput, "dry-run") || "false",
    commitAuthorName: readInput(getInput, "commit-author-name"),
    commitAuthorEmail: readInput(getInput, "commit-author-email"),
    publishMessageTemplate: readInput(getInput, "publish-message-template"),
  };
}
