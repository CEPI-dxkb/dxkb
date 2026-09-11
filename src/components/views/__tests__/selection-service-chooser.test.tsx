import type { ComponentProps } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mocks = vi.hoisted(() => ({
  createFolder: vi.fn(),
  createIdGroup: vi.fn(),
  rerunJob: vi.fn(),
}));

vi.mock("@/contexts/workspace-repository-context", () => ({
  useWorkspaceRepository: vi.fn(() => ({
    createFolder: mocks.createFolder,
    createIdGroup: mocks.createIdGroup,
  })),
}));
vi.mock("@/lib/rerun-utility", () => ({ rerunJob: mocks.rerunJob }));

import { SelectionServiceChooser } from "../selection-service-chooser";

const genomeIds = ["641501.3", "641501.4"];
const groupPath = "/alice@bvbrc/home/._tmp_groups/tmp_genome_group_test-uuid";

function renderChooser(
  onOpenChange = vi.fn(),
  overrides: Partial<ComponentProps<typeof SelectionServiceChooser>> = {},
) {
  render(
    <SelectionServiceChooser
      open
      onOpenChange={onOpenChange}
      label="Strains"
      ids={genomeIds}
      workspaceUsername="alice@bvbrc"
      {...overrides}
    />,
  );
  return onOpenChange;
}

