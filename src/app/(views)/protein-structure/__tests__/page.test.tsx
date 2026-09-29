import { render, screen } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  getProteinStructures: vi.fn(),
  redirect: vi.fn((href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  }),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/protein-structure-view/server", () => ({
  getProteinStructures: mocks.getProteinStructures,
}));
vi.mock("../protein-structure-member", () => ({
  ProteinStructureMember: ({
    lookups,
    workspacePath,
  }: {
    lookups?: { accession: string }[];
    workspacePath?: string;
  }) => (
    <div data-testid="member">
      {workspacePath ?? lookups?.map((lookup) => lookup.accession).join(",")}
    </div>
  ),
}));
vi.mock("../protein-structure-collection", () => ({
  ProteinStructureCollection: () => <div data-testid="collection" />,
}));

import ProteinStructurePage from "../page";

describe("Protein Structure route", () => {
  beforeEach(() => {
    mocks.redirect.mockClear();
    mocks.getProteinStructures.mockReset();
    mocks.getProteinStructures.mockImplementation((accessions: string[]) =>
      Promise.resolve(
        accessions.map((accession) => ({ accession, metadata: null })),
      ),
    );
  });

  it("canonicalizes repeated, lowercase, and duplicate accessions while preserving query state", async () => {
    await expect(
      ProteinStructurePage({
        searchParams: Promise.resolve({
          accession: ["1abc", "1ABC,af-p12345-f1"],
          source: "search",
        }),
      }),
    ).rejects.toThrow(
      "NEXT_REDIRECT:/protein-structure?source=search&accession=1ABC,AF-P12345-F1",
    );
    expect(mocks.getProteinStructures).not.toHaveBeenCalled();
  });

  it("fetches metadata once for the canonical accession sequence", async () => {
    render(
      await ProteinStructurePage({
        searchParams: Promise.resolve({ accession: "1ABC,AF-P12345-F1" }),
      }),
    );
    expect(mocks.getProteinStructures).toHaveBeenCalledWith([
      "1ABC",
      "AF-P12345-F1",
    ]);
    expect(screen.getByTestId("member")).toHaveTextContent("1ABC,AF-P12345-F1");
  });

  it("rejects invalid workspace paths without rendering a viewer", async () => {
    render(
      await ProteinStructurePage({
        searchParams: Promise.resolve({ path: "relative/model.pdb" }),
      }),
    );
    expect(
      screen.getByText("Workspace path must be absolute."),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("member")).not.toBeInTheDocument();
  });
});
