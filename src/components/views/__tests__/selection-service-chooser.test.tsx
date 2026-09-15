import type { ComponentProps } from "react";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mocks = vi.hoisted(() => ({
  createFolder: vi.fn(),
  createIdGroup: vi.fn(),
  rerunJob: vi.fn(),
  reserveRerunWindow: vi.fn(),
}));

vi.mock("@/contexts/workspace-repository-context", () => ({
  useWorkspaceRepository: vi.fn(() => ({
    createFolder: mocks.createFolder,
    createIdGroup: mocks.createIdGroup,
  })),
}));
// `closeRerunWindow` stays real so the tests observe the reserved tab being closed.
vi.mock("@/lib/rerun-utility", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/rerun-utility")>()),
  rerunJob: mocks.rerunJob,
  reserveRerunWindow: mocks.reserveRerunWindow,
}));

import { rerunPopupBlockedMessage } from "@/lib/rerun-utility";
import { SelectionServiceChooser } from "../selection-service-chooser";

const genomeIds = ["641501.3", "641501.4"];
const groupPath = "/alice@bvbrc/home/._tmp_groups/tmp_genome_group_test-uuid";
const signInHref = "/sign-in?redirect=%2Fsearch%3Fq%3Dflu";
const signInMessage =
  "Sign in to use this service. Your selection is kept here, so you can try again once you are signed in.";

interface FakeWindow {
  close: ReturnType<typeof vi.fn>;
  closed: boolean;
}

/** Tabs handed out by the mocked `reserveRerunWindow`, newest last. */
let reservedWindows: FakeWindow[] = [];

function reserveFakeWindow(closeImplementation?: () => void): Window {
  const reserved: FakeWindow = {
    close: vi.fn(closeImplementation),
    closed: false,
  };
  reservedWindows.push(reserved);
  return reserved as unknown as Window;
}

function chooserProps(
  onOpenChange: () => void,
  overrides: Partial<ComponentProps<typeof SelectionServiceChooser>> = {},
): ComponentProps<typeof SelectionServiceChooser> {
  return {
    open: true,
    onOpenChange,
    label: "Strains",
    ids: genomeIds,
    workspaceUsername: "alice@bvbrc",
    ...overrides,
  };
}

function renderChooser(
  onOpenChange = vi.fn(),
  overrides: Partial<ComponentProps<typeof SelectionServiceChooser>> = {},
) {
  render(<SelectionServiceChooser {...chooserProps(onOpenChange, overrides)} />);
  return onOpenChange;
}

