import { screen, waitFor, within } from "@testing-library/react";
import {
  breadcrumbLabels,
  columnLabels,
  findOption,
  makeFilePickerRepository,
  pickerHome as home,
  pickerUser,
  renderPicker,
  selectButton,
  stubPickerBrowserApis,
} from "./fixtures/picker-harness";

vi.mock("@/lib/auth/provider", () => ({
  useAuth: () => ({ user: pickerUser }),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
stubPickerBrowserApis();

const contigs = { kind: "object", types: ["contigs"] } as const;
const pickContigs = (
  overrides: Parameters<typeof renderPicker>[0] = {},
  repository = makeFilePickerRepository(),
) =>
  renderPicker(
    { target: contigs, title: "Select a File", ...overrides },
    repository,
  );

describe("picking a file", () => {
  it("lists folders, job results and matching files only", async () => {
    pickContigs();
    const homeColumn = await screen.findByRole("listbox", { name: "Home" });
    expect(
      within(homeColumn)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(
      expect.arrayContaining([
        "Alpha",
        "Assembly1",
        "Experiments",
        // A file's row also shows its size.
        "draft.fasta4.0 KB",
      ]),
    );
    expect(
      within(homeColumn).queryByRole("option", { name: /notes\.txt/ }),
    ).toBeNull();
    expect(
      within(homeColumn).queryByRole("option", { name: /reads\.fq/ }),
    ).toBeNull();
  });

  it("tells which files it accepts", () => {
    pickContigs();
    expect(screen.getByText(/Accepts Contigs files\./)).toBeInTheDocument();
  });

  it("selects a file without opening a column, and commits it with its row", async () => {
    const { user, onSelect } = pickContigs();
    await user.click(await findOption("Home", /draft\.fasta/));
    expect(columnLabels()).toEqual(["Home"]);
    expect(selectButton()).toHaveAccessibleName("Select “draft.fasta”");
    expect(breadcrumbLabels()).toEqual(["Home", "draft.fasta"]);
    await user.click(selectButton());
    expect(onSelect).toHaveBeenCalledWith(
      `${home}/draft.fasta`,
      expect.objectContaining({ type: "contigs", name: "draft.fasta" }),
    );
  });

  it("opens a job result through its hidden folder, named without the dot", async () => {
    const { user, onSelect } = pickContigs();
    await user.click(await findOption("Home", "Assembly1"));
    expect(columnLabels()).toEqual(["Home", "Assembly1"]);
    await user.dblClick(await findOption("Assembly1", /Assembly1_contigs\.fasta/));
    expect(onSelect).toHaveBeenCalledWith(
      `${home}/.Assembly1/Assembly1_contigs.fasta`,
      expect.objectContaining({ type: "contigs" }),
    );
  });

  it("opens a hidden output folder inside a job result", async () => {
    // A Comprehensive Genome Analysis keeps its annotation in `.annotation`.
    const repository = makeFilePickerRepository();
    repository.addItem(`${home}/.Assembly1`, {
      name: ".annotation",
      type: "folder",
    });
    repository.addItem(`${home}/.Assembly1/.annotation`, {
      name: "annotation.contigs.fasta",
      type: "contigs",
    });
    const { user, onSelect } = pickContigs({}, repository);
    await user.click(await findOption("Home", "Assembly1"));
    await user.click(await findOption("Assembly1", ".annotation"));
    expect(columnLabels()).toEqual(["Home", "Assembly1", "annotation"]);
    await user.dblClick(
      await findOption("annotation", /annotation\.contigs\.fasta/),
    );
    expect(onSelect).toHaveBeenCalledWith(
      `${home}/.Assembly1/.annotation/annotation.contigs.fasta`,
      expect.objectContaining({ type: "contigs" }),
    );
  });

  it("won't commit a folder, and says what to pick", async () => {
    const { user, onSelect } = pickContigs();
    await user.click(await findOption("Home", "Alpha"));
    expect(selectButton()).toBeDisabled();
    expect(screen.getByText("Pick a file: Contigs.")).toBeInTheDocument();
    await user.dblClick(await findOption("Home", "Alpha"));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("opens at the current file, inside a job result", async () => {
    pickContigs({ initialPath: `${home}/.Assembly1/Assembly1_contigs.fasta` });
    expect(
      await findOption("Assembly1", /Assembly1_contigs\.fasta/),
    ).toHaveAttribute("aria-selected", "true");
    expect(await findOption("Home", "Assembly1")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(breadcrumbLabels()).toEqual([
      "Home",
      "Assembly1",
      "Assembly1_contigs.fasta",
    ]);
  });

  it("describes, and uploads to, the current file's folder until the file is listed", async () => {
    const repository = makeFilePickerRepository();
    const listing = repository.holdListing(home);
    const { user } = pickContigs(
      { initialPath: `${home}/draft.fasta` },
      repository,
    );
    // The info pane is Home's, not the file's as though it were a folder.
    expect(screen.getByText(home, { selector: "p" })).toBeInTheDocument();
    expect(screen.queryByText(`${home}/draft.fasta`)).toBeNull();
    await user.click(screen.getByRole("button", { name: "Upload here" }));
    expect(screen.getByText("Upload to “Home”")).toBeInTheDocument();
    expect(screen.getByText(home, { selector: "p" })).toBeInTheDocument();
    listing.release();
  });

  it("names a job result's hidden folder without its dot in the upload header", async () => {
    const { user } = pickContigs();
    await user.click(await findOption("Home", "Assembly1"));
    await user.click(screen.getByRole("button", { name: "Upload here" }));
    expect(screen.getByText("Upload to “Assembly1”")).toBeInTheDocument();
    expect(screen.queryByText(/Upload to “\./)).toBeNull();
  });

  it("drops a current file that is gone, keeping its folder", async () => {
    pickContigs({ initialPath: `${home}/gone.fasta` });
    await waitFor(() => {
      expect(breadcrumbLabels()).toEqual(["Home"]);
    });
    expect(selectButton()).toBeDisabled();
  });

  it("Show other files reveals the rest, which stay unchoosable", async () => {
    const { user } = pickContigs();
    await user.click(screen.getByRole("button", { name: "Show other files" }));
    const notes = await findOption("Home", /notes\.txt/);
    expect(notes).toHaveAttribute("aria-disabled", "true");
    await user.click(notes);
    expect(selectButton()).not.toHaveAccessibleName("Select “notes.txt”");
  });

  it("hides a job's other outputs behind Show 1 other file", async () => {
    const { user } = pickContigs();
    await user.click(await findOption("Home", "Assembly1"));
    // The job folder holds 1 contigs file and 1 html report.
    const job = await screen.findByRole("listbox", { name: "Assembly1" });
    expect(within(job).getAllByRole("option")).toHaveLength(1);
    expect(screen.queryByRole("option", { name: /report\.html/ })).toBeNull();
  });

  it("offers the other files when a folder has no matches", async () => {
    const repository = makeFilePickerRepository();
    repository.addItem(`${home}/Alpha`, { name: "notes.md", type: "txt" });
    const { user } = pickContigs({}, repository);
    await user.click(await findOption("Home", "Alpha"));
    expect(await screen.findByText("No matching files here.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Show 1 other file" }));
    expect(await findOption("Alpha", /notes\.md/)).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("browses public data and commits a read-only file", async () => {
    const { user, onSelect } = pickContigs();
    await user.click(
      within(screen.getByRole("navigation", { name: "Places" })).getByRole(
        "button",
        { name: "Public Workspaces" },
      ),
    );
    await user.click(await findOption("Public Workspaces", /public-ws/));
    await user.click(await findOption("public-ws", "data"));
    await user.dblClick(await findOption("data", /lab\.fasta/));
    expect(onSelect).toHaveBeenCalledWith(
      "/carol@bvbrc/public-ws/data/lab.fasta",
      expect.anything(),
    );
  });

  it("shows a file's details in the info pane", async () => {
    const { user } = pickContigs();
    await user.click(await findOption("Home", /draft\.fasta/));
    const info = screen.getByText("Type", { selector: "dt" }).closest("dl");
    expect(info).not.toBeNull();
    const details = within(info ?? document.body);
    expect(details.getByText("Contigs")).toBeInTheDocument();
    expect(details.getByText("4.0 KB")).toBeInTheDocument();
    expect(screen.getByText("You can use this file here.")).toBeInTheDocument();
  });

  it("offers no New folder when picking files, but still Upload", async () => {
    const { user } = pickContigs();
    await user.click(await findOption("Home", "Alpha"));
    expect(screen.queryByRole("button", { name: "New folder here" })).toBeNull();
    expect(screen.getByRole("button", { name: "Upload here" })).toBeEnabled();
  });

  it("defaults the upload type to the requested type", async () => {
    const { user } = pickContigs();
    await user.click(await findOption("Home", "Alpha"));
    await user.click(screen.getByRole("button", { name: "Upload here" }));
    // The real panel; its Select trigger shows the chosen type's label.
    expect(
      screen.getByRole("combobox", { name: "Upload type" }),
    ).toHaveTextContent("Contigs");
  });

  describe("keyboard", () => {
    it("Enter on a folder opens it; Enter on a file commits it", async () => {
      const { user, onSelect } = pickContigs();
      const alpha = await findOption("Home", "Alpha");
      alpha.focus();
      await user.keyboard("{Enter}");
      expect(onSelect).not.toHaveBeenCalled();
      expect(columnLabels()).toEqual(["Home", "Alpha"]);
      (await findOption("Home", /draft\.fasta/)).focus();
      await user.keyboard("{Enter}");
      expect(onSelect).toHaveBeenCalledWith(
        `${home}/draft.fasta`,
        expect.anything(),
      );
    });

    it("arrows move over folders and matching files; → on a file does nothing", async () => {
      const { user } = pickContigs();
      // Clicking selects and focuses, so the next arrow moves on rather than
      // selecting the focused row first.
      const draft = await findOption("Home", /draft\.fasta/);
      await user.click(draft);
      await user.keyboard("{ArrowRight}");
      expect(draft).toHaveFocus();
      expect(columnLabels()).toEqual(["Home"]);
      // Home in file mode: Alpha, Assembly1, Experiments, draft.fasta.
      await user.keyboard("{ArrowUp}");
      expect(await findOption("Home", "Experiments")).toHaveFocus();
      await user.keyboard("{End}");
      expect(draft).toHaveFocus();
    });

    it("→ on a folder goes to its selected file rather than the first", async () => {
      const repository = makeFilePickerRepository();
      repository.addItem(`${home}/.Assembly1`, {
        name: "Assembly1_scaffolds.fasta",
        type: "contigs",
      });
      const { user } = pickContigs({}, repository);
      await user.click(await findOption("Home", "Assembly1"));
      await user.click(
        await findOption("Assembly1", /Assembly1_scaffolds\.fasta/),
      );
      (await findOption("Home", "Assembly1")).focus();
      await user.keyboard("{ArrowRight}");
      expect(
        await findOption("Assembly1", /Assembly1_scaffolds\.fasta/),
      ).toHaveFocus();
      expect(selectButton()).toHaveAccessibleName(
        "Select “Assembly1_scaffolds.fasta”",
      );
    });

    it("← from a file goes back to its folder's row", async () => {
      const { user } = pickContigs();
      await user.click(await findOption("Home", "Assembly1"));
      const file = await findOption("Assembly1", /Assembly1_contigs\.fasta/);
      await user.click(file);
      await user.keyboard("{ArrowLeft}");
      expect(await findOption("Home", "Assembly1")).toHaveFocus();
      expect(breadcrumbLabels()).toEqual(["Home", "Assembly1"]);
    });
  });

  it("jumping to a crumb clears the file", async () => {
    const { user } = pickContigs();
    await user.click(await findOption("Home", "Assembly1"));
    await user.click(await findOption("Assembly1", /Assembly1_contigs\.fasta/));
    // The file's own folder: the chain stays, so only the jump clears the file.
    await user.click(
      within(screen.getByRole("navigation", { name: "Selected file" })).getByRole(
        "button",
        { name: "Assembly1" },
      ),
    );
    expect(breadcrumbLabels()).toEqual(["Home", "Assembly1"]);
    expect(selectButton()).toHaveAccessibleName("Select “Assembly1”");
  });

  it("keeps folder mode exactly as before", async () => {
    renderPicker();
    expect(await findOption("Home", "Alpha")).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /draft\.fasta/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Show files" })).toBeInTheDocument();
  });
});
