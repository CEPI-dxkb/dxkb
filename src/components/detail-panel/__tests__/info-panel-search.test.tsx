import { render, screen } from "@testing-library/react";
import { InfoPanel } from "../info-panel";

// Workspace hooks are only invoked inside WorkspaceItemDetailContent (workspace variant).
// These tests only render the search variant, so no mock is needed.

describe("InfoPanel — search variant", () => {
  describe("loading state", () => {
    it("shows loading indicator when a single row is selected and data is loading", () => {
      render(
        <InfoPanel selectedIds={["genome-1"]} activeTab="genome" isLoading />,
      );
      expect(screen.getByText("Loading...")).toBeInTheDocument();
    });

    it("does not show loading indicator when multiple rows are selected", () => {
      render(
        <InfoPanel
          selectedIds={["genome-1", "genome-2"]}
          activeTab="genome"
          isLoading
        />,
      );
      expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
    });
  });

  describe("multi-selection display", () => {
    it("shows selected count when more than one row is selected", () => {
      render(
        <InfoPanel selectedIds={["genome-1", "genome-2"]} activeTab="genome" />,
      );
      expect(screen.getByText("2 rows selected")).toBeInTheDocument();
    });

    it("shows all-pages-selected message when isAllPagesSelected and totalItems are set", () => {
      render(
        <InfoPanel
          selectedIds={["genome-1", "genome-2"]}
          activeTab="genome"
          isAllPagesSelected
          totalItems={5000}
        />,
      );
      expect(screen.getByText("All 5,000 rows selected")).toBeInTheDocument();
    });

    it("falls back to count when isAllPagesSelected is true but totalItems is 0", () => {
      render(
        <InfoPanel
          selectedIds={["genome-1", "genome-2"]}
          activeTab="genome"
          isAllPagesSelected
          totalItems={0}
        />,
      );
      // totalItems is falsy → falls back to count
      expect(screen.getByText("2 rows selected")).toBeInTheDocument();
    });

    it("shows count for exactly one selected row without loading", () => {
      render(
        <InfoPanel
          selectedIds={["genome-1"]}
          activeTab="genome"
          isLoading={false}
          selectedRow={{ genome_id: "genome-1", genome_name: "Test Genome" }}
        />,
      );
      // Single row, not loading -> renders field detail panel (not multi-select message)
      expect(screen.queryByText(/rows selected/)).not.toBeInTheDocument();
      expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
    });

    it("renders Strain genome IDs and segment accessions as individual links", () => {
      render(
        <InfoPanel
          selectedIds={["strain-row-1"]}
          activeTab="strain"
          selectedRow={{
            id: "strain-row-1",
            strain: "A/test/1/2024",
            genome_ids: ["100.1", "100/2"],
            "4_ha": ["CY000001", "CY000002"],
          }}
        />,
      );

      expect(screen.getByRole("link", { name: "100.1" })).toHaveAttribute(
        "href",
        "/genome/100.1",
      );
      expect(screen.getByRole("link", { name: "100/2" })).toHaveAttribute(
        "href",
        "/genome/100%2F2",
      );
      expect(screen.getByRole("link", { name: "CY000001" })).toHaveAttribute(
        "href",
        "https://www.ncbi.nlm.nih.gov/nuccore/CY000001",
      );
      expect(screen.getByRole("link", { name: "CY000002" })).toHaveAttribute(
        "rel",
        "noopener noreferrer",
      );
    });

    it("does not warn when strain link arrays contain duplicate IDs", () => {
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);

      render(
        <InfoPanel
          selectedIds={["strain-row-1"]}
          activeTab="strain"
          selectedRow={{
            id: "strain-row-1",
            strain: "A/test/1/2024",
            genome_ids: ["100.1", "100.1"],
            "4_ha": ["CY000001", "CY000001"],
          }}
        />,
      );

      expect(screen.getAllByRole("link", { name: "100.1" })).toHaveLength(2);
      expect(screen.getAllByRole("link", { name: "CY000001" })).toHaveLength(2);
      const hasDuplicateKeyWarning = consoleError.mock.calls.some(([message]) =>
        String(message).includes("Encountered two children with the same key"),
      );
      consoleError.mockRestore();

      expect(hasDuplicateKeyWarning).toBe(false);
    });

    it("renders corrected Experiment detail fields", () => {
      render(
        <InfoPanel
          selectedIds={["experiment-1"]}
          activeTab="experiment"
          selectedRow={{
            exp_id: "1",
            exp_name: "Experiment 1",
            public_repository: "GEO",
          }}
        />,
      );

      expect(screen.getByText("Public Repository")).toBeInTheDocument();
      expect(screen.getByText("GEO")).toBeInTheDocument();
    });

    it("renders corrected Bioset detail fields", () => {
      render(
        <InfoPanel
          selectedIds={["bioset-1"]}
          activeTab="bioset"
          selectedRow={{
            bioset_id: "bioset-1",
            bioset_name: "Bioset 1",
            bioset_criteria: "adjusted p-value < 0.05",
            additional_metadata: "curated",
          }}
        />,
      );

      expect(screen.getByText("Criteria")).toBeInTheDocument();
      expect(screen.getByText("adjusted p-value < 0.05")).toBeInTheDocument();
      expect(screen.getAllByText("Additional Metadata")).toHaveLength(2);
      expect(screen.getByText("curated")).toBeInTheDocument();
    });

    it("renders ppi details for a selected interaction row", () => {
      render(
        <InfoPanel
          selectedIds={["ppi-1"]}
          activeTab="ppi"
          isLoading={false}
          selectedRow={{
            id: "ppi-1",
            interactor_a: "fig|224914.16.peg.635",
            genome_name_a: "Brucella melitensis bv. 1 str. 16M [WGS]",
            interactor_b: "fig|224914.16.peg.2425",
            category: "PPI",
            evidence: ["experimental"],
          }}
        />,
      );

      expect(
        screen.getAllByText("fig|224914.16.peg.635").length,
      ).toBeGreaterThan(0);
      expect(screen.getByText("Genome Name A")).toBeInTheDocument();
      expect(screen.getAllByText("Interactor B").length).toBeGreaterThan(0);
      expect(screen.getByText("PPI")).toBeInTheDocument();
    });
  });
});
