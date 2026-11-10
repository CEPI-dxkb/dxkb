import type { TabContext } from "./tab-context";

const CELLULAR_ORGANISMS_TAXON_ID = 131567;
const VIRUSES_TAXON_ID = 10239;

function scopeIncludes(tabContext: TabContext, taxonId: number): boolean {
  return tabContext.taxonomy.scopeRootIds.includes(taxonId);
}

export const isBacteria = (c: TabContext): boolean =>
  c.taxonomy.scopeLineageNames.includes("Bacteria") ||
  scopeIncludes(c, CELLULAR_ORGANISMS_TAXON_ID);

// Building blocks for future per-kingdom tab gates; not yet wired into gatesByKey.
export const isFungi = (c: TabContext): boolean =>
  c.taxonomy.lineageNames.includes("Fungi");

export const isArchaea = (c: TabContext): boolean =>
  c.taxonomy.lineageNames.includes("Archaea");

/** Segmented-genome viruses get a Strains tab; bunyaviruses key on the class Bunyaviricetes, not the order Bunyavirales (predicates.test.ts pins this). */
export const hasStrains = (c: TabContext): boolean =>
  c.taxonomy.scopeLineageNames.includes("Orthomyxoviridae") ||
  c.taxonomy.scopeLineageNames.includes("Bunyaviricetes") ||
  scopeIncludes(c, VIRUSES_TAXON_ID);

export const hasSfvt = (c: TabContext): boolean =>
  c.taxonomy.scopeLineageIds.some((id) => c.curatedLists.sfvtTaxonIds.has(id)) ||
  (scopeIncludes(c, VIRUSES_TAXON_ID) && c.curatedLists.sfvtTaxonIds.size > 0);

export const hasSurveillance = (c: TabContext): boolean =>
  c.taxonomy.scopeLineageNames.some((n) => c.curatedLists.surveillanceLineageNames.has(n)) ||
  (scopeIncludes(c, VIRUSES_TAXON_ID) && c.curatedLists.surveillanceLineageNames.size > 0);

export const hasSerology = (c: TabContext): boolean =>
  c.taxonomy.scopeLineageNames.some((n) => c.curatedLists.serologyLineageNames.has(n)) ||
  (scopeIncludes(c, VIRUSES_TAXON_ID) && c.curatedLists.serologyLineageNames.size > 0);

/** Exact taxon_id match against the published-tree manifest. Does NOT inherit. */
export const hasViralTree = (c: TabContext): boolean =>
  c.phyloManifest != null &&
  Object.prototype.hasOwnProperty.call(c.phyloManifest.trees, String(c.taxonomy.taxonId));

/** Keys on the taxon's own lineage, not isBacteria, whose cellular-root shortcut matches cellular organisms (131567), which has no bacterial tree. */
export const hasBacterialTree = (c: TabContext): boolean =>
  c.taxonomy.lineageNames.includes("Bacteria");

export const hasBacterialOrViralPhylogeny = (c: TabContext): boolean =>
  hasBacterialTree(c) || hasViralTree(c);
