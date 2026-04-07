import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveChecksumsFromDownload } from "../src/checksum/from-download.js";
import type { ResolvedArtifacts } from "../src/types.js";

const resolvedArtifacts: ResolvedArtifacts = {
  artifacts: {
    default: {
      key: "default",
      name: "app.zip",
      url: "https://example.test/app.zip",
      apiUrl: "https://api.example.test/assets/2",
    },
  },
  artifact: {
    key: "default",
    name: "app.zip",
    url: "https://example.test/app.zip",
    apiUrl: "https://api.example.test/assets/2",
  },
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("resolveChecksumsFromDownload", () => {
  it("calculates SHA-256 from downloaded bytes", async () => {
    const data = Buffer.from("brew-up");
    const expectedHash = createHash("sha256").update(data).digest("hex");

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(data, { status: 200 }),
    );

    const result = await resolveChecksumsFromDownload(resolvedArtifacts);
    expect(result.artifacts.default.sha256).toBe(expectedHash);
    expect(result.artifact?.sha256).toBe(expectedHash);
  });

  it("fails when download returns non-2xx", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("error", { status: 500 }),
    );

    await expect(resolveChecksumsFromDownload(resolvedArtifacts)).rejects.toThrow(
      /Failed to download artifact/,
    );
  });
});
