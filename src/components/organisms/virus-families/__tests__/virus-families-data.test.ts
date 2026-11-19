import { taxonomyHref } from "@/lib/views/hrefs";

import { virusFamilies } from "../virus-families-data";

const cards = virusFamilies.flatMap((column) =>
  column.group === null
    ? column.subGroups.flatMap((subGroup) => subGroup.families)
    : column.families,
);

describe("virusFamilies pathogens", () => {
  it("covers all 20 landing cards", () => {
    expect(cards).toHaveLength(20);
  });

  it("gives every card a pathogens array", () => {
    for (const card of cards) {
      expect(Array.isArray(card.pathogens), card.name).toBe(true);
    }
  });

  it("uses a valid taxon id for every card and pathogen", () => {
    for (const card of cards) {
      expect(() => taxonomyHref(card.taxonId), card.name).not.toThrow();
      for (const pathogen of card.pathogens) {
        expect(() => taxonomyHref(pathogen.taxonId), pathogen.name).not.toThrow();
        expect(pathogen.name.trim(), card.name).not.toBe("");
      }
    }
  });

  it("keeps each list short enough for a popover and free of duplicates", () => {
    for (const card of cards) {
      expect(card.pathogens.length, card.name).toBeLessThanOrEqual(8);
      const ids = card.pathogens.map((pathogen) => pathogen.taxonId);
      expect(new Set(ids).size, card.name).toBe(ids.length);
    }
  });

  it("explains an empty list with a note, and only then", () => {
    for (const card of cards) {
      if (card.pathogens.length === 0) {
        expect(card.pathogenNote?.trim(), card.name).toBeTruthy();
      } else {
        expect(card.pathogenNote, card.name).toBeUndefined();
      }
    }
  });
});
