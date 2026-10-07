import { render } from "@testing-library/react";

const mockReplace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

beforeEach(() => {
  mockReplace.mockClear();
  window.history.replaceState(null, "", "/");
});

import { LegacyHashAdapter } from "../legacy-hash-adapter";

it("rewrites #view_tab= to ?tab= via router.replace", () => {
  window.location.hash = "#view_tab=features";
  render(<LegacyHashAdapter />);
  expect(mockReplace).toHaveBeenCalled();
  const url = String(mockReplace.mock.calls[0][0]);
  expect(url).toContain("tab=features");
  expect(url).not.toContain("view_tab");
});

it("promotes the Epitope assays tab", () => {
  window.history.replaceState(null, "", "/epitope/15780");
  window.location.hash = "#view_tab=assays";
  render(<LegacyHashAdapter />);
  expect(mockReplace).toHaveBeenCalledWith("/epitope/15780?tab=assays");
});

it("does nothing when there is no legacy hash", () => {
  window.location.hash = "";
  render(<LegacyHashAdapter />);
  expect(mockReplace).not.toHaveBeenCalled();
});

it("promotes a non-false filter to ?filter=", () => {
  window.location.hash = "#view_tab=overview&filter=true";
  render(<LegacyHashAdapter />);
  expect(mockReplace).toHaveBeenCalled();
  const url = String(mockReplace.mock.calls[0][0]);
  expect(url).toContain("tab=overview");
  expect(url).toContain("filter=true");
  expect(url).not.toContain("view_tab");
});

it("does not promote filter=false (legacy default-off sentinel)", () => {
  window.location.hash = "#view_tab=overview&filter=false";
  render(<LegacyHashAdapter />);
  expect(mockReplace).toHaveBeenCalled();
  const url = String(mockReplace.mock.calls[0][0]);
  expect(url).toContain("tab=overview");
  expect(url).not.toContain("filter");
});

it("maps a FeatureList's removed default (filter=false) to annotation=*", () => {
  // Legacy writes #filter=false once its annotation=PATRIC default is removed;
  // the server redirect keeps the hash (/view/FeatureList/ -> /feature).
  window.history.replaceState(null, "", "/feature");
  window.location.hash = "#view_tab=features&filter=false";
  render(<LegacyHashAdapter />);

  expect(mockReplace).toHaveBeenCalledWith(
    "/feature?tab=features&annotation=*",
  );
});

it("keeps an annotation the Feature list URL already names", () => {
  window.history.replaceState(null, "", "/feature?annotation=RefSeq");
  window.location.hash = "#filter=false";
  render(<LegacyHashAdapter />);

  expect(mockReplace).toHaveBeenCalledWith("/feature?annotation=RefSeq");
});

it("maps a removed default beside explicit RQL, which keeps the default", () => {
  // /view/FeatureList/?eq(genome_id,83332.12)#filter=false: all 10,940 of the
  // genome's features, not its 5,425 PATRIC ones.
  window.history.replaceState(null, "", "/feature?rql=eq(genome_id,83332.12)");
  window.location.hash = "#filter=false";
  render(<LegacyHashAdapter />);

  expect(mockReplace).toHaveBeenCalledWith(
    "/feature?rql=eq(genome_id,83332.12)&annotation=*",
  );
});

it("adds no annotation marker beside RQL that picks an annotation", () => {
  window.history.replaceState(
    null,
    "",
    "/feature?rql=and(eq(genome_id,83332.12),eq(annotation,RefSeq))",
  );
  window.location.hash = "#filter=false";
  render(<LegacyHashAdapter />);

  expect(mockReplace).toHaveBeenCalledWith(
    "/feature?rql=and(eq(genome_id,83332.12),eq(annotation,RefSeq))",
  );
});

it("adds no annotation marker to a Proteins search, which has no default", () => {
  // /view/ProteinList/?keyword(Dnak)#view_tab=proteins&filter=false: legacy's
  // removal sends the same query, and DXKB's Proteins search has no default.
  window.history.replaceState(null, "", "/feature?keyword=Dnak&filter=protein");
  window.location.hash = "#view_tab=proteins&filter=false";
  render(<LegacyHashAdapter />);

  expect(mockReplace).toHaveBeenCalledWith(
    "/feature?keyword=Dnak&filter=protein&tab=proteins",
  );
});

it("adds no annotation marker to a quoted Proteins filter", () => {
  // The server reads filter="protein" as filter=protein.
  window.history.replaceState(null, "", "/feature?keyword=Dnak&filter=%22protein%22");
  window.location.hash = "#filter=false";
  render(<LegacyHashAdapter />);

  expect(mockReplace).toHaveBeenCalledWith(
    "/feature?keyword=Dnak&filter=%22protein%22",
  );
});

