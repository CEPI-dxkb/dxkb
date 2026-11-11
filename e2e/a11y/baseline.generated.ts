import type { BaselineMap, ReflowSkipMap } from "./baseline";

// Updated by `pnpm a11y:baseline:update`; the "*" route applies to routes
// with no more specific entry.
const generatedBaseline: BaselineMap = {
  "*": {
    "dxkb-light": {
      // WebKit-only: axe flags Base UI's internal focus-guard spans, which
      // are not author-controlled.
      "aria-command-name": { maxNodes: 99, ticket: "DXKBCORE-133" },
      "color-contrast": { maxNodes: 15, ticket: "DXKBCORE-174" },
      "svg-img-alt": { maxNodes: 50, ticket: "DXKBCORE-175" },
      "aria-toggle-field-name": { maxNodes: 10, ticket: "DXKBCORE-176" },
    },
    "dxkb-dark": {
      "aria-command-name": { maxNodes: 99, ticket: "DXKBCORE-133" },
      "color-contrast": { maxNodes: 30, ticket: "DXKBCORE-174" },
      "svg-img-alt": { maxNodes: 50, ticket: "DXKBCORE-175" },
      "aria-toggle-field-name": { maxNodes: 10, ticket: "DXKBCORE-176" },
    },
  },
  "organisms-viruses": {
    "dxkb-dark": {
      "color-contrast": { maxNodes: 110, ticket: "DXKBCORE-174" },
    },
  },
};

export const reflowSkip: ReflowSkipMap = {
  home: { ticket: "DXKBCORE-178" },
  "sign-in": { ticket: "DXKBCORE-178" },
  "sign-up": { ticket: "DXKBCORE-178" },
  "forgot-password": { ticket: "DXKBCORE-178" },
  about: { ticket: "DXKBCORE-178" },
  citations: { ticket: "DXKBCORE-178" },
  contact: { ticket: "DXKBCORE-178" },
  faq: { ticket: "DXKBCORE-178" },
  funding: { ticket: "DXKBCORE-178" },
  help: { ticket: "DXKBCORE-178" },
  news: { ticket: "DXKBCORE-178" },
  publications: { ticket: "DXKBCORE-178" },
  "privacy-policy": { ticket: "DXKBCORE-178" },
  "related-resources": { ticket: "DXKBCORE-178" },
  team: { ticket: "DXKBCORE-178" },
  updates: { ticket: "DXKBCORE-178" },
  "search/default": { ticket: "DXKBCORE-178" },
  "search/unsupported-type": { ticket: "DXKBCORE-178" },
  "taxonomy/brucella": { ticket: "DXKBCORE-178" },
  "organisms-all": { ticket: "DXKBCORE-178" },
  "organisms-bacteria": { ticket: "DXKBCORE-178" },
  "organisms-viruses": { ticket: "DXKBCORE-178" },
  "taxonomy-list": { ticket: "DXKBCORE-178" },
  "genome-list": { ticket: "DXKBCORE-178" },
  "feature-list": { ticket: "DXKBCORE-178" },
  "epitope-list": { ticket: "DXKBCORE-178" },
  "surveillance-list": { ticket: "DXKBCORE-178" },
  "serology-list": { ticket: "DXKBCORE-178" },
  genome: { ticket: "DXKBCORE-178" },
  feature: { ticket: "DXKBCORE-178" },
  epitope: { ticket: "DXKBCORE-178" },
  surveillance: { ticket: "DXKBCORE-178" },
  serology: { ticket: "DXKBCORE-178" },
  "strain-list": { ticket: "DXKBCORE-178" },
  "domains-and-motifs": { ticket: "DXKBCORE-178" },
  "protein-structure": { ticket: "DXKBCORE-178" },
  "advanced-search": { ticket: "DXKBCORE-178" },
};

export default generatedBaseline;
