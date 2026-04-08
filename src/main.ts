import { fileURLToPath } from "node:url";
import * as core from "@actions/core";
import * as github from "@actions/github";
import { resolveChecksums } from "./checksum/index.js";
import { readInputs } from "./config/input.js";
import { validateInputs } from "./config/validate.js";
import { BrewUpError, formatErrorMessage } from "./errors.js";
import { resolveArtifacts } from "./github/assets.js";
import { resolveRelease } from "./github/release.js";
import { setBaseOutputs, setPublishOutputs } from "./output/result.js";
import { writeWorkflowSummary } from "./output/summary.js";
import { renderTemplate } from "./template/render.js";
import { enableAutoMerge } from "./target/auto-merge.js";
import { detectChange } from "./target/change.js";
import { publishDirect } from "./target/publish-direct.js";
import { publishPr } from "./target/publish-pr.js";
import type { PublishOutcome } from "./types.js";

function getGitHubToken(): string {
  const token = process.env.GITHUB_TOKEN?.trim();
  if (!token) {
    throw new BrewUpError(
      "INVALID_INPUT",
      "GITHUB_TOKEN environment variable is required for release resolution in repository A.",
    );
  }

  return token;
}

function getRunId(): string {
  const envRunId = process.env.GITHUB_RUN_ID?.trim();
  if (envRunId) {
    return envRunId;
  }
  if (github.context.runId) {
    return String(github.context.runId);
  }

  throw new BrewUpError(
    "INVALID_INPUT",
    "GITHUB_RUN_ID environment variable is required for PR publish modes.",
  );
}

export async function run(): Promise<void> {
  try {
    const raw = readInputs(core.getInput);
    const config = validateInputs(raw);

    const sourceContext = {
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      eventReleaseId:
        typeof github.context.payload.release?.id === "number"
          ? github.context.payload.release.id
          : undefined,
      eventReleaseTag:
        typeof github.context.payload.release?.tag_name === "string"
          ? github.context.payload.release.tag_name
          : undefined,
    };

    const octokit = github.getOctokit(getGitHubToken());
    const release = await resolveRelease(octokit, sourceContext, {
      releaseId: config.releaseId,
      releaseTag: config.releaseTag,
    });

    const variables = {
      version: release.version,
      tag_name: release.tagName,
      release_id: String(release.id),
      release_name: release.name,
      release_url: release.url,
    };

    const resolved = resolveArtifacts(
      config.assetMapEntries,
      release.assets,
      variables,
    );
    const checksummed = await resolveChecksums({
      checksumAsset: config.checksumAsset,
      release,
      resolvedArtifacts: resolved,
    });
    const renderedOutput = await renderTemplate(
      config.templatePath,
      variables,
      checksummed,
    );

    core.info(`Resolved release: id=${release.id}, tag=${release.tagName}`);
    core.info(
      `Resolved artifact keys: ${Object.keys(checksummed.artifacts).join(", ")}`,
    );
    core.info(`Rendered output bytes: ${Buffer.byteLength(renderedOutput, "utf8")}`);

    const targetOctokit = github.getOctokit(config.targetRepoToken);
    const change = await detectChange(targetOctokit, config, renderedOutput);

    setBaseOutputs({
      changed: change.changed,
      releaseId: release.id,
      releaseTag: release.tagName,
    });

    const shouldSkipForNoChange = !change.changed && config.onlyIfChanged;
    if (shouldSkipForNoChange) {
      core.info("No output change detected; skipping publish.");
      await writeWorkflowSummary({
        release,
        resolvedArtifacts: checksummed,
        checksumSource: config.checksumAsset ? "asset" : "download",
        changed: change.changed,
        publishMode: config.publishMode,
        dryRun: config.dryRun,
        onlyIfChanged: config.onlyIfChanged,
      });
      return;
    }

    let publishOutcome: PublishOutcome | undefined;

    if (config.dryRun) {
      core.info("Dry run enabled; skipping publish.");
      await writeWorkflowSummary({
        release,
        resolvedArtifacts: checksummed,
        checksumSource: config.checksumAsset ? "asset" : "download",
        changed: change.changed,
        publishMode: config.publishMode,
        dryRun: config.dryRun,
        onlyIfChanged: config.onlyIfChanged,
      });
      return;
    }

    if (config.publishMode === "direct") {
      const published = await publishDirect(targetOctokit, config, renderedOutput, {
        currentSha: change.currentSha,
        releaseTag: release.tagName,
      });
      publishOutcome = { commitSha: published.commitSha };
      core.info(`Published output commit: ${published.commitSha}`);
    } else {
      const published = await publishPr(targetOctokit, config, renderedOutput, {
        currentSha: change.currentSha,
        releaseTag: release.tagName,
        runId: getRunId(),
      });

      publishOutcome = {
        commitSha: published.commitSha,
        pullRequestNumber: published.pullRequestNumber,
        pullRequestUrl: published.pullRequestUrl,
        autoMergeEnabled: false,
      };

      if (config.publishMode === "pr-auto-merge") {
        await enableAutoMerge(targetOctokit, published.pullRequestNodeId);
        publishOutcome.autoMergeEnabled = true;
      }

      core.info(`Published output commit: ${published.commitSha}`);
      core.info(
        `Published pull request: #${published.pullRequestNumber} ${published.pullRequestUrl}`,
      );
    }

    setPublishOutputs(publishOutcome);
    await writeWorkflowSummary({
      release,
      resolvedArtifacts: checksummed,
      checksumSource: config.checksumAsset ? "asset" : "download",
      changed: change.changed,
      publishMode: config.publishMode,
      dryRun: config.dryRun,
      onlyIfChanged: config.onlyIfChanged,
      publishOutcome,
    });
  } catch (error) {
    core.setFailed(formatErrorMessage(error));
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  void run();
}
