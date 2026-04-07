import { describe, expect, it } from "vitest";
import {
  expandAssetPattern,
  parseAssetMap,
  resolveArtifacts,
} from "../src/github/assets.js";
import type { ReleaseAsset, ReleaseTemplateVariables } from "../src/types.js";

const variables: ReleaseTemplateVariables = {
  version: "1.2.3",
  tag_name: "v1.2.3",
  release_id: "100",
  release_name: "My App 1.2.3",
  release_url: "https://example.test/release",
};

const assets: ReleaseAsset[] = [
  {
    id: 1,
    name: "myapp-1.2.3.zip",
    browserDownloadUrl: "https://example.test/myapp-1.2.3.zip",
    apiUrl: "https://api.example.test/assets/1",
  },
  {
    id: 2,
    name: "myapp-1.2.3-darwin-arm64.zip",
    browserDownloadUrl: "https://example.test/myapp-1.2.3-darwin-arm64.zip",
    apiUrl: "https://api.example.test/assets/2",
  },
];

describe("parseAssetMap", () => {
  it("parses multi-line key=value pairs with trim and blank lines", () => {
    const parsed = parseAssetMap(
      `\n  default = myapp-{{version}}.zip\n darwin = myapp-{{version}}-darwin-*.zip\n\n`,
    );
    expect(parsed).toEqual([
      { key: "default", pattern: "myapp-{{version}}.zip" },
      { key: "darwin", pattern: "myapp-{{version}}-darwin-*.zip" },
    ]);
  });

  it("rejects duplicate keys", () => {
    expect(() => parseAssetMap("a=x\na=y")).toThrow(/Duplicate asset-map key/);
  });

  it("rejects malformed lines", () => {
    expect(() => parseAssetMap("missing_separator")).toThrow(
      /Invalid asset-map line/,
    );
    expect(() => parseAssetMap("k=")).toThrow(/Invalid asset-map line/);
  });
});

describe("expandAssetPattern", () => {
  it("expands known release variables", () => {
    expect(expandAssetPattern("myapp-{{version}}.zip", variables)).toBe(
      "myapp-1.2.3.zip",
    );
  });

  it("rejects unknown variables", () => {
    expect(() => expandAssetPattern("x-{{unknown}}", variables)).toThrow(
      /unknown variable/,
    );
  });
});

describe("resolveArtifacts", () => {
  it("resolves exact and glob patterns", () => {
    const entries = parseAssetMap(
      "default=myapp-{{version}}.zip\ndarwin=myapp-{{version}}-darwin-*.zip",
    );
    const resolved = resolveArtifacts(entries, assets, variables);

    expect(resolved.artifacts.default.name).toBe("myapp-1.2.3.zip");
    expect(resolved.artifacts.darwin.name).toBe("myapp-1.2.3-darwin-arm64.zip");
    expect(resolved.artifact).toBeUndefined();
  });

  it("creates artifact alias when single key exists", () => {
    const entries = parseAssetMap("default=myapp-{{version}}.zip");
    const resolved = resolveArtifacts(entries, assets, variables);

    expect(resolved.artifact?.name).toBe("myapp-1.2.3.zip");
    expect(resolved.artifact?.key).toBe("default");
  });

  it("fails when no asset matches", () => {
    const entries = parseAssetMap("default=nope-{{version}}.zip");
    expect(() => resolveArtifacts(entries, assets, variables)).toThrow(
      /matched no release assets/,
    );
  });

  it("fails when multiple assets match", () => {
    const entries = parseAssetMap("default=myapp-{{version}}*.zip");
    expect(() => resolveArtifacts(entries, assets, variables)).toThrow(
      /matched multiple assets/,
    );
  });
});
