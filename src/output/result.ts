import * as core from "@actions/core";
import type { PublishOutcome } from "../types.js";

interface BaseOutputs {
  changed: boolean;
  releaseId: number;
  releaseTag: string;
}

export function setBaseOutputs(output: BaseOutputs): void {
  core.setOutput("changed", String(output.changed));
  core.setOutput("resolved-release-id", String(output.releaseId));
  core.setOutput("resolved-release-tag", output.releaseTag);
}

export function setPublishOutputs(outcome: PublishOutcome): void {
  if (outcome.commitSha) {
    core.setOutput("target-commit-sha", outcome.commitSha);
  }
  if (outcome.pullRequestNumber !== undefined) {
    core.setOutput("pull-request-number", String(outcome.pullRequestNumber));
  }
  if (outcome.pullRequestUrl) {
    core.setOutput("pull-request-url", outcome.pullRequestUrl);
  }
}
