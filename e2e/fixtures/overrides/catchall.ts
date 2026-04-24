import type { JsonOverride } from "../../mocks/backends";

/**
 * Permissive catch-all mocks for API namespaces that don't have specific fixtures.
 * These apply at the END of any override list (matched first by route LIFO) so more
 * specific overrides registered later override them. Use to keep strict mode happy
 * without explicitly mocking every endpoint a page touches.
 */
export const apiCatchallOverrides: JsonOverride[] = [
  { url: /\/api\/auth\//, method: "GET", body: {} },
  { url: /\/api\/auth\//, method: "POST", body: {} },
  { url: /\/api\/services\//, method: "GET", body: {} },
  { url: /\/api\/services\//, method: "POST", body: { result: [[]] } },
  { url: /\/api\/workspace\//, method: "GET", body: { items: [] } },
  { url: /\/api\/workspace\//, method: "POST", body: {} },
];

export const externalCatchallOverrides: JsonOverride[] = [
  { url: /patricbrc\.org/, body: {} },
  { url: /bv-brc\.org/, body: {} },
  { url: /theseed\.org/, body: { result: [[]] } },
  { url: /ncbi\.nlm\.nih\.gov/, body: {} },
];

/** Combined catch-all for the quick "I just want the page to render" case. */
export const permissiveBackendOverrides: JsonOverride[] = [
  ...apiCatchallOverrides,
  ...externalCatchallOverrides,
];
