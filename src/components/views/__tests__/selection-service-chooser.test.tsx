import type { ComponentProps } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mocks = vi.hoisted(() => ({
  createFolder: vi.fn(),
  createIdGroup: vi.fn(),
  rerunJob: vi.fn(),
  reserveRerunWindow: vi.fn(),
  refresh: vi.fn(),
}));

// The shared setup mock has no `refresh`, which is the only router call here.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
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

import {
  rerunPopupBlockedMessage,
  rerunWindowClosedMessage,
} from "@/lib/rerun-utility";
import { SelectionServiceChooser } from "../selection-service-chooser";

const genomeIds = ["641501.3", "641501.4"];
const groupPath = "/alice@bvbrc/home/._tmp_groups/tmp_genome_group_test-uuid";
const signInHref = "/sign-in?redirect=%2Fsearch%3Fq%3Dflu";
const signInMessage =
  "Sign in to use this service. Your selection is kept here — sign in, then come back to this tab and try again.";
const signInButtonName = "Sign In (opens a new tab)";

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
    signInHref,
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
    mocks.refresh.mockReset();
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
    expect(screen.queryByRole("button", { name: signInButtonName })).toBeNull();
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
    const signInButton = screen.getByRole("button", { name: signInButtonName });
    expect(signInButton).toHaveAttribute("href", signInHref);
    // A new tab is what keeps this tab — and the selection behind it — mounted.
    expect(signInButton).toHaveAttribute("target", "_blank");
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

  it("refreshes the session on return, then launches with the same selection", async () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <SelectionServiceChooser
        {...chooserProps(onOpenChange, { workspaceUsername: undefined })}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Viral Genome Tree" }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(signInMessage);

    // Sign-in happens on the tab the link opened, so this tab only learns about the
    // new session when it is focused again.
    expect(mocks.refresh).not.toHaveBeenCalled();
    fireEvent.focus(window);
    expect(mocks.refresh).toHaveBeenCalledTimes(1);

    // What that refresh produces: a re-derived server user, with every client
    // component — including the collection holding the selection — still mounted.
    rerender(
      <SelectionServiceChooser {...chooserProps(onOpenChange)} />,
    );
    expect(screen.queryByRole("alert")).toBeNull();

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

  it("only listens for a return while the sign-in prompt is showing", async () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <SelectionServiceChooser
        {...chooserProps(onOpenChange, { workspaceUsername: undefined })}
      />,
    );

    // No prompt yet, so a focused tab has nothing to re-check.
    fireEvent.focus(window);
    expect(mocks.refresh).not.toHaveBeenCalled();

    await userEvent.click(
      screen.getByRole("button", { name: "Viral Genome Tree" }),
    );
    fireEvent.focus(window);
    expect(mocks.refresh).toHaveBeenCalledTimes(1);

    // Closing clears the prompt, which is what releases the listener again.
    rerender(
      <SelectionServiceChooser
        {...chooserProps(onOpenChange, {
          workspaceUsername: undefined,
          open: false,
        })}
      />,
    );
    fireEvent.focus(window);
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it("clears a stale failure on both sides of the BLAST source subflow", async () => {
    mocks.reserveRerunWindow.mockReturnValue(null);
    const featureOverrides = {
      label: "Features",
      ids: ["PATRIC.83332.12.NC_000962.CDS.1.1524.fwd"],
      kind: "feature" as const,
    };
    render(
      <SelectionServiceChooser {...chooserProps(vi.fn(), featureOverrides)} />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Gene Tree" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      rerunPopupBlockedMessage,
    );

    // Entering the subflow is a new question; the previous answer's error is stale.
    await userEvent.click(screen.getByRole("button", { name: "BLAST" }));
    expect(screen.getByText("Select the BLAST source")).toBeVisible();
    expect(screen.queryByRole("alert")).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Query" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      rerunPopupBlockedMessage,
    );
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.queryByRole("alert")).toBeNull();
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

describe("SelectionServiceChooser failure presentation", () => {
  beforeEach(() => {
    vi.stubGlobal("crypto", { randomUUID: () => "test-uuid" });
    reservedWindows = [];
    mocks.createFolder.mockReset().mockResolvedValue(undefined);
    mocks.createIdGroup.mockReset().mockResolvedValue(undefined);
    mocks.rerunJob.mockReset().mockReturnValue({ status: "opened" });
    mocks.reserveRerunWindow.mockReset().mockImplementation(reserveFakeWindow);
    mocks.refresh.mockReset();
  });

  afterEach(() => vi.unstubAllGlobals());

  it("falls back to a readable message when the failure is an Error with no message", async () => {
    // The alert renders on the `failure` object, not on its text, so an empty
    // message painted a bordered destructive region with nothing in it —
    // announced to a screen reader as an empty alert.
    mocks.createIdGroup.mockRejectedValue(new Error("   "));
    renderChooser();

    await userEvent.click(
      screen.getByRole("button", { name: "Viral Genome Tree" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to open the selected service",
    );
  });

  it("falls back to a readable message when the failure is not an Error", async () => {
    mocks.createIdGroup.mockRejectedValue({ status: 500 });
    renderChooser();

    await userEvent.click(
      screen.getByRole("button", { name: "Viral Genome Tree" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to open the selected service",
    );
  });

  it("reports a reserved tab the user closed with the closed-tab advice", async () => {
    // `windowClosed` is its own status: telling the user to allow pop-ups would
    // be the wrong fix for a tab they closed themselves.
    mocks.rerunJob.mockReturnValue({
      status: "windowClosed",
      message: rerunWindowClosedMessage,
    });
    const onOpenChange = renderChooser();

    await userEvent.click(
      screen.getByRole("button", { name: "Viral Genome Tree" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      rerunWindowClosedMessage,
    );
    expect(reservedWindows[0].close).toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
