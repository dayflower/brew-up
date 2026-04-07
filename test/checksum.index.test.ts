import { beforeEach, describe, expect, it, vi } from "vitest";

const fromAsset = vi.hoisted(() => ({
  resolveChecksumsFromAsset: vi.fn(),
}));
const fromDownload = vi.hoisted(() => ({
  resolveChecksumsFromDownload: vi.fn(),
}));

vi.mock("../src/checksum/from-asset.js", () => fromAsset);
vi.mock("../src/checksum/from-download.js", () => fromDownload);

import { resolveChecksums } from "../src/checksum/index.js";

const release = {
  id: 1,
  tagName: "v1.2.3",
  name: "Release v1.2.3",
  url: "https://example.test/release/1",
  version: "1.2.3",
  assets: [],
};

const resolvedArtifacts = {
  artifacts: {
    default: {
      key: "default",
      name: "app.zip",
      url: "https://example.test/app.zip",
      apiUrl: "https://api.example.test/assets/2",
    },
  },
};

describe("resolveChecksums", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses checksum-asset mode when checksumAsset is set", async () => {
    fromAsset.resolveChecksumsFromAsset.mockResolvedValue(resolvedArtifacts);

    await resolveChecksums({
      checksumAsset: "checksums.txt",
      release,
      resolvedArtifacts,
    });

    expect(fromAsset.resolveChecksumsFromAsset).toHaveBeenCalledWith(
      "checksums.txt",
      release.assets,
      resolvedArtifacts,
    );
    expect(fromDownload.resolveChecksumsFromDownload).not.toHaveBeenCalled();
  });

  it("uses download mode when checksumAsset is absent", async () => {
    fromDownload.resolveChecksumsFromDownload.mockResolvedValue(resolvedArtifacts);

    await resolveChecksums({
      release,
      resolvedArtifacts,
    });

    expect(fromDownload.resolveChecksumsFromDownload).toHaveBeenCalledWith(
      resolvedArtifacts,
    );
    expect(fromAsset.resolveChecksumsFromAsset).not.toHaveBeenCalled();
  });
});
