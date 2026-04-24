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

// Anchor to scheme + host so these only match outbound requests whose HOST ends in one of the
// domains. Without the anchor, a URL like `http://127.0.0.1:3020/workspace/user@patricbrc.org/home`
// would match `/patricbrc\.org/` and hijack the page navigation itself.
export const externalCatchallOverrides: JsonOverride[] = [
  { url: /^https?:\/\/(?:[a-z0-9-]+\.)*patricbrc\.org(?:[:/]|$)/i, body: {} },
  { url: /^https?:\/\/(?:[a-z0-9-]+\.)*bv-brc\.org(?:[:/]|$)/i, body: {} },
  { url: /^https?:\/\/(?:[a-z0-9-]+\.)*theseed\.org(?:[:/]|$)/i, body: { result: [[]] } },
  { url: /^https?:\/\/(?:[a-z0-9-]+\.)*ncbi\.nlm\.nih\.gov(?:[:/]|$)/i, body: {} },
];

/** Combined catch-all for the quick "I just want the page to render" case. */
export const permissiveBackendOverrides: JsonOverride[] = [
  ...apiCatchallOverrides,
  ...externalCatchallOverrides,
];
