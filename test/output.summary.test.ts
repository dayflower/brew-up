import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SummaryInput } from "../src/types.js";

const coreMock = vi.hoisted(() => {
  const summary = {
    addHeading: vi.fn(),
    addRaw: vi.fn(),
    addTable: vi.fn(),
    write: vi.fn(),
  };
  return { summary };
});

vi.mock("@actions/core", () => coreMock);

import { writeWorkflowSummary } from "../src/output/summary.js";

function makeInput(overrides: Partial<SummaryInput> = {}): SummaryInput {
  return {
    release: {
      id: 123,
      tagName: "v1.2.3",
      name: "Release 1.2.3",
      url: "https://example.test/release/123",
    },
    resolvedArtifacts: {
      artifacts: {
        default: {
          key: "default",
          name: "app.zip",
          url: "https://example.test/app.zip",
          apiUrl: "https://api.example.test/app.zip",
          sha256: "a".repeat(64),
        },
      },
    },
    renderedOutput: "cask \"app\" do\n  version \"1.2.3\"\nend",
    checksumSource: "asset",
    changed: true,
    publishMode: "pr",
    dryRun: false,
    onlyIfChanged: true,
    publishOutcome: {
      pullRequestNumber: 10,
      pullRequestUrl: "https://example.test/pr/10",
      autoMergeEnabled: false,
    },
    ...overrides,
  };
}

describe("writeWorkflowSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    coreMock.summary.addHeading.mockReturnValue(coreMock.summary);
    coreMock.summary.addRaw.mockReturnValue(coreMock.summary);
    coreMock.summary.addTable.mockReturnValue(coreMock.summary);
    coreMock.summary.write.mockResolvedValue(undefined);
  });

  it("writes minimal required summary sections", async () => {
    await writeWorkflowSummary(makeInput());

    expect(coreMock.summary.addHeading).toHaveBeenCalledWith("brew-up result");
    expect(coreMock.summary.addRaw).toHaveBeenCalledWith(
      expect.stringContaining("Release: **v1.2.3** (#123)"),
      true,
    );
    expect(coreMock.summary.addRaw).toHaveBeenCalledWith(
      expect.stringContaining("Checksum source"),
      true,
    );
    expect(coreMock.summary.addRaw).toHaveBeenCalledWith(
      expect.stringContaining("Rendered output:"),
      true,
    );
    expect(coreMock.summary.addRaw).toHaveBeenCalledWith(
      expect.stringContaining("````text\ncask \"app\" do"),
      true,
    );
    expect(coreMock.summary.addTable).toHaveBeenCalled();
    expect(coreMock.summary.write).toHaveBeenCalled();
  });

  it("writes unchanged skip message", async () => {
    await writeWorkflowSummary(
      makeInput({ changed: false, onlyIfChanged: true }),
    );

    expect(coreMock.summary.addRaw).toHaveBeenCalledWith(
      expect.stringContaining("Publish skipped: unchanged output"),
      true,
    );
  });

  it("writes dry-run skip message", async () => {
    await writeWorkflowSummary(makeInput({ dryRun: true }));

    expect(coreMock.summary.addRaw).toHaveBeenCalledWith(
      expect.stringContaining("Publish skipped: `dry-run=true`"),
      true,
    );
  });
});
