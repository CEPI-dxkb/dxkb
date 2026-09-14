import { mapLegacyViewPath } from "../legacy-redirect";

describe("mapLegacyViewPath", () => {
  it("maps a singular legacy path", () => {
    expect(mapLegacyViewPath("/view/Genome/59201.7581", "")).toEqual({
      pathname: "/genome/59201.7581",
      search: "",
    });
  });
  it("maps a list legacy path with raw RQL into ?rql=", () => {
    expect(mapLegacyViewPath("/view/GenomeList/", "eq(taxon_id,1763)")).toEqual(
      {
        pathname: "/genome",
        search: "rql=eq(taxon_id%2C1763)",
      },
    );
  });
  it("maps TaxonList to the taxonomy segment", () => {
    expect(
      mapLegacyViewPath("/view/TaxonList/", "eq(taxon_lineage_ids,1763)"),
    ).toEqual({
      pathname: "/taxonomy",
      search: "rql=eq(lineage_ids%2C1763)",
    });
  });
  it("renames the TaxonList lineage field in field position only", () => {
    expect(
      mapLegacyViewPath(
        "/view/TaxonList/",
        "and(in(taxon_lineage_ids,(1763,562)),eq(description,%22taxon_lineage_ids%22))",
      ),
    ).toEqual({
      pathname: "/taxonomy",
      search:
        "rql=and(in(lineage_ids%2C(1763%2C562))%2Ceq(description%2C%2522taxon_lineage_ids%2522))",
    });
  });
  it("leaves the lineage field alone in value position", () => {
    // A bare token is a value here, not a field, so renaming it would change the query.
    expect(
      mapLegacyViewPath("/view/TaxonList/", "keyword(taxon_lineage_ids)"),
    ).toEqual({
      pathname: "/taxonomy",
      search: "rql=keyword(taxon_lineage_ids)",
    });
    expect(
      mapLegacyViewPath("/view/TaxonList/", "eq(taxon_name,taxon_lineage_ids)"),
    ).toEqual({
      pathname: "/taxonomy",
      search: "rql=eq(taxon_name%2Ctaxon_lineage_ids)",
    });
    expect(
      mapLegacyViewPath(
        "/view/TaxonList/",
        "in(taxon_name,(taxon_lineage_ids,foo))",
      ),
    ).toEqual({
      pathname: "/taxonomy",
      search: "rql=in(taxon_name%2C(taxon_lineage_ids%2Cfoo))",
    });
  });
  it("renames the lineage field nested inside logical expressions", () => {
    expect(
      mapLegacyViewPath(
        "/view/TaxonList/",
        "and(or(eq(taxon_lineage_ids,1763),ne(taxon_lineage_ids,562)),sort(+taxon_lineage_ids))",
      ),
    ).toEqual({
      pathname: "/taxonomy",
      search:
        "rql=and(or(eq(lineage_ids%2C1763)%2Cne(lineage_ids%2C562))%2Csort(%2Blineage_ids))",
    });
  });
  it("leaves the lineage field alone outside the taxonomy segment", () => {
    expect(
      mapLegacyViewPath("/view/GenomeList/", "eq(taxon_lineage_ids,1763)"),
    ).toEqual({
      pathname: "/genome",
      search: "rql=eq(taxon_lineage_ids%2C1763)",
    });
  });
  it("preserves a named query param (surveillance)", () => {
    expect(
      mapLegacyViewPath(
        "/view/Surveillance/ISDN123456",
        "pathogen_test_type=Influenza%20A",
      ),
    ).toEqual({
      pathname: "/surveillance/ISDN123456",
      search: "pathogen_test_type=Influenza+A",
    });
  });
  it("preserves a named query param for a Serology member", () => {
    expect(
      mapLegacyViewPath(
        "/view/Serology/000123",
        "test_type=ELISA%2FIgG%20test",
      ),
    ).toEqual({
      pathname: "/serology/000123",
      search: "test_type=ELISA%2FIgG+test",
    });
  });

  it("maps the list-only Strain route", () => {
    expect(mapLegacyViewPath("/view/StrainList/", "strain=H1N1")).toEqual({
      pathname: "/strain",
      search: "strain=H1N1",
    });
  });

  it("maps Epitope member and list routes", () => {
    expect(mapLegacyViewPath("/view/Epitope/15780", "")).toEqual({
      pathname: "/epitope/15780",
      search: "",
    });
    expect(
      mapLegacyViewPath("/view/EpitopeList/", "eq(taxon_id,11520)"),
    ).toEqual({
      pathname: "/epitope",
      search: "rql=eq(taxon_id%2C11520)",
    });
  });

  it("maps both Domains and Motifs list aliases", () => {
    expect(
      mapLegacyViewPath(
        "/view/DomainsAndMotifsList/",
        "eq(genome_id,83332.12)",
      ),
    ).toEqual({
      pathname: "/domains-and-motifs",
      search: "rql=eq(genome_id%2C83332.12)",
    });
    expect(
      mapLegacyViewPath(
        "/view/ProteinFeaturesList/",
        "feature_id=fig%7C83332.12.peg.1",
      ),
    ).toEqual({
      pathname: "/domains-and-motifs",
      search: "feature_id=fig%7C83332.12.peg.1",
    });
  });

  it("maps Protein aliases to Feature member and list routes", () => {
    expect(mapLegacyViewPath("/view/Protein/fig%7C83332.12.peg.1", "")).toEqual(
      {
        pathname: "/feature/fig%7C83332.12.peg.1",
        search: "",
      },
    );
    expect(mapLegacyViewPath("/view/ProteinList/", "keyword=kinase")).toEqual({
      pathname: "/feature",
      search: "keyword=kinase&filter=protein",
    });
  });

  it("returns null for an unknown legacy view name", () => {
    expect(mapLegacyViewPath("/view/Nonsense/1", "")).toBeNull();
  });
  it("returns null for a non-/view path", () => {
    expect(mapLegacyViewPath("/genome/123", "")).toBeNull();
  });
  it("maps a list legacy path with named params (not RQL) using URLSearchParams encoding", () => {
    expect(
      mapLegacyViewPath(
        "/view/GenomeList/",
        "keyword=mycobacterium tuberculosis",
      ),
    ).toEqual({
      pathname: "/genome",
      search: "keyword=mycobacterium+tuberculosis",
    });
  });
  it("splits mixed RQL + named param so filter= is not swallowed into rql=", () => {
    expect(
      mapLegacyViewPath(
        "/view/FeatureList/",
        'eq(genome_id,83332.12)&filter="CDS"',
      ),
    ).toEqual({
      pathname: "/feature",
      search: "rql=eq(genome_id%2C83332.12)&filter=%22CDS%22",
    });
  });
});