it("maps a Genome page Features tab's removed default to features.annotation=*", () => {
  // /view/Genome/83332.12#view_tab=features&filter=false lists all 10,940 of
  // the genome's features.
  window.history.replaceState(null, "", "/genome/83332.12");
  window.location.hash = "#view_tab=features&filter=false";
  render(<LegacyHashAdapter />);

  expect(mockReplace).toHaveBeenCalledWith(
    "/genome/83332.12?tab=features&features.annotation=*",
  );
});

it("maps a Taxonomy page Features tab's removed default to annotation=*", () => {
  window.history.replaceState(null, "", "/taxonomy/1763");
  window.location.hash = "#view_tab=features&filter=false";
  render(<LegacyHashAdapter />);

  expect(mockReplace).toHaveBeenCalledWith(
    "/taxonomy/1763?tab=features&annotation=*",
  );
});

it("adds no marker for another Genome or Taxonomy page tab", () => {
  window.history.replaceState(null, "", "/taxonomy/1763");
  window.location.hash = "#view_tab=genomes&filter=false";
  render(<LegacyHashAdapter />);

  expect(mockReplace).toHaveBeenCalledWith("/taxonomy/1763?tab=genomes");
});

it("maps a GenomeList Features tab's removed default to features.annotation=*", () => {
  // Legacy GenomeList's Features tab with #filter=false sends keyword(Dnak)
  // alone: 3,005,987 rows, against 2,122,831 with its PATRIC default.
  window.history.replaceState(null, "", "/genome?keyword=Dnak");
  window.location.hash = "#view_tab=features&filter=false";
  render(<LegacyHashAdapter />);

  expect(mockReplace).toHaveBeenCalledWith(
    "/genome?keyword=Dnak&tab=features&features.annotation=*",
  );
});

it("adds no marker for another GenomeList tab, which has no default", () => {
  window.history.replaceState(null, "", "/genome?keyword=Dnak");
  window.location.hash = "#view_tab=sequences&filter=false";
  render(<LegacyHashAdapter />);

  expect(mockReplace).toHaveBeenCalledWith("/genome?keyword=Dnak&tab=sequences");
});

it("keeps an annotation the Genome list's Features tab already names", () => {
  window.history.replaceState(
    null,
    "",
    "/genome?keyword=Dnak&features.annotation=RefSeq",
  );
  window.location.hash = "#view_tab=features&filter=false";
  render(<LegacyHashAdapter />);

  expect(mockReplace).toHaveBeenCalledWith(
    "/genome?keyword=Dnak&features.annotation=RefSeq&tab=features",
  );
});

it("promotes #accession= to ?accession= for ProteinStructure links", () => {
  window.location.hash = "#accession=6VXX&view_tab=overview";
  render(<LegacyHashAdapter />);
  expect(mockReplace).toHaveBeenCalled();
  const url = String(mockReplace.mock.calls[0][0]);
  expect(url).toContain("accession=6VXX");
  expect(url).toContain("tab=overview");
  expect(url).not.toContain("#");
});

it("promotes #path= to ?path= for workspace ProteinStructure links", () => {
  window.location.hash = "#path=%2Fuser%40patricbrc.org%2Fhome%2Fmy.pdb";
  render(<LegacyHashAdapter />);
  expect(mockReplace).toHaveBeenCalled();
  const url = String(mockReplace.mock.calls[0][0]);
  expect(url).toContain("path=");
  expect(url).not.toContain("#");
});

it("converts defaultSort=-score when a canonical keyword is present", () => {
  window.history.replaceState(null, "", "/genome?keyword=influenza");
  window.location.hash = "#defaultSort=-score";
  render(<LegacyHashAdapter />);

  expect(mockReplace).toHaveBeenCalledWith(
    "/genome?keyword=influenza&sort=score:desc",
  );
});

it("promotes a hash keyword before converting defaultSort=-score", () => {
  window.location.hash = "#keyword=E.%20coli&defaultSort=-score";
  render(<LegacyHashAdapter />);

  expect(mockReplace).toHaveBeenCalledWith(
    "/?keyword=E.+coli&sort=score:desc",
  );
});

it("preserves an explicit sort when converting defaultSort=-score", () => {
  window.history.replaceState(
    null,
    "",
    "/genome?keyword=influenza&sort=genome_name%3Aasc",
  );
  window.location.hash = "#defaultSort=-score";
  render(<LegacyHashAdapter />);

  expect(mockReplace).toHaveBeenCalledWith(
    "/genome?keyword=influenza&sort=genome_name:asc",
  );
});

it("drops defaultSort=-score when no keyword is present", () => {
  window.location.hash = "#defaultSort=-score";
  render(<LegacyHashAdapter />);

  expect(mockReplace).toHaveBeenCalledWith("/");
});

it("does nothing when hash has only unrelated keys", () => {
  window.location.hash = "#someOtherKey=value";
  render(<LegacyHashAdapter />);
  expect(mockReplace).not.toHaveBeenCalled();
});
