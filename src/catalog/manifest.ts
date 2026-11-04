export const CATALOG_MANIFEST_VERSION = 1 as const;

export type CatalogCategory = "asset" | "material" | "texture";

export interface CatalogDimensions {
  width: number;
  height: number;
  depth: number;
}

export interface CatalogRights {
  provenance: string;
  source: string;
  license: string;
  permission: string;
}

export interface CatalogAsset {
  id: string;
  name: string;
  category: CatalogCategory;
  uri: string;
  dimensions: CatalogDimensions;
  formats: string[];
  previews: string[];
  tags: string[];
  rights: CatalogRights;
}

export interface CatalogManifest {
  version: typeof CATALOG_MANIFEST_VERSION;
  assets: CatalogAsset[];
}

export interface CatalogValidationResult {
  valid: boolean;
  errors: string[];
}

/** A deliberately empty manifest: no asset records or rights claims are invented here. */
export const EMPTY_CATALOG_MANIFEST: CatalogManifest = {
  version: CATALOG_MANIFEST_VERSION,
  assets: [],
};

const DANGEROUS_SCHEME = /^(?:javascript|data|vbscript):/i;
const TRAVERSAL_SEGMENT = /(?:^|[\\/])\.\.(?:[\\/]|$)/;
const CONTROL_CHARACTER = /[\u0000-\u001f\u007f]/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isSafeLocation(value: unknown): value is string {
  if (!isNonEmptyString(value) || CONTROL_CHARACTER.test(value) || DANGEROUS_SCHEME.test(value.trim())) {
    return false;
  }

  // Only web URLs and relative/root paths are accepted; filesystem and other schemes are not.
  const isHttpUrl = /^https?:\/\//i.test(value.trim());
  const hasOtherScheme = /^[a-z][a-z\d+.-]*:/i.test(value.trim()) && !isHttpUrl;
  return !hasOtherScheme && !TRAVERSAL_SEGMENT.test(value);
}

function validateStringArray(
  value: unknown,
  field: string,
  errors: string[],
  options: { locations?: boolean } = {},
): value is string[] {
  if (!Array.isArray(value) || value.length === 0 && field === "formats") {
    errors.push(`${field} must be a non-empty array of strings`);
    return false;
  }

  let valid = true;
  const seen = new Set<string>();
  value.forEach((item, index) => {
    const validItem = options.locations ? isSafeLocation(item) : isNonEmptyString(item);
    if (!validItem) {
      errors.push(`${field}[${index}] is invalid`);
      valid = false;
    }
    if (typeof item === "string") {
      const normalized = item.trim().toLowerCase();
      if (seen.has(normalized)) {
        errors.push(`${field} must not contain duplicates`);
        valid = false;
      }
      seen.add(normalized);
    }
  });
  return valid;
}

function validateAsset(value: unknown, index: number, ids: Set<string>, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push(`assets[${index}] must be an object`);
    return;
  }

  const prefix = `assets[${index}]`;
  if (!isNonEmptyString(value.id)) errors.push(`${prefix}.id is required`);
  else if (ids.has(value.id)) errors.push(`duplicate asset id: ${value.id}`);
  else ids.add(value.id);

  if (!isNonEmptyString(value.name)) errors.push(`${prefix}.name is required`);
  if (value.category !== "asset" && value.category !== "material" && value.category !== "texture") {
    errors.push(`${prefix}.category must be asset, material, or texture`);
  }
  if (!isSafeLocation(value.uri)) errors.push(`${prefix}.uri must be a safe URL or relative path`);

  if (!isRecord(value.dimensions)) {
    errors.push(`${prefix}.dimensions is required`);
  } else {
    for (const dimension of ["width", "height", "depth"] as const) {
      const number = value.dimensions[dimension];
      if (typeof number !== "number" || !Number.isFinite(number) || number <= 0) {
        errors.push(`${prefix}.dimensions.${dimension} must be a positive finite number`);
      }
    }
  }

  validateStringArray(value.formats, `${prefix}.formats`, errors);
  validateStringArray(value.tags, `${prefix}.tags`, errors);
  if (!Array.isArray(value.previews)) errors.push(`${prefix}.previews must be an array`);
  else value.previews.forEach((preview, previewIndex) => {
    if (!isSafeLocation(preview)) errors.push(`${prefix}.previews[${previewIndex}] must be a safe URL or relative path`);
  });

  if (!isRecord(value.rights)) {
    errors.push(`${prefix}.rights is required`);
  } else {
    for (const field of ["provenance", "source", "license", "permission"] as const) {
      if (!isNonEmptyString(value.rights[field])) errors.push(`${prefix}.rights.${field} is required`);
    }
  }
}

export function validateCatalogManifest(value: unknown): CatalogValidationResult {
  const errors: string[] = [];
  if (!isRecord(value)) return { valid: false, errors: ["manifest must be an object"] };
  if (value.version !== CATALOG_MANIFEST_VERSION) errors.push(`version must be ${CATALOG_MANIFEST_VERSION}`);
  if (!Array.isArray(value.assets)) {
    errors.push("assets must be an array");
  } else {
    const ids = new Set<string>();
    value.assets.forEach((asset, index) => validateAsset(asset, index, ids, errors));
  }
  return { valid: errors.length === 0, errors };
}

/** Parse and validate untrusted JSON without throwing or returning unvalidated data. */
export function loadCatalogManifest(text: string): CatalogManifest | null {
  if (typeof text !== "string") return null;
  try {
    const value: unknown = JSON.parse(text);
    const result = validateCatalogManifest(value);
    return result.valid ? (value as CatalogManifest) : null;
  } catch {
    return null;
  }
}
