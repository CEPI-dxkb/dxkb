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
