import type { ComponentProps } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mocks = vi.hoisted(() => ({
  createIdGroup: vi.fn(),
  rerunJob: vi.fn(),
}));

vi.mock("@/contexts/workspace-repository-context", () => ({
  useWorkspaceRepository: vi.fn(() => ({ createIdGroup: mocks.createIdGroup })),
}));
vi.mock("@/lib/rerun-utility", () => ({ rerunJob: mocks.rerunJob }));

import { StrainServiceChooser } from "../strain-service-chooser";

const genomeIds = ["641501.3", "641501.4"];
const groupPath = "/alice@bvbrc/home/._tmp_groups/tmp_genome_group_test-uuid";

function renderChooser(
  onOpenChange = vi.fn(),
  overrides: Partial<ComponentProps<typeof StrainServiceChooser>> = {},
) {
  render(
    <StrainServiceChooser
      open
      onOpenChange={onOpenChange}
      genomeIds={genomeIds}
      workspaceUsername="alice@bvbrc"
      {...overrides}
    />,
  );
  return onOpenChange;
}

describe("StrainServiceChooser", () => {
  beforeEach(() => {
    vi.stubGlobal("crypto", { randomUUID: () => "test-uuid" });
    mocks.createIdGroup.mockReset().mockResolvedValue(undefined);
    mocks.rerunJob.mockReset();
  });

  afterEach(() => vi.unstubAllGlobals());

  it("requests authentication for the selected service when signed out", async () => {
    const onOpenChange = vi.fn();
    const onRequireAuthentication = vi.fn();
    renderChooser(onOpenChange, {
      workspaceUsername: undefined,
      onRequireAuthentication,
    });

    await userEvent.click(screen.getByRole("button", { name: "BLAST" }));

    expect(onRequireAuthentication).toHaveBeenCalledWith("/services/blast");
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(mocks.rerunJob).not.toHaveBeenCalled();
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
