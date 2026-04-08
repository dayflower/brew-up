import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { renderTemplate } from "../src/template/render.js";
import type {
  ReleaseTemplateVariables,
  ResolvedArtifacts,
} from "../src/types.js";

const releaseVariables: ReleaseTemplateVariables = {
  version: "1.2.3",
  tag_name: "v1.2.3",
  release_id: "123",
  release_name: "Release v1.2.3",
  release_url: "https://example.test/release/123",
};

const checksummedArtifacts: ResolvedArtifacts = {
  artifacts: {
    default: {
      key: "default",
      name: "app.zip",
      url: "https://example.test/app.zip",
      apiUrl: "https://api.example.test/assets/1",
      sha256:
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    },
  },
  artifact: {
    key: "default",
    name: "app.zip",
    url: "https://example.test/app.zip",
    apiUrl: "https://api.example.test/assets/1",
    sha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  },
};

async function writeTemplate(content: string): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "brew-up-template-"));
  const templatePath = path.join(dir, "template.mustache");
  await writeFile(templatePath, content, "utf8");
  return templatePath;
}

describe("renderTemplate", () => {
  it("renders release and artifact variables", async () => {
    const templatePath = await writeTemplate(
      "{{version}}|{{artifacts.default.name}}|{{artifact.sha256}}",
    );

    const rendered = await renderTemplate(
      templatePath,
      releaseVariables,
      checksummedArtifacts,
    );

    expect(rendered).toBe(
      "1.2.3|app.zip|aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    );
  });

  it("fails when template references unknown variable", async () => {
    const templatePath = await writeTemplate("{{unknown.value}}");

    await expect(
      renderTemplate(templatePath, releaseVariables, checksummedArtifacts),
    ).rejects.toThrow(/unresolved variables/);
  });
});
