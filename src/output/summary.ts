import * as core from "@actions/core";
import type { SummaryInput } from "../types.js";

function checksumSourceText(source: "asset" | "download"): string {
  return source === "asset" ? "`checksum-asset`" : "direct download";
}

function buildArtifactRows(input: SummaryInput): string[][] {
  return Object.values(input.resolvedArtifacts.artifacts).map((artifact) => [
    artifact.key,
    artifact.name,
    artifact.url,
    artifact.sha256 ?? "(missing)",
  ]);
}

export async function writeWorkflowSummary(input: SummaryInput): Promise<void> {
  const summary = core.summary;

  summary.addHeading("brew-up result");
  summary.addRaw(
    `Release: **${input.release.tagName}** (#${input.release.id})\n\n`,
    true,
  );
  summary.addRaw(`Release URL: ${input.release.url}\n\n`, true);
  summary.addRaw(`Publish mode: \`${input.publishMode}\`\n\n`, true);
  summary.addRaw(
    `Checksum source: ${checksumSourceText(input.checksumSource)}\n\n`,
    true,
  );
  summary.addRaw(`Changed: \`${String(input.changed)}\`\n\n`, true);

  if (input.onlyIfChanged && !input.changed) {
    summary.addRaw(
      "Publish skipped: unchanged output with `only-if-changed=true`.\n\n",
      true,
    );
  } else if (input.dryRun) {
    summary.addRaw("Publish skipped: `dry-run=true`.\n\n", true);
  } else if (input.publishOutcome?.pullRequestUrl) {
    const autoMergeSuffix =
      input.publishOutcome.autoMergeEnabled === true
        ? " (auto-merge enabled)"
        : "";
    summary.addRaw(
      `Pull request: #${input.publishOutcome.pullRequestNumber} ${input.publishOutcome.pullRequestUrl}${autoMergeSuffix}\n\n`,
      true,
    );
  } else if (input.publishOutcome?.commitSha) {
    summary.addRaw(`Commit: \`${input.publishOutcome.commitSha}\`\n\n`, true);
  } else {
    summary.addRaw("Publish not performed.\n\n", true);
  }

  summary.addTable([
    [
      { data: "Key", header: true },
      { data: "Name", header: true },
      { data: "URL", header: true },
      { data: "SHA-256", header: true },
    ],
    ...buildArtifactRows(input),
  ]);

  await summary.write();
}
