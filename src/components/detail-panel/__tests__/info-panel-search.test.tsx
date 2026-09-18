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
            s: ["S000001"],
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
      expect(screen.getByRole("link", { name: "S000001" })).toHaveAttribute(
        "href",
        "https://www.ncbi.nlm.nih.gov/nuccore/S000001",
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
      // "Interactor B" names BOTH the collapsible section header (a <button>)
      // and the field label inside it (a <td>), so asserting the text is
      // present says nothing about the value: a panel rendering the header and
      // an empty value cell passed. `DetailKeyValueTable` renders each field as
      // one <tr> of label cell + value cell, so the field row's text is the
      // label/value pairing. Dropping the <tr>-less section header leaves
      // exactly one row, asserted whole.
      const interactorBFieldRows = screen
        .getAllByText("Interactor B")
        .flatMap((label) => label.closest("tr")?.textContent ?? []);
      expect(interactorBFieldRows).toEqual([
        "Interactor Bfig|224914.16.peg.2425",
      ]);
      expect(screen.getByText("PPI")).toBeInTheDocument();
    });
  });
});

describe("InfoPanel — metadata link classification", () => {
  it("keeps Genome ID an internal relative link, not rebased onto a production origin", () => {
    render(
      <InfoPanel
        selectedIds={["genome-1"]}
        activeTab="genome"
        selectedRow={{
          genome_id: "83332.12",
          genome_name: "M. tuberculosis H37Rv",
        }}
      />,
    );

    const link = screen.getByRole("link", { name: "83332.12" });
    expect(link).toHaveAttribute("href", "/genome/83332.12");
    expect(link).not.toHaveAttribute("target");
  });

  it("renders Genome's NCBI Taxon ID as a safe external new-tab link", () => {
    render(
      <InfoPanel
        selectedIds={["genome-1"]}
        activeTab="genome"
        selectedRow={{
          genome_id: "83332.12",
          genome_name: "M. tuberculosis H37Rv",
          taxon_id: "83332",
        }}
      />,
    );

    const link = screen.getByRole("link", { name: "83332" });
    expect(link).toHaveAttribute(
      "href",
      "https://www.ncbi.nlm.nih.gov/Taxonomy/Browser/wwwtax.cgi?id=83332",
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("resolves Genome's row-aware Contigs link and keeps it internal (no dxkb.org, no /view/*)", () => {
    render(
      <InfoPanel
        selectedIds={["genome-1"]}
        activeTab="genome"
        selectedRow={{
          genome_id: "83332.12",
          genome_name: "M. tuberculosis H37Rv",
          contigs: 1,
        }}
      />,
    );

    const link = screen.getByRole("link", { name: "1" });
    expect(link).toHaveAttribute("href", "/genome/83332.12?tab=sequences");
    expect(link).not.toHaveAttribute("target");
  });

  it("fixes Genome Feature's Taxon ID to the canonical internal taxonomy route", () => {
    render(
      <InfoPanel
        selectedIds={["feature-1"]}
        activeTab="genome_feature"
        selectedRow={{
          genome_id: "83332.12",
          taxon_id: "83332",
        }}
      />,
    );

    const link = screen.getByRole("link", { name: "83332" });
    expect(link).toHaveAttribute("href", "/taxonomy/83332");
    expect(link).not.toHaveAttribute("target");
  });

  it("resolves Genome Feature's row-aware Genome Name link from genome_id", () => {
    render(
      <InfoPanel
        selectedIds={["feature-1"]}
        activeTab="genome_feature"
        selectedRow={{
          genome_id: "83332.12",
          genome_name: "M. tuberculosis H37Rv",
        }}
      />,
    );

    const link = screen.getByRole("link", {
      name: "M. tuberculosis H37Rv",
    });
    expect(link).toHaveAttribute("href", "/genome/83332.12");
  });

  it("fixes Strain's Taxon ID to the canonical internal taxonomy route", () => {
    render(
      <InfoPanel
        selectedIds={["strain-1"]}
        activeTab="strain"
        selectedRow={{
          id: "strain-1",
          strain: "A/test/1/2024",
          taxon_id: "1580",
        }}
      />,
    );

    const link = screen.getByRole("link", { name: "1580" });
    expect(link).toHaveAttribute("href", "/taxonomy/1580");
    expect(link).not.toHaveAttribute("target");
  });

  it("upgrades Protein Feature's RefSeq Locus Tag link to https", () => {
    render(
      <InfoPanel
        selectedIds={["protein-feature-1"]}
        activeTab="protein_feature"
        selectedRow={{
          genome_id: "83332.12",
          refseq_locus_tag: "RVBD_0001",
        }}
      />,
    );

    const link = screen.getByRole("link", { name: "RVBD_0001" });
    expect(link).toHaveAttribute(
      "href",
      "https://www.ncbi.nlm.nih.gov/protein/?term=RVBD_0001",
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("skips an array link entry whose value resolves to nothing, without breaking the rest", () => {
    render(
      <InfoPanel
        selectedIds={["strain-1"]}
        activeTab="strain"
        selectedRow={{
          id: "strain-1",
          strain: "A/test/1/2024",
          genome_ids: ["100.1", ""],
        }}
      />,
    );

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveTextContent("100.1");
    expect(links[0]).toHaveAttribute("href", "/genome/100.1");
  });

  it("suppresses the whole row when every array link entry resolves to nothing", () => {
    render(
      <InfoPanel
        selectedIds={["strain-1"]}
        activeTab="strain"
        selectedRow={{
          id: "strain-1",
          strain: "A/test/1/2024",
          genome_ids: ["", ""],
        }}
      />,
    );

    // A populated <dt> never sits next to an empty <dd> (plan item 19's rule):
    // the field is treated as unavailable, not rendered with an empty value.
    expect(screen.queryByText("Genome IDs")).not.toBeInTheDocument();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("rewrites Genome Sequence's stale FeatureList target onto the internal Feature collection RQL", () => {
    render(
      <InfoPanel
        selectedIds={["sequence-1"]}
        activeTab="genome_sequence"
        selectedRow={{
          genome_id: "83332.12",
          sequence_id: "83332.12.1",
        }}
      />,
    );

    const link = screen.getByRole("link", { name: "83332.12.1" });
    expect(link).toHaveAttribute(
      "href",
      "/feature?rql=and(eq(annotation,PATRIC),eq(sequence_id,83332.12.1),eq(feature_type,CDS))",
    );
    expect(link).not.toHaveAttribute("target");
  });
});
