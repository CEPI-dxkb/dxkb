import { parseRql } from "@/lib/data-api";
import { legacySearchFromParams, mapLegacyViewPath } from "../legacy-redirect";

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
        search: "rql=eq(taxon_id,1763)",
      },
    );
  });
  it("maps TaxonList to the taxonomy segment", () => {
    expect(
      mapLegacyViewPath("/view/TaxonList/", "eq(taxon_lineage_ids,1763)"),
    ).toEqual({
      pathname: "/taxonomy",
      search: "rql=eq(lineage_ids,1763)",
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
        "rql=and(in(lineage_ids,(1763,562)),eq(description,%2522taxon_lineage_ids%2522))",
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
      search: "rql=eq(taxon_name,taxon_lineage_ids)",
    });
    expect(
      mapLegacyViewPath(
        "/view/TaxonList/",
        "in(taxon_name,(taxon_lineage_ids,foo))",
      ),
    ).toEqual({
      pathname: "/taxonomy",
      search: "rql=in(taxon_name,(taxon_lineage_ids,foo))",
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
        "rql=and(or(eq(lineage_ids,1763),ne(lineage_ids,562)),sort(%2Blineage_ids))",
    });
  });
  it("leaves the lineage field alone outside the taxonomy segment", () => {
    expect(
      mapLegacyViewPath("/view/GenomeList/", "eq(taxon_lineage_ids,1763)"),
    ).toEqual({
      pathname: "/genome",
      search: "rql=eq(taxon_lineage_ids,1763)",
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
      search: "test_type=ELISA/IgG+test",
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
      search: "rql=eq(taxon_id,11520)",
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
      search: "rql=eq(genome_id,83332.12)",
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
      search: "rql=eq(genome_id,83332.12)&filter=%22CDS%22",
    });
  });
});

describe("legacySearchFromParams", () => {
  // Each input is the form-encoded query Next.js hands the proxy after parsing
  // and re-serializing the raw legacy URL (see the helper's doc comment).
  it.each([
    ["an RQL fragment", "eq%28genome_status%2CComplete%29=", "eq(genome_status,Complete)"],
    ["an unnormalized RQL fragment", "eq(taxon_id,1763)", "eq(taxon_id,1763)"],
    [
      "RQL beside named params",
      "eq%28taxon_id%2C1763%29=&keyword=a+b&filter=%22CDS%22",
      "eq(taxon_id,1763)&keyword=a+b&filter=%22CDS%22",
    ],
    ["RQL containing =", "eq%28a%2Cb=c%29", "eq(a,b=c)"],
    [
      "a literal % and & in an RQL value",
      "eq%28name%2C100%25%26more%29=",
      "eq(name,100%25%26more)",
    ],
    ["separate RQL fragments", "eq%28a%2C1%29=&eq%28b%2C2%29=", "eq(a,1)&eq(b,2)"],
    [
      "an encoded comma in a comparison value",
      "eq%28genome_name%2Cfoo%2Cbar%29=",
      "eq(genome_name,foo%2Cbar)",
    ],
    [
      "an encoded comma in a nested comparison value",
      "and%28eq%28a%2C1%29%2Cne%28b%2Cx%2Cy%2Cz%29%29=",
      "and(eq(a,1),ne(b,x%2Cy%2Cz))",
    ],
    ["an encoded comma in a keyword", "keyword%28a%2Cb%29=", "keyword(a%2Cb)"],
    [
      "a quoted comma",
      "eq%28genome_name%2C%22foo%2Cbar%22%29=",
      'eq(genome_name,"foo,bar")',
    ],
    ["in-list commas", "in%28genome_id%2C%28a%2Cb%29%29=", "in(genome_id,(a,b))"],
    ["no query", "", ""],
  ])("rebuilds %s", (_name, normalized, raw) => {
    expect(legacySearchFromParams(new URLSearchParams(normalized))).toBe(raw);
  });

  it("keeps an encoded comma inside the destination's comparison value", () => {
    // Next hands the proxy ?eq(genome_name,foo%2Cbar) as this normalized form.
    const normalized = new URLSearchParams("eq%28genome_name%2Cfoo%2Cbar%29=");
    const mapped = mapLegacyViewPath(
      "/view/GenomeList/",
      legacySearchFromParams(normalized),
    );
    const rql = new URLSearchParams(mapped?.search).get("rql") ?? "";
    expect(parseRql("genome", rql)).toEqual({
      operator: "eq",
      field: "genome_name",
      value: "foo,bar",
    });
  });

  it("gives the mapper the same RQL as the raw query string", () => {
    const normalized = new URLSearchParams(
      "eq%28taxon_lineage_ids%2C1763%29=&keyword=kinase",
    );
    expect(
      mapLegacyViewPath("/view/TaxonList/", legacySearchFromParams(normalized)),
    ).toEqual(
      mapLegacyViewPath("/view/TaxonList/", "eq(taxon_lineage_ids,1763)&keyword=kinase"),
    );
  });
});
