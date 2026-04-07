import * as core from "@actions/core";
import * as github from "@actions/github";
import { readInputs } from "./config/input";
import { validateInputs } from "./config/validate";
import { BrewUpError, formatErrorMessage } from "./errors";
import { resolveArtifacts } from "./github/assets";
import { resolveRelease } from "./github/release";

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

    core.info(`Resolved release: id=${release.id}, tag=${release.tagName}`);
    core.info(
      `Resolved artifact keys: ${Object.keys(resolved.artifacts).join(", ")}`,
    );

    core.setOutput("resolved-release-id", String(release.id));
    core.setOutput("resolved-release-tag", release.tagName);

    throw new BrewUpError(
      "UNIMPLEMENTED_MILESTONE",
      "Milestone 1 complete: checksum, template rendering, and publish phases are not implemented yet.",
    );
  } catch (error) {
    core.setFailed(formatErrorMessage(error));
  }
}

void run();
