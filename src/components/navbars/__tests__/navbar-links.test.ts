import { virusFamilies } from "@/components/organisms/virus-families/virus-families-data";
import { taxonomyHref } from "@/lib/views/hrefs";

import {
  browseOrganismItems,
  featuredVirusItems,
  organismItems,
} from "../navbar-links";

const familyCards = virusFamilies.flatMap((column) =>
  column.group === null
    ? column.subGroups.flatMap((subGroup) => subGroup.families)
    : column.families,
);

const cepiTaxaNames = [
  "Bunyaviricetes",
  "Coronaviridae",
  "Filoviridae",
  "Orthomyxoviridae",
  "Paramyxoviridae",
  "Pneumoviridae",
];

describe("organism menu items", () => {
  it("lists the major CEPI taxa, then All Viruses, All Bacteria and Browse all", () => {
    expect(organismItems.map((item) => item.title)).toEqual([
      ...cepiTaxaNames,
      "All Viruses",
      "All Bacteria",
      "Browse all",
    ]);
  });

  it("groups them as the featured taxa and the browse links, in the same order", () => {
    expect(featuredVirusItems.map((item) => item.title)).toEqual(cepiTaxaNames);
    expect(browseOrganismItems.map((item) => item.title)).toEqual([
      "All Viruses",
      "All Bacteria",
      "Browse all",
    ]);
    expect(organismItems).toEqual([
      ...featuredVirusItems,
      ...browseOrganismItems,
    ]);
  });

  it("links each CEPI taxon to its taxon page, matching the virus family cards", () => {
    for (const name of cepiTaxaNames) {
      const card = familyCards.find((family) => family.name === name);
      const item = featuredVirusItems.find((entry) => entry.title === name);

      expect(card, `${name} card`).toBeDefined();
      expect(item?.href, name).toBe(taxonomyHref(card?.taxonId ?? 0));
    }
  });

  it("links the browse items to the organism landing pages", () => {
    const hrefs = Object.fromEntries(
      browseOrganismItems.map((item) => [item.title, item.href]),
    );

    expect(hrefs).toEqual({
      "All Viruses": "/organisms/viruses",
      "All Bacteria": "/organisms/bacteria",
      "Browse all": "/organisms/all",
    });
  });

  it("gives every entry a unique href", () => {
    const hrefs = organismItems.map((item) => item.href);

    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("does not feature bacteria among the virus taxa", () => {
    expect(featuredVirusItems.map((item) => item.title)).not.toContain(
      "Bacteria",
    );
    expect(featuredVirusItems.map((item) => item.href)).not.toContain(
      taxonomyHref(2),
    );
  });
});
