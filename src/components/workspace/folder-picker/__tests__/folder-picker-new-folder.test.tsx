import { act, screen, waitFor } from "@testing-library/react";
import {
  columnLabels,
  findOption,
  makePickerRepository,
  pickerHome as home,
  pickerUser,
  renderPicker,
  selectButton,
  stubPickerBrowserApis,
  type Gate,
  type PickerTestRepository,
} from "./fixtures/picker-harness";

vi.mock("@/lib/auth/provider", () => ({
  useAuth: () => ({ user: pickerUser }),
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

stubPickerBrowserApis();

function nameField() {
  return screen.queryByRole("textbox", { name: "New folder name" });
}

/** Opens the inline new-folder row, in Alpha unless `folder` is null (Home). */
async function startNewFolder(
  repository: PickerTestRepository = makePickerRepository(),
  folder: string | null = "Alpha",
) {
  const rendered = renderPicker({}, repository);
  const first = await findOption("Home", "Alpha");
  if (folder) await rendered.user.click(await findOption("Home", folder));
  else await waitFor(() => { expect(first).toHaveFocus(); });
  await rendered.user.click(
    screen.getByRole("button", { name: "New folder here" }),
  );
  const input = await screen.findByRole("textbox", { name: "New folder name" });
  await waitFor(() => {
    expect(input).toHaveFocus();
  });
  return { ...rendered, input };
}

/**
 * Let a held folder creation finish, then give what follows it (refetching
 * the listings it invalidated, then the picker's own update) a turn to run.
 * The in-memory backend answers within microtasks.
 */
async function finishCreation(repository: PickerTestRepository, gate: Gate) {
  gate.release();
  await waitFor(() => {
    expect(repository.calls).toContainEqual(
      expect.objectContaining({ method: "createFolder" }),
    );
  });
  await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
}

beforeEach(() => {
  localStorage.clear();
});

describe("WorkspaceFolderPickerDialog new folder", () => {
  it("creates the folder in the selected folder and selects it", async () => {
    const { user, repository } = await startNewFolder();

    await user.keyboard("Results{Enter}");

    await waitFor(() => {
      expect(selectButton()).toHaveAccessibleName("Select “Results”");
    });
    expect(repository.calls).toContainEqual({
      method: "createFolder",
      path: `${home}/Alpha/Results`,
    });
    expect(nameField()).not.toBeInTheDocument();
    expect(columnLabels()).toEqual(["Home", "Alpha", "Results"]);
    await waitFor(async () => {
      expect(await findOption("Alpha", "Results")).toHaveFocus();
    });
  });

  it("creates the folder in Home itself when no folder is selected", async () => {
    const { user, repository } = await startNewFolder(undefined, null);

    await user.keyboard("Results{Enter}");

    await waitFor(() => {
      expect(selectButton()).toHaveAccessibleName("Select “Results”");
    });
    expect(repository.calls).toContainEqual({
      method: "createFolder",
      path: `${home}/Results`,
    });
    expect(await findOption("Home", "Results")).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("trims the name before creating", async () => {
    const { user, repository } = await startNewFolder();

    await user.keyboard("  Results  {Enter}");

    await waitFor(() => {
      expect(repository.calls).toContainEqual({
        method: "createFolder",
        path: `${home}/Alpha/Results`,
      });
    });
  });

  it("cancels with Escape without closing the picker", async () => {
    const { user, onOpenChange, repository } = await startNewFolder();

    await user.keyboard("Draft{Escape}");

    expect(nameField()).not.toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(repository.calls).not.toContainEqual(
      expect.objectContaining({ method: "createFolder" }),
    );
    // Focus goes back to the columns, on the selection.
    await waitFor(async () => {
      expect(await findOption("Home", "Alpha")).toHaveFocus();
    });
  });

  it("checks the name before creating", async () => {
    const { user, repository } = await startNewFolder();

    await user.keyboard("a/b{Enter}");

    expect(
      screen.getByText("Folder name cannot contain a slash."),
    ).toBeInTheDocument();
    expect(nameField()).toHaveAttribute("aria-invalid", "true");
    expect(repository.calls).not.toContainEqual(
      expect.objectContaining({ method: "createFolder" }),
    );
  });

  it("flags an invalid name while it is typed", async () => {
    const { user, input } = await startNewFolder();
    expect(screen.getByText("Enter to create · Esc to cancel")).toBeVisible();
    expect(input).not.toHaveAttribute("aria-invalid");

    await user.keyboard("..");

    expect(input).toHaveAccessibleDescription(
      'Folder name cannot start with ".": hidden folders are not shown here.',
    );
    expect(input).toHaveAttribute("aria-invalid", "true");
  });

  it("refuses a hidden name, since the new folder could never be listed or chosen", async () => {
    const { user, input, repository } = await startNewFolder();

    await user.keyboard(".config{Enter}");

    expect(input).toHaveAccessibleDescription(
      'Folder name cannot start with ".": hidden folders are not shown here.',
    );
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveFocus();
    expect(repository.calls).not.toContainEqual(
      expect.objectContaining({ method: "createFolder" }),
    );
    expect(selectButton()).toHaveAccessibleName("Select “Alpha”");
  });

  it("asks for a name when Enter is pressed on an empty field", async () => {
    const { user, repository } = await startNewFolder();

    await user.keyboard("{Enter}");

    expect(screen.getByText("Enter a folder name.")).toBeInTheDocument();
    expect(repository.calls).not.toContainEqual(
      expect.objectContaining({ method: "createFolder" }),
    );
  });

  it("shows the backend's error message until the name is edited", async () => {
    const { user, input } = await startNewFolder(
      makePickerRepository({
        errors: { createFolder: new Error("Folder already exists") },
      }),
    );

    await user.keyboard("Results{Enter}");

    expect(
      await screen.findByText("Folder already exists"),
    ).toBeInTheDocument();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toBeEnabled();

    await user.keyboard("2");

    expect(screen.queryByText("Folder already exists")).not.toBeInTheDocument();
    expect(input).toHaveValue("Results2");
  });

  it("locks the field while the folder is created", async () => {
    const repository = makePickerRepository();
    const gate = repository.holdCreateFolder();
    const { user, input } = await startNewFolder(repository);

    await user.keyboard("Results{Enter}");

    expect(await screen.findByText("Creating…")).toBeInTheDocument();
    expect(input).toBeDisabled();
    expect(selectButton()).toHaveAccessibleName("Select “Alpha”");

    gate.release();

    await waitFor(() => {
      expect(selectButton()).toHaveAccessibleName("Select “Results”");
    });
    expect(
      repository.calls.filter((call) => call.method === "createFolder"),
    ).toHaveLength(1);
  });

  it("keeps the user's new selection if they moved on while it was created", async () => {
    const repository = makePickerRepository();
    const gate = repository.holdCreateFolder();
    const { user } = await startNewFolder(repository);

    await user.keyboard("Results{Enter}");
    await screen.findByText("Creating…");
    await user.click(await findOption("Home", "Experiments"));
    gate.release();

    await waitFor(() => {
      expect(repository.calls).toContainEqual({
        method: "createFolder",
        path: `${home}/Alpha/Results`,
      });
    });
    await findOption("Experiments", "Run1");
    expect(selectButton()).toHaveAccessibleName("Select “Experiments”");
    expect(columnLabels()).toEqual(["Home", "Experiments"]);
  });

  it("stays in the place the user switched to while Home's folder was created", async () => {
    const repository = makePickerRepository();
    const gate = repository.holdCreateFolder();
    const { user } = await startNewFolder(repository, null);

    await user.keyboard("Results{Enter}");
    await screen.findByText("Creating…");
    await user.click(screen.getByRole("button", { name: "Shared Workspaces" }));
    await findOption("Shared Workspaces", /shared-ws/);
    await finishCreation(repository, gate);

    expect(columnLabels()).toEqual(["Shared Workspaces"]);
    expect(selectButton()).toHaveAccessibleName("Select");
  });

  it("leaves a newer folder field open when an earlier creation finishes", async () => {
    const repository = makePickerRepository();
    const gate = repository.holdCreateFolder();
    const { user } = await startNewFolder(repository);

    await user.keyboard("Results{Enter}");
    await screen.findByText("Creating…");
    await user.click(await findOption("Home", "Experiments"));
    await user.click(screen.getByRole("button", { name: "New folder here" }));
    const input = await screen.findByRole("textbox", {
      name: "New folder name",
    });
    await user.keyboard("Draft");
    await finishCreation(repository, gate);

    expect(nameField()).toBe(input);
    expect(input).toHaveValue("Draft");
    expect(input).toHaveFocus();
    expect(selectButton()).toHaveAccessibleName("Select “Experiments”");
  });

  it("closes the field when another folder is selected", async () => {
    const { user } = await startNewFolder();

    await user.click(await findOption("Home", "Experiments"));

    expect(nameField()).not.toBeInTheDocument();
  });

  it("gives way to the upload form", async () => {
    const { user } = await startNewFolder();

    await user.click(screen.getByRole("button", { name: "Upload here" }));

    expect(nameField()).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Back to folder info" }),
    ).toBeInTheDocument();
  });

  it("is not offered where the user cannot write", async () => {
    const { user } = renderPicker();
    await findOption("Home", "Alpha");
    await user.click(screen.getByRole("button", { name: "Public Workspaces" }));

    await user.click(await findOption("Public Workspaces", /public-ws/));

    expect(
      screen.getByRole("button", { name: "New folder here" }),
    ).toBeDisabled();
  });

  it("is not offered in a listing with nothing selected", async () => {
    const { user } = renderPicker();
    await findOption("Home", "Alpha");

    await user.click(screen.getByRole("button", { name: "My Workspaces" }));
    await findOption("My Workspaces", "projects");

    expect(
      screen.queryByRole("button", { name: "New folder here" }),
    ).not.toBeInTheDocument();
  });
});
