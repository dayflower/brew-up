import { fileURLToPath } from "node:url";
import * as core from "@actions/core";
import * as github from "@actions/github";
import { resolveChecksums } from "./checksum/index.js";
import { readInputs } from "./config/input.js";
import { validateInputs } from "./config/validate.js";
import { BrewUpError, formatErrorMessage } from "./errors.js";
import { resolveArtifacts } from "./github/assets.js";
import { resolveRelease } from "./github/release.js";
import { renderTemplate } from "./template/render.js";

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

    core.setOutput("resolved-release-id", String(release.id));
    core.setOutput("resolved-release-tag", release.tagName);
    core.info(
      "Milestone 2 complete: checksum resolution and template rendering finished. Publish flow starts in Milestone 3.",
    );
  } catch (error) {
    core.setFailed(formatErrorMessage(error));
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  void run();
}
