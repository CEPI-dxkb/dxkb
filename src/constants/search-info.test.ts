import {
  searchDescriptors,
  searchHref,
  searchTypeForLocation,
} from "./search-info";

describe("search descriptors", () => {
  it("resolves every canonical search destination back to its search type", () => {
    for (const descriptor of searchDescriptors) {
      if (descriptor.route.status !== "canonical") continue;
      const href = new URL(searchHref(descriptor, "sync test"), "https://example.test");
      expect(
        searchTypeForLocation(href.pathname, href.searchParams),
        descriptor.id,
      ).toBe(descriptor.id);
    }
  });

  it("routes Feature and Protein searches to canonical Feature state", () => {
    const feature = searchDescriptors.find(
      (item) => item.id === "genome_feature",
    );
    const protein = searchDescriptors.find((item) => item.id === "protein");
    expect(feature && searchHref(feature, "DNA kinase")).toBe(
      "/feature?keyword=DNA%20kinase",
    );
    expect(protein && searchHref(protein, "DNA kinase")).toBe(
      "/feature?keyword=DNA%20kinase&filter=protein",
    );
  });

  it("routes Epitope searches to the canonical collection", () => {
    const epitope = searchDescriptors.find((item) => item.id === "epitope");
    expect(epitope && searchHref(epitope, "linear peptide")).toBe(
      "/epitope?keyword=linear%20peptide",
    );
  });

  it("routes Experiment searches to the canonical collection", () => {
    const experiment = searchDescriptors.find((item) => item.id === "experiment");
    expect(experiment && searchHref(experiment, "RNA sequencing")).toBe(
      "/experiment?keyword=RNA%20sequencing",
    );
  });

  it("routes Domains and Motifs searches to the canonical collection", () => {
    const domains = searchDescriptors.find(
      (item) => item.id === "protein_feature",
    );
    expect(domains && searchHref(domains, "DNA kinase")).toBe(
      "/domains-and-motifs?keyword=DNA%20kinase",
    );
  });

  it("routes Protein Structure searches to the canonical collection", () => {
    const structures = searchDescriptors.find(
      (item) => item.id === "protein_structure",
    );
    expect(structures && searchHref(structures, "spike protein")).toBe(
      "/protein-structure?keyword=spike%20protein",
    );
  });

  it("routes Strain, Surveillance, and Serology searches to canonical collections", () => {
    const strain = searchDescriptors.find((item) => item.id === "strain");
    const surveillance = searchDescriptors.find(
      (item) => item.id === "surveillance",
    );
    const serology = searchDescriptors.find((item) => item.id === "serology");
    expect(strain && searchHref(strain, "A/B strain")).toBe(
      "/strain?keyword=A%2FB%20strain",
    );
    expect(surveillance && searchHref(surveillance, "RAT/antigen")).toBe(
      "/surveillance?keyword=RAT%2Fantigen",
    );
    expect(serology && searchHref(serology, "neutralizing antibody")).toBe(
      "/serology?keyword=neutralizing%20antibody",
    );
  });
});
