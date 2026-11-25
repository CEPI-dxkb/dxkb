import { virusFamilies } from "@/components/organisms/virus-families/virus-families-data";
import { searchTypes } from "@/constants/search-info";
import { taxonomyHref } from "@/lib/views/hrefs";

import {
  browseOrganismItems,
  dataTypeItems,
  featuredVirusItems,
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
  it("features the major CEPI taxa", () => {
    expect(featuredVirusItems.map((item) => item.title)).toEqual(cepiTaxaNames);
  });

  it("lists All Viruses, All Bacteria and Browse all as the browse links", () => {
    expect(browseOrganismItems.map((item) => item.title)).toEqual([
      "All Viruses",
      "All Bacteria",
      "Browse all",
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
    const hrefs = [...featuredVirusItems, ...browseOrganismItems].map(
      (item) => item.href,
    );

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

describe("data type menu items", () => {
  it("lists the ten list routes in the header search selector's order", () => {
    const fromSelector = searchTypes
      .filter((type) => type.id !== "everything")
      .map((type) => ({
        id: type.id,
        title: type.typeTitle,
        href: type.route.status === "canonical" ? `/${type.route.segment}` : "",
      }));

    expect(fromSelector).toHaveLength(10);
    expect(dataTypeItems).toEqual(fromSelector);
  });

  it("links the bare list routes, not search or advanced-search forms", () => {
    expect(dataTypeItems.map((item) => item.href)).toEqual([
      "/genome",
      "/strain",
      "/feature",
      "/domains-and-motifs",
      "/epitope",
      "/protein-structure",
      "/surveillance",
      "/serology",
      "/taxonomy",
      "/experiment",
    ]);
  });

  it("gives every entry a unique id, title and href", () => {
    for (const key of ["id", "title", "href"] as const) {
      const values = dataTypeItems.map((item) => item[key]);

      expect(new Set(values).size, key).toBe(values.length);
    }
  });
});
