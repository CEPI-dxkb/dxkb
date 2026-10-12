import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WorkspaceObjectSelector } from "@/components/workspace/workspace-object-selector";
import { useAuth } from "@/lib/auth/provider";
import {
  findOption,
  makeFilePickerRepository,
  makePickerRepository,
  pickerHome as home,
  pickerRepositoryWrapper,
  pickerUser,
  selectButton,
  stubPickerBrowserApis,
} from "@/components/workspace/folder-picker/__tests__/fixtures/picker-harness";

vi.mock("@/lib/auth/provider", () => ({
  useAuth: vi.fn(() => ({ user: pickerUser })),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

stubPickerBrowserApis();

beforeEach(() => {
  // useAuth runs on every render, so a test that signs out sets the value for
  // the whole test; this puts the signed-in user back.
  vi.mocked(useAuth).mockReturnValue({
    user: pickerUser,
  } as ReturnType<typeof useAuth>);
});

function renderSelector(
  props: Partial<Parameters<typeof WorkspaceObjectSelector>[0]> = {},
  repository = makePickerRepository(),
) {
  render(
    <WorkspaceObjectSelector
      preset="folder"
      placeholder="Search for folders..."
      {...props}
    />,
    { wrapper: pickerRepositoryWrapper(repository) },
  );
  return { user: userEvent.setup(), repository };
}

const browse = () =>
  screen.getByRole("button", { name: "Browse workspace folders" });

describe("WorkspaceObjectSelector browse (folders)", () => {
  it("commits a folder chosen in the picker like a clicked suggestion", async () => {
    const onObjectSelect = vi.fn();
    const { user } = renderSelector({ onObjectSelect });
    await user.click(browse());
    await user.dblClick(await findOption("Home", "Experiments"));
    expect(onObjectSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        path: `${home}/Experiments`,
        name: "Experiments",
        isDirectory: true,
      }),
    );
    expect(screen.getByPlaceholderText("Search for folders...")).toHaveValue(
      "Experiments",
    );
    await waitFor(() => {
      expect(browse()).toHaveFocus();
    });
  });

  it("commits Home itself when nothing below it is selected", async () => {
    const onObjectSelect = vi.fn();
    const { user } = renderSelector({ onObjectSelect });
    await user.click(browse());
    await waitFor(() => {
      expect(selectButton()).toBeEnabled();
    });
    await user.click(selectButton());
    expect(onObjectSelect).toHaveBeenCalledWith(
      expect.objectContaining({ path: home, isDirectory: true }),
    );
  });

  it("only stages the folder when the caller stages selections", async () => {
    const onObjectSelect = vi.fn();
    const onSelectedObjectChange = vi.fn();
    const { user } = renderSelector({ onObjectSelect, onSelectedObjectChange });
    await user.click(browse());
    await user.dblClick(await findOption("Home", "Alpha"));
    expect(onSelectedObjectChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ path: `${home}/Alpha` }),
    );
    expect(onObjectSelect).not.toHaveBeenCalled();
  });

  it("opens at the current value", async () => {
    const { user } = renderSelector({ value: `${home}/Experiments` });
    await user.click(browse());
    expect(await findOption("Home", "Experiments")).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("titles the picker with browseTitle", async () => {
    const { user } = renderSelector({ browseTitle: "Select an Output Folder" });
    await user.click(browse());
    expect(
      await screen.findByRole("dialog", { name: "Select an Output Folder" }),
    ).toBeInTheDocument();
  });

  it("uses the filter as the picker's rule", async () => {
    const { user } = renderSelector({
      filter: (object) => object.name !== "Alpha",
    });
    await user.click(browse());
    await user.click(await findOption("Home", "Alpha"));
    expect(selectButton()).toBeDisabled();
    expect(
      screen.getByText("This folder can't be used here."),
    ).toBeInTheDocument();
  });

  it("has no Browse button with browse={false}", () => {
    renderSelector({ browse: false });
    expect(
      screen.queryByRole("button", { name: "Browse workspace folders" }),
    ).toBeNull();
  });

  it("disables the input, suggestions and Browse when disabled", () => {
    renderSelector({ disabled: true });
    expect(screen.getByRole("combobox")).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Show suggestions" }),
    ).toBeDisabled();
    expect(browse()).toBeDisabled();
  });

  it("disables Browse when signed out", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
    } as ReturnType<typeof useAuth>);
    renderSelector();
    expect(browse()).toBeDisabled();
  });
});

const browseFiles = () =>
  screen.getByRole("button", { name: "Browse workspace files" });
const files = makeFilePickerRepository;

