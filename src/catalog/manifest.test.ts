import { describe, expect, it } from "vitest";
import {
  EMPTY_CATALOG_MANIFEST,
  loadCatalogManifest,
  validateCatalogManifest,
  type CatalogManifest,
} from "./manifest";

const validManifest: CatalogManifest = {
  version: 1,
  assets: [
    {
      id: "chair-001",
      name: "Example chair",
      category: "asset",
      uri: "./models/chair.glb",
      dimensions: { width: 0.5, height: 0.9, depth: 0.5 },
      formats: ["glb"],
      previews: ["https://example.com/previews/chair.jpg"],
      tags: ["chair", "seating"],
      rights: {
        provenance: "provided example record",
        source: "https://example.com/source/chair",
        license: "CC0",
        permission: "documented permission",
      },
    },
  ],
};

describe("catalog manifest", () => {
  it("accepts the explicit empty manifest", () => {
    expect(validateCatalogManifest(EMPTY_CATALOG_MANIFEST)).toEqual({ valid: true, errors: [] });
    expect(loadCatalogManifest(JSON.stringify(EMPTY_CATALOG_MANIFEST))).toEqual(EMPTY_CATALOG_MANIFEST);
  });

  it("accepts a valid asset manifest", () => {
    expect(validateCatalogManifest(validManifest)).toEqual({ valid: true, errors: [] });
    expect(loadCatalogManifest(JSON.stringify(validManifest))).toEqual(validManifest);
  });

  it("rejects duplicate IDs", () => {
    const duplicate = {
      ...validManifest,
      assets: [validManifest.assets[0], { ...validManifest.assets[0], name: "Another chair" }],
    };
    const result = validateCatalogManifest(duplicate);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("duplicate asset id: chair-001");
  });

  it("rejects unsafe URLs and traversal paths", () => {
    const unsafe = {
      ...validManifest,
      assets: [{ ...validManifest.assets[0], uri: "javascript:alert(1)" }],
    };
    expect(validateCatalogManifest(unsafe).valid).toBe(false);

    const traversal = {
      ...validManifest,
      assets: [{ ...validManifest.assets[0], uri: "./models/../chair.glb" }],
    };
    expect(validateCatalogManifest(traversal).valid).toBe(false);
  });

  it("rejects rights without a source", () => {
    const missingSource = {
      ...validManifest,
      assets: [{
        ...validManifest.assets[0],
        rights: { ...validManifest.assets[0].rights, source: "" },
      }],
    };
    const result = validateCatalogManifest(missingSource);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("assets[0].rights.source is required");
  });

  it("returns null for malformed JSON", () => {
    expect(loadCatalogManifest("{not valid json")).toBeNull();
    expect(loadCatalogManifest(JSON.stringify({ version: 1, assets: "nope" }))).toBeNull();
  });
});
