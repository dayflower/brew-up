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
    onlyIfChanged: "true",
    dryRun: "false",
    commitAuthorName: "",
    commitAuthorEmail: "",
    publishMessageTemplate: "",
  };
}

describe("validateInputs", () => {
  it("accepts valid inputs", () => {
    const validated = validateInputs(baseRawInputs());

    expect(validated.publishMode).toBe("direct");
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

  it("uses default publish message template when input is empty", () => {
    const validated = validateInputs(baseRawInputs());
    expect(validated.publishMessageTemplate).toBe(
      "brew-up: update Casks/myapp.rb for {{tag_name}}",
    );
  });

  it("accepts custom publish message template", () => {
    const raw = baseRawInputs();
    raw.publishMessageTemplate = "release {{tag_name}}";

    const validated = validateInputs(raw);
    expect(validated.publishMessageTemplate).toBe("release {{tag_name}}");
  });
});