describe("WorkspaceObjectSelector browse (files)", () => {
  it("chooses a file of the preset's type, immediately, like a clicked suggestion", async () => {
    const onObjectSelect = vi.fn();
    const { user } = renderSelector(
      { preset: "contigs", placeholder: "Select contigs", onObjectSelect },
      files(),
    );
    await user.click(browseFiles());
    expect(
      await screen.findByRole("dialog", { name: "Select a File" }),
    ).toBeInTheDocument();
    await user.dblClick(await findOption("Home", /draft\.fasta/));
    expect(onObjectSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        path: `${home}/draft.fasta`,
        type: "contigs",
        isDirectory: false,
      }),
    );
    expect(screen.getByPlaceholderText("Select contigs")).toHaveValue(
      "draft.fasta",
    );
  });

  it("stages the file for callers that add with their own button", async () => {
    const onSelectedObjectChange = vi.fn();
    const onObjectSelect = vi.fn();
    const { user } = renderSelector(
      {
        preset: "contigs",
        placeholder: "Optional",
        onSelectedObjectChange,
        onObjectSelect,
      },
      files(),
    );
    await user.click(browseFiles());
    await user.dblClick(await findOption("Home", /draft\.fasta/));
    expect(onSelectedObjectChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ path: `${home}/draft.fasta` }),
    );
    expect(onObjectSelect).not.toHaveBeenCalled();
    // Enter in the field then commits it, as it does after a clicked suggestion.
    await user.click(screen.getByPlaceholderText("Optional"));
    await user.keyboard("{Escape}{Enter}");
    expect(onObjectSelect).toHaveBeenCalledWith(
      expect.objectContaining({ path: `${home}/draft.fasta` }),
    );
  });

  it("keeps a browsed direct pick when Enter is pressed in the field", async () => {
    const onSelectedObjectChange = vi.fn();
    const { user } = renderSelector(
      { preset: "contigs", placeholder: "Contigs", onSelectedObjectChange },
      files(),
    );
    await user.click(browseFiles());
    await user.dblClick(await findOption("Home", /draft\.fasta/));
    await user.click(screen.getByPlaceholderText("Contigs"));
    await user.keyboard("{Escape}{Enter}");
    expect(onSelectedObjectChange).not.toHaveBeenLastCalledWith(null);
  });

  it("opens at the current file", async () => {
    const { user } = renderSelector(
      {
        preset: "contigs",
        value: `${home}/.Assembly1/Assembly1_contigs.fasta`,
      },
      files(),
    );
    await user.click(browseFiles());
    expect(
      await findOption("Assembly1", /Assembly1_contigs\.fasta/),
    ).toHaveAttribute("aria-selected", "true");
  });

  it("hands over the path the picker committed, not the row's own", async () => {
    const repository = files();
    // A row whose path carries a trailing slash is committed without it.
    repository.addItem(home, {
      name: "slashed.fasta",
      type: "contigs",
      path: `${home}/slashed.fasta/`,
    });
    const onObjectSelect = vi.fn();
    const { user } = renderSelector(
      { preset: "contigs", onObjectSelect },
      repository,
    );
    await user.click(browseFiles());
    await user.dblClick(await findOption("Home", /slashed\.fasta/));
    expect(onObjectSelect).toHaveBeenCalledWith(
      expect.objectContaining({ path: `${home}/slashed.fasta` }),
    );
  });

  it("accepts every type of a multi-type preset", async () => {
    const onObjectSelect = vi.fn();
    const { user } = renderSelector(
      { preset: "contigsOrReads", onObjectSelect },
      files(),
    );
    await user.click(browseFiles());
    expect(
      screen.getByText(/Accepts Contigs or Reads files\./),
    ).toBeInTheDocument();
    await user.dblClick(await findOption("Home", /reads\.fq/));
    expect(onObjectSelect).toHaveBeenCalledWith(
      expect.objectContaining({ type: "reads" }),
    );
  });

  it("picks groups, which are files too", async () => {
    const repository = files();
    repository.addItem(home, { name: "Genome Groups", type: "folder" });
    repository.addItem(`${home}/Genome Groups`, {
      name: "Flu",
      type: "genome_group",
    });
    const onObjectSelect = vi.fn();
    const { user } = renderSelector(
      { preset: "genomeGroup", onObjectSelect },
      repository,
    );
    await user.click(browseFiles());
    expect(
      await screen.findByRole("dialog", { name: "Select a Genome Group" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Accepts genome groups\./)).toBeInTheDocument();
    await user.click(await findOption("Home", "Genome Groups"));
    await user.dblClick(await findOption("Genome Groups", /Flu/));
    expect(onObjectSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        path: `${home}/Genome Groups/Flu`,
        type: "genome_group",
      }),
    );
  });

  it("titles a feature group picker by the group", async () => {
    const { user } = renderSelector({ preset: "featureGroup" }, files());
    await user.click(browseFiles());
    expect(
      await screen.findByRole("dialog", { name: "Select a Feature Group" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Accepts feature groups\./)).toBeInTheDocument();
  });

  it("lets browseTitle override a group picker's title", async () => {
    const { user } = renderSelector(
      { preset: "featureGroup", browseTitle: "Pick HA features" },
      files(),
    );
    await user.click(browseFiles());
    expect(
      await screen.findByRole("dialog", { name: "Pick HA features" }),
    ).toBeInTheDocument();
  });

  it("names its button after what it browses", () => {
    renderSelector(
      { preset: "reads", placeholder: "Select READ FILE..." },
      files(),
    );
    expect(browseFiles()).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Browse workspace folders" }),
    ).toBeNull();
  });
});
