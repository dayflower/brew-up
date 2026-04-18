import { BrewUpError } from "../errors.js";
import { parseAssetMap } from "../github/assets.js";
import type {
  AutoMergeMethod,
  PublishAttribution,
  PublishMode,
  RawInputs,
  ValidatedInputs,
} from "../types.js";

const VALID_PUBLISH_MODES = new Set<PublishMode>([
  "direct",
  "pr",
  "pr-auto-merge",
]);
const VALID_AUTO_MERGE_METHODS = new Set<AutoMergeMethod>([
  "merge",
  "squash",
  "rebase",
]);
const VALID_PUBLISH_ATTRIBUTIONS = new Set<PublishAttribution>([
  "off",
  "commit",
  "pr",
  "both",
]);
const TARGET_REPO_PATTERN = /^[^/\s]+\/[^/\s]+$/;

function defaultPublishTitleTemplate(): string {
  return "brew-up: update {{output_path}} for {{tag_name}}";
}

function parseStrictBoolean(name: string, value: string): boolean {
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }

  throw new BrewUpError(
    "INVALID_INPUT",
    `Input ${name} must be either "true" or "false".`,
    `Received: "${value}"`,
  );
}

function parseReleaseId(releaseId: string): number | undefined {
  if (releaseId === "") {
    return undefined;
  }

  const parsed = Number(releaseId);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new BrewUpError(
      "INVALID_INPUT",
      "Input release-id must be a positive integer.",
    );
  }

  return parsed;
}

function parseAutoMergeMethod(raw: RawInputs): AutoMergeMethod {
  if (raw.publishMode !== "pr-auto-merge") {
    return "merge";
  }

  if (VALID_AUTO_MERGE_METHODS.has(raw.autoMergeMethod as AutoMergeMethod)) {
    return raw.autoMergeMethod as AutoMergeMethod;
  }

  throw new BrewUpError(
    "INVALID_INPUT",
    `Input auto-merge-method has unsupported value: "${raw.autoMergeMethod}".`,
    "Allowed values are merge, squash, rebase.",
  );
}

function parsePublishAttribution(raw: RawInputs): PublishAttribution {
  const value = raw.publishAttribution || "both";
  if (VALID_PUBLISH_ATTRIBUTIONS.has(value as PublishAttribution)) {
    return value as PublishAttribution;
  }

  throw new BrewUpError(
    "INVALID_INPUT",
    `Input publish-attribution has unsupported value: "${value}".`,
    "Allowed values are off, commit, pr, both.",
  );
}

function validateTitleTemplate(raw: RawInputs): string {
  const titleTemplate =
    raw.publishTitleTemplate || defaultPublishTitleTemplate();
  if (/[\r\n]/.test(titleTemplate)) {
    throw new BrewUpError(
      "INVALID_INPUT",
      "Input publish-title-template must be a single line.",
    );
  }

  return titleTemplate;
}

export function validateInputs(raw: RawInputs): ValidatedInputs {
  if (!VALID_PUBLISH_MODES.has(raw.publishMode as PublishMode)) {
    throw new BrewUpError(
      "UNSUPPORTED_MODE",
      `Input publish-mode has unsupported value: "${raw.publishMode}".`,
      "Allowed values are direct, pr, pr-auto-merge.",
    );
  }

  if (!TARGET_REPO_PATTERN.test(raw.targetRepo)) {
    throw new BrewUpError(
      "INVALID_INPUT",
      "Input target-repo must be in owner/name format.",
    );
  }

  const hasAuthorName = raw.commitAuthorName !== "";
  const hasAuthorEmail = raw.commitAuthorEmail !== "";
  if (hasAuthorName !== hasAuthorEmail) {
    throw new BrewUpError(
      "INVALID_INPUT",
      "Inputs commit-author-name and commit-author-email must be set together.",
    );
  }

  const [owner, name] = raw.targetRepo.split("/");
  return {
    releaseId: parseReleaseId(raw.releaseId),
    releaseTag: raw.releaseTag || undefined,
    templatePath: raw.templatePath,
    outputPath: raw.outputPath,
    assetMapEntries: parseAssetMap(raw.assetMap),
    checksumAsset: raw.checksumAsset || undefined,
    targetRepo: {
      owner,
      name,
      fullName: raw.targetRepo,
    },
    targetBranch: raw.targetBranch,
    targetRepoToken: raw.targetRepoToken,
    publishMode: raw.publishMode as PublishMode,
    autoMergeMethod: parseAutoMergeMethod(raw),
    onlyIfChanged: parseStrictBoolean("only-if-changed", raw.onlyIfChanged),
    dryRun: parseStrictBoolean("dry-run", raw.dryRun),
    commitAuthor: hasAuthorName
      ? {
          name: raw.commitAuthorName,
          email: raw.commitAuthorEmail,
        }
      : undefined,
    publishTitleTemplate: validateTitleTemplate(raw),
    publishBodyTemplate: raw.publishBodyTemplate,
    publishAttribution: parsePublishAttribution(raw),
  };
}
