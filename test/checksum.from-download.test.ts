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
  vi.useRealTimers();
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

    await expect(
      resolveChecksumsFromDownload(resolvedArtifacts),
    ).rejects.toThrow(/Failed to download artifact/);
  });

  it("retries transient failures and then succeeds", async () => {
    vi.useFakeTimers();
    const data = Buffer.from("retry-success");
    const expectedHash = createHash("sha256").update(data).digest("hex");

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("busy", { status: 503 }))
      .mockResolvedValueOnce(new Response("busy", { status: 503 }))
      .mockResolvedValueOnce(new Response(data, { status: 200 }));

    const pending = resolveChecksumsFromDownload(resolvedArtifacts);
    await vi.advanceTimersByTimeAsync(2_000);

    const result = await pending;
    expect(result.artifacts.default.sha256).toBe(expectedHash);
    expect(globalThis.fetch).toHaveBeenCalledTimes(3);
  });

  it("supports stream hashing for large payloads without arrayBuffer()", async () => {
    const data = Buffer.from("chunk-data-".repeat(200_000), "utf8");
    const expectedHash = createHash("sha256").update(data).digest("hex");

    const response = new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          const chunkSize = 16 * 1024;
          for (let index = 0; index < data.length; index += chunkSize) {
            controller.enqueue(data.subarray(index, index + chunkSize));
          }
          controller.close();
        },
      }),
      { status: 200 },
    );
    vi.spyOn(response, "arrayBuffer").mockRejectedValue(
      new Error("arrayBuffer should not be used"),
    );
    vi.spyOn(globalThis, "fetch").mockResolvedValue(response);

    const result = await resolveChecksumsFromDownload(resolvedArtifacts);
    expect(result.artifacts.default.sha256).toBe(expectedHash);
    expect(result.artifact?.sha256).toBe(expectedHash);
  });
});
