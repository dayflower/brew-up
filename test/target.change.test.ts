import { describe, expect, it, vi } from "vitest";
import { detectChange } from "../src/target/change.js";

function createClient(
  getContentImpl: (params: unknown) => Promise<{ data: unknown }>,
) {
  return {
    rest: {
      repos: {
        getContent: vi.fn(getContentImpl),
      },
    },
  };
}

const config = {
  outputPath: "Casks/app.rb",
  targetRepo: { owner: "owner", name: "tap", fullName: "owner/tap" },
  targetBranch: "main",
};

describe("detectChange", () => {
  it("returns changed=false when content is equal", async () => {
    const rendered = "same-content";
    const client = createClient(async () => ({
      data: {
        type: "file",
        encoding: "base64",
        content: Buffer.from(rendered, "utf8").toString("base64"),
        sha: "abc123",
      },
    }));

    const result = await detectChange(client, config, rendered);

    expect(result).toEqual({ changed: false, currentSha: "abc123" });
  });

  it("returns changed=true when content differs", async () => {
    const client = createClient(async () => ({
      data: {
        type: "file",
        encoding: "base64",
        content: Buffer.from("old-content", "utf8").toString("base64"),
        sha: "abc123",
      },
    }));

    const result = await detectChange(client, config, "new-content");

    expect(result).toEqual({ changed: true, currentSha: "abc123" });
  });

  it("returns changed=true when output file does not exist", async () => {
    const error = Object.assign(new Error("Not Found"), { status: 404 });
    const client = createClient(async () => {
      throw error;
    });

    const result = await detectChange(client, config, "new-content");

    expect(result).toEqual({ changed: true });
  });

  it("fails when target path is not a file", async () => {
    const client = createClient(async () => ({ data: [] }));

    await expect(detectChange(client, config, "x")).rejects.toThrow(
      /not a file/,
    );
  });
});
