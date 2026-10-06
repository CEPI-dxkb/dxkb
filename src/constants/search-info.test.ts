import {
  allTermSearchTypes,
  searchDescriptors,
  searchHref,
  searchTypeForLocation,
  searchTypes,
} from "./search-info";

describe("search descriptors", () => {
  // Specialty Genes, Pathways, and Subsystems have no destination of their own
  // and are deliberately absent from the legacy type menu, but the
  // all-data-types result page still queries and labels them. Deleting the
  // descriptors would silently drop three cards from that page.
  it.each(["sp_gene", "pathway", "subsystem"])(
    "keeps the destination-less %s descriptor for the all-data-types page",
    (id) => {
      expect(allTermSearchTypes.map((descriptor) => descriptor.id)).toContain(
        id,
      );
      expect(searchTypes.map((descriptor) => descriptor.id)).not.toContain(id);
    },
  );

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

  it("routes Taxa searches to the canonical collection", () => {
    const taxonomy = searchDescriptors.find((item) => item.id === "taxonomy");
    expect(taxonomy && searchHref(taxonomy, "Influenza A")).toBe(
      "/taxonomy?keyword=Influenza+A",
    );
    expect(
      searchTypeForLocation(
        "/taxonomy",
        new URLSearchParams({ keyword: "Influenza A" }),
      ),
    ).toBe("taxonomy");
  });

  it("routes Feature and Protein searches to canonical Feature state", () => {
    const feature = searchDescriptors.find(
      (item) => item.id === "genome_feature",
    );
    const protein = searchDescriptors.find((item) => item.id === "protein");
    expect(feature && searchHref(feature, "DNA kinase")).toBe(
      "/feature?keyword=DNA+kinase",
    );
    expect(protein && searchHref(protein, "DNA kinase")).toBe(
      "/feature?keyword=DNA+kinase&filter=protein",
    );
  });

  it("writes a canonical search's keyword as legacy's search box reads it", () => {
    // A list reads ?keyword= as written; legacy's search box quotes an id-like
    // word (keyword("Rv0001"): 4 features, unquoted 341,272) and reads `or` as
    // Solr's OR. The /search page normalizes its own q.
    const feature = searchDescriptors.find((item) => item.id === "genome_feature");
    const everything = searchDescriptors.find((item) => item.id === "everything");
    expect(feature && searchHref(feature, "Rv0001")).toBe(
      "/feature?keyword=%22Rv0001%22",
    );
    expect(feature && searchHref(feature, "dnaK or dnaJ")).toBe(
      "/feature?keyword=dnaK+OR+dnaJ",
    );
    expect(everything && searchHref(everything, "Rv0001")).toBe(
      "/search?type=everything&q=Rv0001",
    );
  });

  it("routes Epitope searches to the canonical collection", () => {
    const epitope = searchDescriptors.find((item) => item.id === "epitope");
    expect(epitope && searchHref(epitope, "linear peptide")).toBe(
      "/epitope?keyword=linear+peptide",
    );
  });

  it("routes Experiment searches to the canonical collection", () => {
    const experiment = searchDescriptors.find((item) => item.id === "experiment");
    expect(experiment && searchHref(experiment, "RNA sequencing")).toBe(
      "/experiment?keyword=RNA+sequencing",
    );
  });

  it("routes Domains and Motifs searches to the canonical collection", () => {
    const domains = searchDescriptors.find(
      (item) => item.id === "protein_feature",
    );
    expect(domains && searchHref(domains, "DNA kinase")).toBe(
      "/domains-and-motifs?keyword=DNA+kinase",
    );
  });

  it("routes Protein Structure searches to the canonical collection", () => {
    const structures = searchDescriptors.find(
      (item) => item.id === "protein_structure",
    );
    expect(structures && searchHref(structures, "spike protein")).toBe(
      "/protein-structure?keyword=spike+protein",
    );
  });

  it("routes Strain, Surveillance, and Serology searches to canonical collections", () => {
    const strain = searchDescriptors.find((item) => item.id === "strain");
    const surveillance = searchDescriptors.find(
      (item) => item.id === "surveillance",
    );
    const serology = searchDescriptors.find((item) => item.id === "serology");
    // Legacy's search box reads `/` as a space.
    expect(strain && searchHref(strain, "A/B strain")).toBe(
      "/strain?keyword=A+B+strain",
    );
    expect(surveillance && searchHref(surveillance, "RAT/antigen")).toBe(
      "/surveillance?keyword=RAT+antigen",
    );
    expect(serology && searchHref(serology, "neutralizing antibody")).toBe(
      "/serology?keyword=neutralizing+antibody",
    );
  });
});
