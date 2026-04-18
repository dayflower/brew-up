import { describe, expect, it } from "vitest";
import { validateInputs } from "../src/config/validate.js";
import type { RawInputs } from "../src/types.js";

function baseRawInputs(): RawInputs {
  return {
    releaseId: "",
    releaseTag: "v1.2.3",
    templatePath: "templates/cask.rb.mustache",
    outputPath: "Casks/myapp.rb",
    assetMap: "default=myapp-{{version}}.zip",
    checksumAsset: "",
    targetRepo: "owner/tap",
    targetBranch: "main",
    targetRepoToken: "token",
    publishMode: "direct",
    autoMergeMethod: "merge",
    onlyIfChanged: "true",
    dryRun: "false",
    commitAuthorName: "",
    commitAuthorEmail: "",
    publishTitleTemplate: "",
    publishBodyTemplate: "",
    publishAttribution: "",
  };
}

describe("validateInputs", () => {
  it("accepts valid inputs", () => {
    const validated = validateInputs(baseRawInputs());

    expect(validated.publishMode).toBe("direct");
    expect(validated.autoMergeMethod).toBe("merge");
    expect(validated.onlyIfChanged).toBe(true);
    expect(validated.dryRun).toBe(false);
    expect(validated.targetRepo.owner).toBe("owner");
    expect(validated.targetRepo.name).toBe("tap");
  });

  it("rejects invalid publish-mode", () => {
    const raw = baseRawInputs();
    raw.publishMode = "invalid";

    expect(() => validateInputs(raw)).toThrow(/unsupported value/);
  });

  it("rejects invalid target-repo format", () => {
    const raw = baseRawInputs();
    raw.targetRepo = "owner";

    expect(() => validateInputs(raw)).toThrow(/owner\/name/);
  });

  it("requires strict booleans", () => {
    const raw = baseRawInputs();
    raw.onlyIfChanged = "yes";

    expect(() => validateInputs(raw)).toThrow(/either "true" or "false"/);
  });

  it("requires paired commit author inputs", () => {
    const raw = baseRawInputs();
    raw.commitAuthorName = "alice";

    expect(() => validateInputs(raw)).toThrow(/must be set together/);
  });

  it("parses release-id when provided", () => {
    const raw = baseRawInputs();
    raw.releaseId = "42";

    const validated = validateInputs(raw);
    expect(validated.releaseId).toBe(42);
  });

  it("uses default publish title template when input is empty", () => {
    const validated = validateInputs(baseRawInputs());
    expect(validated.publishTitleTemplate).toBe(
      "brew-up: update {{output_path}} for {{tag_name}}",
    );
  });

  it("accepts custom publish title template", () => {
    const raw = baseRawInputs();
    raw.publishTitleTemplate = "release {{tag_name}}";

    const validated = validateInputs(raw);
    expect(validated.publishTitleTemplate).toBe("release {{tag_name}}");
  });

  it("accepts custom publish body template", () => {
    const raw = baseRawInputs();
    raw.publishBodyTemplate = "From {{release_url}}";

    const validated = validateInputs(raw);
    expect(validated.publishBodyTemplate).toBe("From {{release_url}}");
  });

  it("uses default publish attribution when input is empty", () => {
    const validated = validateInputs(baseRawInputs());
    expect(validated.publishAttribution).toBe("both");
  });

  it("rejects multi-line publish title template", () => {
    const raw = baseRawInputs();
    raw.publishTitleTemplate = "line1\nline2";

    expect(() => validateInputs(raw)).toThrow(/single line/);
  });

  it("rejects invalid publish-attribution", () => {
    const raw = baseRawInputs();
    raw.publishAttribution = "invalid";

    expect(() => validateInputs(raw)).toThrow(/publish-attribution/);
  });

  it("accepts auto-merge-method when publish-mode is pr-auto-merge", () => {
    const raw = baseRawInputs();
    raw.publishMode = "pr-auto-merge";
    raw.autoMergeMethod = "squash";

    const validated = validateInputs(raw);
    expect(validated.autoMergeMethod).toBe("squash");
  });

  it("rejects invalid auto-merge-method when publish-mode is pr-auto-merge", () => {
    const raw = baseRawInputs();
    raw.publishMode = "pr-auto-merge";
    raw.autoMergeMethod = "invalid";

    expect(() => validateInputs(raw)).toThrow(/auto-merge-method/);
  });

  it("ignores auto-merge-method when publish-mode is not pr-auto-merge", () => {
    const raw = baseRawInputs();
    raw.publishMode = "direct";
    raw.autoMergeMethod = "invalid";

    const validated = validateInputs(raw);
    expect(validated.autoMergeMethod).toBe("merge");
  });
});