describe("SelectionServiceChooser", () => {
  beforeEach(() => {
    vi.stubGlobal("crypto", { randomUUID: () => "test-uuid" });
    reservedWindows = [];
    mocks.createFolder.mockReset().mockResolvedValue(undefined);
    mocks.createIdGroup.mockReset().mockResolvedValue(undefined);
    mocks.rerunJob.mockReset().mockReturnValue({ status: "opened" });
    mocks.reserveRerunWindow.mockReset().mockImplementation(reserveFakeWindow);
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
    renderChooser(onOpenChange, {
      workspaceUsername: undefined,
      signInHref,
    });

    await userEvent.click(screen.getByRole("button", { name: "BLAST" }));

    // Direct BLAST writes no workspace object, so the IDs travel in the rerun
    // payload and the protected service route handles sign-in itself. Redirecting
    // here instead dropped the selection.
    expect(mocks.rerunJob).toHaveBeenCalledWith(
      expect.objectContaining({ db_genome_list: genomeIds }),
      "Homology",
    );
    expect(screen.queryByRole("button", { name: "Sign In" })).toBeNull();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("asks a signed-out user to sign in without leaving the collection", async () => {
    const onOpenChange = vi.fn();
    renderChooser(onOpenChange, {
      workspaceUsername: undefined,
      signInHref,
    });

    await userEvent.click(
      screen.getByRole("button", { name: "Viral Genome Tree" }),
    );

    // Navigating to the service form closed the dialog and discarded the row
    // selection, so the form opened unprefilled after sign-in.
    expect(screen.getByRole("alert")).toHaveTextContent(signInMessage);
    // Rendered through `Button render={<Link/>}`, so the anchor carries role="button".
    expect(screen.getByRole("button", { name: "Sign In" })).toHaveAttribute(
      "href",
      signInHref,
    );
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(mocks.reserveRerunWindow).not.toHaveBeenCalled();
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

  it("reports a folder creation failure without attempting the group write", async () => {
    mocks.createFolder.mockRejectedValue(
      new Error("_ERROR_User lacks permission to create folder"),
    );
    renderChooser();

    await userEvent.click(
      screen.getByRole("button", { name: "Viral Genome Tree" }),
    );

    expect(
      await screen.findByText("_ERROR_User lacks permission to create folder"),
    ).toBeInTheDocument();
    expect(mocks.createIdGroup).not.toHaveBeenCalled();
    expect(mocks.rerunJob).not.toHaveBeenCalled();
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
      { resultWindow: reservedWindows[0] },
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
      { resultWindow: reservedWindows[0] },
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
        { resultWindow: reservedWindows[0] },
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
        { resultWindow: reservedWindows[0] },
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
        { resultWindow: reservedWindows[0] },
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
        { resultWindow: reservedWindows[0] },
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

  it("launches with the same selection once the user has signed in", async () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <SelectionServiceChooser
        {...chooserProps(onOpenChange, {
          workspaceUsername: undefined,
          signInHref,
        })}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Viral Genome Tree" }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(signInMessage);

    // The dialog never closed and never navigated, so the collection behind it
    // still holds the same rows: the retry runs on the original selection.
    rerender(
      <SelectionServiceChooser {...chooserProps(onOpenChange, { signInHref })} />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Viral Genome Tree" }),
    );

    expect(mocks.createIdGroup).toHaveBeenCalledWith(
      expect.objectContaining({ ids: genomeIds }),
    );
    expect(mocks.rerunJob).toHaveBeenCalledWith(
      {
        tree_type: "viral_genome",
        sequences: [{ type: "genome_group", filename: groupPath }],
      },
      "GeneTree",
      { resultWindow: reservedWindows[0] },
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("stays open with the launch error when a direct BLAST tab is blocked", async () => {
    mocks.rerunJob.mockReturnValue({
      status: "blockedPopup",
      message: rerunPopupBlockedMessage,
    });
    const onOpenChange = renderChooser();

    await userEvent.click(screen.getByRole("button", { name: "BLAST" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      rerunPopupBlockedMessage,
    );
    expect(screen.getByRole("button", { name: "BLAST" })).toBeEnabled();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("writes no group when the reserved tab is refused", async () => {
    mocks.reserveRerunWindow.mockReturnValue(null);
    const onOpenChange = renderChooser();

    await userEvent.click(
      screen.getByRole("button", { name: "Viral Genome Tree" }),
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      rerunPopupBlockedMessage,
    );
    // Failing before the workspace write is what keeps the group from leaking.
    expect(mocks.createFolder).not.toHaveBeenCalled();
    expect(mocks.createIdGroup).not.toHaveBeenCalled();
    expect(mocks.rerunJob).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("closes the reserved tab when the group-backed launch is blocked", async () => {
    mocks.rerunJob.mockReturnValue({
      status: "blockedPopup",
      message: rerunPopupBlockedMessage,
    });
    const onOpenChange = renderChooser();

    await userEvent.click(
      screen.getByRole("button", { name: "Viral Genome Tree" }),
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      rerunPopupBlockedMessage,
    );
    expect(reservedWindows[0].close).toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Viral Genome Tree" }),
    ).toBeEnabled();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("closes the reserved tab when the group write fails", async () => {
    mocks.createIdGroup.mockRejectedValue(
      new Error("Workspace quota exceeded"),
    );
    renderChooser();

    await userEvent.click(
      screen.getByRole("button", { name: "Viral Genome Tree" }),
    );

    expect(
      await screen.findByText("Workspace quota exceeded"),
    ).toBeInTheDocument();
    expect(reservedWindows[0].close).toHaveBeenCalled();
  });

  it("keeps the original error when closing the reserved tab also fails", async () => {
    mocks.reserveRerunWindow.mockImplementation(() =>
      reserveFakeWindow(() => {
        throw new Error("close failed");
      }),
    );
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

  describe("reopened dialog sessions", () => {
    async function startLaunchThenReopen(
      groupWrite: Promise<undefined>,
      onOpenChange: () => void,
    ) {
      const { rerender } = render(
        <SelectionServiceChooser {...chooserProps(onOpenChange)} />,
      );
      mocks.createIdGroup.mockReturnValue(groupWrite);

      await userEvent.click(
        screen.getByRole("button", { name: "Viral Genome Tree" }),
      );
      rerender(
        <SelectionServiceChooser
          {...chooserProps(onOpenChange, { open: false })}
        />,
      );
      rerender(<SelectionServiceChooser {...chooserProps(onOpenChange)} />);
    }

    it("ignores a group write that resolves after the dialog was reopened", async () => {
      const groupWrite = Promise.withResolvers<undefined>();
      const onOpenChange = vi.fn();
      await startLaunchThenReopen(groupWrite.promise, onOpenChange);

      await act(async () => {
        groupWrite.resolve(undefined);
        await groupWrite.promise;
      });

      expect(mocks.rerunJob).not.toHaveBeenCalled();
      expect(onOpenChange).not.toHaveBeenCalled();
      expect(reservedWindows[0].close).toHaveBeenCalled();
      expect(screen.queryByRole("alert")).toBeNull();
      expect(
        screen.getByRole("button", { name: "Viral Genome Tree" }),
      ).toBeEnabled();
    });

    it("ignores a group failure that arrives after the dialog was reopened", async () => {
      const groupWrite = Promise.withResolvers<undefined>();
      const onOpenChange = vi.fn();
      await startLaunchThenReopen(groupWrite.promise, onOpenChange);

      await act(async () => {
        groupWrite.reject(new Error("Workspace quota exceeded"));
        await groupWrite.promise.catch(() => undefined);
      });

      expect(screen.queryByRole("alert")).toBeNull();
      expect(reservedWindows[0].close).toHaveBeenCalled();
      expect(onOpenChange).not.toHaveBeenCalled();
    });

    it("reopens on the service list without the previous session's error", async () => {
      mocks.reserveRerunWindow.mockReturnValue(null);
      const onOpenChange = vi.fn();
      const { rerender } = render(
        <SelectionServiceChooser
          {...chooserProps(onOpenChange, {
            label: "Features",
            ids: ["PATRIC.83332.12.NC_000962.CDS.1.1524.fwd"],
            kind: "feature",
          })}
        />,
      );

      await userEvent.click(screen.getByRole("button", { name: "BLAST" }));
      await userEvent.click(screen.getByRole("button", { name: "Query" }));
      expect(screen.getByRole("alert")).toHaveTextContent(
        rerunPopupBlockedMessage,
      );

      rerender(
        <SelectionServiceChooser
          {...chooserProps(onOpenChange, {
            open: false,
            label: "Features",
            ids: ["PATRIC.83332.12.NC_000962.CDS.1.1524.fwd"],
            kind: "feature",
          })}
        />,
      );
      rerender(
        <SelectionServiceChooser
          {...chooserProps(onOpenChange, {
            label: "Features",
            ids: ["PATRIC.83332.12.NC_000962.CDS.1.1524.fwd"],
            kind: "feature",
          })}
        />,
      );

      expect(screen.queryByRole("alert")).toBeNull();
      expect(screen.queryByText("Select the BLAST source")).toBeNull();
      expect(screen.getByRole("button", { name: "Gene Tree" })).toBeVisible();
    });
  });
});