describe("SelectionServiceChooser", () => {
  beforeEach(() => {
    vi.stubGlobal("crypto", { randomUUID: () => "test-uuid" });
    mocks.createFolder.mockReset().mockResolvedValue(undefined);
    mocks.createIdGroup.mockReset().mockResolvedValue(undefined);
    mocks.rerunJob.mockReset();
  });

  afterEach(() => vi.unstubAllGlobals());

  it("reports that no service accepts the selection", () => {
    renderChooser(vi.fn(), {
      label: "Protein Structures",
      ids: [],
      hasSelectableServices: false,
    });

    expect(screen.getByText("No selectable services")).toBeVisible();
    expect(
      screen.getByText(
        "Services that accept Protein Structures are not available yet.",
      ),
    ).toBeVisible();
    for (const name of ["BLAST", "Viral Genome Tree", "Viral MSA"]) {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    }
  });

  it("keeps the selected genomes for direct BLAST when signed out", async () => {
    const onOpenChange = vi.fn();
    const onRequireAuthentication = vi.fn();
    renderChooser(onOpenChange, {
      workspaceUsername: undefined,
      onRequireAuthentication,
    });

    await userEvent.click(screen.getByRole("button", { name: "BLAST" }));

    // Direct BLAST writes no workspace object, so the IDs travel in the rerun
    // payload and the protected service route handles sign-in itself. Redirecting
    // here instead dropped the selection.
    expect(mocks.rerunJob).toHaveBeenCalledWith(
      expect.objectContaining({ db_genome_list: genomeIds }),
      "Homology",
    );
    expect(onRequireAuthentication).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("requests authentication for group-backed services when signed out", async () => {
    const onOpenChange = vi.fn();
    const onRequireAuthentication = vi.fn();
    renderChooser(onOpenChange, {
      workspaceUsername: undefined,
      onRequireAuthentication,
    });

    await userEvent.click(
      screen.getByRole("button", { name: "Viral Genome Tree" }),
    );

    expect(onRequireAuthentication).toHaveBeenCalledWith(
      "/services/viral-genome-tree",
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(mocks.createFolder).not.toHaveBeenCalled();
    expect(mocks.createIdGroup).not.toHaveBeenCalled();
    expect(mocks.rerunJob).not.toHaveBeenCalled();
  });

  it("creates the hidden temporary-group folder before writing the group", async () => {
    renderChooser();

    await userEvent.click(
      screen.getByRole("button", { name: "Viral Genome Tree" }),
    );

    expect(mocks.createFolder).toHaveBeenCalledWith(
      "/alice@bvbrc/home/._tmp_groups",
    );
    expect(mocks.createIdGroup).toHaveBeenCalled();
  });

  it("still writes the group when the folder already exists", async () => {
    mocks.createFolder.mockRejectedValue(new Error("Object already exists"));
    const onOpenChange = renderChooser();

    await userEvent.click(
      screen.getByRole("button", { name: "Viral Genome Tree" }),
    );

    expect(mocks.createIdGroup).toHaveBeenCalled();
    expect(mocks.rerunJob).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("reports the original error when the group write fails", async () => {
    mocks.createFolder.mockRejectedValue(new Error("Object already exists"));
    mocks.createIdGroup.mockRejectedValue(
      new Error("_ERROR_User lacks permission"),
    );
    renderChooser();

    await userEvent.click(
      screen.getByRole("button", { name: "Viral Genome Tree" }),
    );

    expect(
      await screen.findByText("_ERROR_User lacks permission"),
    ).toBeInTheDocument();
  });

  it("opens BLAST with selected genomes without creating a group", async () => {
    const onOpenChange = renderChooser();

    await userEvent.click(screen.getByRole("button", { name: "BLAST" }));

    expect(mocks.createIdGroup).not.toHaveBeenCalled();
    expect(mocks.rerunJob).toHaveBeenCalledWith(
      {
        blast_program: "blastn",
        db_type: "fna",
        db_source: "genome_list",
        db_precomputed_database: "selGenome",
        db_genome_list: genomeIds,
      },
      "Homology",
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("creates a temporary genome group and opens Viral Genome Tree", async () => {
    renderChooser();

    await userEvent.click(
      screen.getByRole("button", { name: "Viral Genome Tree" }),
    );

    expect(mocks.createIdGroup).toHaveBeenCalledWith({
      path: "/alice@bvbrc/home/._tmp_groups",
      name: "tmp_genome_group_test-uuid",
      type: "genome_group",
      idField: "genome_id",
      ids: genomeIds,
    });
    expect(mocks.rerunJob).toHaveBeenCalledWith(
      {
        tree_type: "viral_genome",
        sequences: [{ type: "genome_group", filename: groupPath }],
      },
      "GeneTree",
    );
  });

  it("creates a temporary genome group and opens Viral MSA", async () => {
    renderChooser();

    await userEvent.click(screen.getByRole("button", { name: "Viral MSA" }));

    expect(mocks.createIdGroup).toHaveBeenCalledWith({
      path: "/alice@bvbrc/home/._tmp_groups",
      name: "tmp_genome_group_test-uuid",
      type: "genome_group",
      idField: "genome_id",
      ids: genomeIds,
    });
    expect(mocks.rerunJob).toHaveBeenCalledWith(
      {
        input_status: "unaligned",
        input_type: "input_genomegroup",
        select_genomegroup: [groupPath],
        ref_type: "none",
        aligner: "Mafft",
        fasta_keyboard_input: "",
        alphabet: "dna",
        ref_string: "",
      },
      "MSA",
    );
  });

  describe("feature selections", () => {
    const featureIds = ["PATRIC.83332.12.NC_000962.CDS.1.1524.fwd"];
    const featureGroupPath =
      "/alice@bvbrc/home/._tmp_groups/tmp_feature_group_test-uuid";

    function renderFeatureChooser() {
      return renderChooser(vi.fn(), {
        label: "Features",
        ids: featureIds,
        kind: "feature",
      });
    }

    it("offers the legacy feature services", () => {
      renderFeatureChooser();

      for (const name of [
        "BLAST",
        "Gene Tree",
        "HA Subtype Numbering Conversion",
      ]) {
        expect(screen.getByRole("button", { name })).toBeVisible();
      }
      for (const name of ["Viral Genome Tree", "Viral MSA"]) {
        expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
      }
    });

    it("asks which side of BLAST the selection belongs on", async () => {
      renderFeatureChooser();

      await userEvent.click(screen.getByRole("button", { name: "BLAST" }));
      expect(screen.getByText("Select the BLAST source")).toBeVisible();
      expect(mocks.createIdGroup).not.toHaveBeenCalled();

      await userEvent.click(screen.getByRole("button", { name: "Query" }));
      expect(mocks.createIdGroup).toHaveBeenCalledWith({
        path: "/alice@bvbrc/home/._tmp_groups",
        name: "tmp_feature_group_test-uuid",
        type: "feature_group",
        idField: "feature_id",
        ids: featureIds,
      });
      expect(mocks.rerunJob).toHaveBeenCalledWith(
        {
          blast_program: "blastn",
          db_type: "fna",
          input_source: "feature_group",
          input_feature_group: featureGroupPath,
          db_precomputed_database: "bacteria-archaea",
        },
        "Homology",
      );
    });

    it("searches against the selection when BLAST uses it as the source", async () => {
      renderFeatureChooser();

      await userEvent.click(screen.getByRole("button", { name: "BLAST" }));
      await userEvent.click(screen.getByRole("button", { name: "Source" }));

      expect(mocks.rerunJob).toHaveBeenCalledWith(
        {
          blast_program: "blastn",
          db_type: "fna",
          db_precomputed_database: "selFeatureGroup",
          db_feature_group: featureGroupPath,
        },
        "Homology",
      );
    });

    it("creates a temporary feature group and opens Gene Tree", async () => {
      renderFeatureChooser();

      await userEvent.click(screen.getByRole("button", { name: "Gene Tree" }));

      expect(mocks.rerunJob).toHaveBeenCalledWith(
        {
          tree_type: "gene",
          sequences: [{ type: "feature_group", filename: featureGroupPath }],
        },
        "GeneTree",
      );
    });

    it("creates a temporary feature group and opens HA Subtype Numbering Conversion", async () => {
      renderFeatureChooser();

      await userEvent.click(
        screen.getByRole("button", {
          name: "HA Subtype Numbering Conversion",
        }),
      );

      expect(mocks.rerunJob).toHaveBeenCalledWith(
        {
          input_source: "feature_group",
          input_feature_group: featureGroupPath,
        },
        "HASubtypeNumberingConversion",
      );
    });
  });

  it("preserves a workspace error and does not open a service", async () => {
    mocks.createIdGroup.mockRejectedValue(
      new Error("Workspace quota exceeded"),
    );
    const onOpenChange = renderChooser();

    await userEvent.click(screen.getByRole("button", { name: "Viral MSA" }));

    expect(
      await screen.findByText("Workspace quota exceeded"),
    ).toBeInTheDocument();
    expect(mocks.rerunJob).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
