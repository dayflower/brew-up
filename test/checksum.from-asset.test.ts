import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveChecksumsFromAsset } from "../src/checksum/from-asset.js";
import type { ReleaseAsset, ResolvedArtifacts } from "../src/types.js";

const SHA_A = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const SHA_B = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

const releaseAssets: ReleaseAsset[] = [
  {
    id: 1,
    name: "checksums.txt",
    browserDownloadUrl: "https://example.test/checksums.txt",
    apiUrl: "https://api.example.test/assets/1",
  },
  {
    id: 2,
    name: "app.zip",
    browserDownloadUrl: "https://example.test/app.zip",
    apiUrl: "https://api.example.test/assets/2",
  },
];

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

describe("resolveChecksumsFromAsset", () => {
  it("parses GNU and BSD checksum lines", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        `${SHA_A}  app.zip\nSHA256 (ignored.tar.gz) = ${SHA_B}\n# comment\n`,
        { status: 200 },
      ),
    );

    const result = await resolveChecksumsFromAsset(
      "checksums.txt",
      releaseAssets,
      resolvedArtifacts,
    );

    expect(result.artifacts.default.sha256).toBe(SHA_A);
    expect(result.artifact?.sha256).toBe(SHA_A);
  });

  it("matches checksum entry by basename when full path is present", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(`${SHA_A}  dist/app.zip\n`, { status: 200 }),
    );

    const result = await resolveChecksumsFromAsset(
      "checksums.txt",
      releaseAssets,
      resolvedArtifacts,
    );

    expect(result.artifacts.default.sha256).toBe(SHA_A);
  });

  it("fails when checksum asset is missing", async () => {
    await expect(
      resolveChecksumsFromAsset("missing.txt", releaseAssets, resolvedArtifacts),
    ).rejects.toThrow(/was not found/);
  });

  it("fails on ambiguous basename matches", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(`${SHA_A}  out/app.zip\n${SHA_B}  build/app.zip\n`, {
        status: 200,
      }),
    );

    await expect(
      resolveChecksumsFromAsset("checksums.txt", releaseAssets, resolvedArtifacts),
    ).rejects.toThrow(/by basename/);
  });

  it("fails on invalid line format", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("not-a-checksum-line\n", { status: 200 }),
    );

    await expect(
      resolveChecksumsFromAsset("checksums.txt", releaseAssets, resolvedArtifacts),
    ).rejects.toThrow(/Invalid checksum line format/);
  });
});
