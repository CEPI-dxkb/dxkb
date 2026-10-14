import { featuredAllOrganisms } from "../featured-all-organisms-data";

describe("featuredAllOrganisms", () => {
  it("category titles are unique and every category has entries", () => {
    const titles = featuredAllOrganisms.map((c) => c.title);
    expect(new Set(titles).size).toBe(titles.length);
    for (const category of featuredAllOrganisms) {
      expect(category.organisms.length, category.title).toBeGreaterThan(0);
    }
  });

  it("lists Viruses beside the three domains", () => {
    expect(featuredAllOrganisms[0]).toEqual({
      title: "Domains and Viruses",
      organisms: [
        { name: "Bacteria", href: "/taxonomy/2" },
        { name: "Archaea", href: "/taxonomy/2157" },
        { name: "Eukaryota", href: "/taxonomy/2759" },
        { name: "Viruses", href: "/taxonomy/10239" },
      ],
    });
  });

  it("features virus families of infectious disease relevance", () => {
    const viruses = featuredAllOrganisms.find((c) => c.title === "Viruses");
    expect(viruses?.organisms).toEqual([
      { name: "Coronaviridae", href: "/taxonomy/11118" },
      { name: "Orthomyxoviridae", href: "/taxonomy/11308" },
      { name: "Flaviviridae", href: "/taxonomy/11050" },
      { name: "Filoviridae", href: "/taxonomy/11266" },
    ]);
  });
});
