import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { toast } from "sonner";
import {
  breadcrumb,
  findOption,
  makePickerRepository,
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

function chooseFile(name: string) {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error("No file input");
  fireEvent.change(input, {
    target: { files: [new File(["ACGT"], name, { type: "text/plain" })] },
  });
}

/** The width the info pane is laid out at, from its CSS custom property. */
function infoPaneWidth() {
  const pane = screen.getByRole("separator", {
    name: "Resize info pane",
  }).parentElement;
  return pane?.style.getPropertyValue("--picker-preview-width");
}

async function openUpload(folder = "Alpha", repository = makePickerRepository()) {
  const rendered = renderPicker({}, repository);
  await rendered.user.click(await findOption("Home", folder));
  await rendered.user.click(screen.getByRole("button", { name: "Upload here" }));
  return rendered;
}

beforeEach(() => {
  localStorage.clear();
});

describe("WorkspaceFolderPickerDialog upload pane", () => {
  it("swaps the info pane for the upload form and back", async () => {
    const { user } = await openUpload();

    expect(screen.getByText("Upload to “Alpha”")).toBeInTheDocument();
    expect(screen.getByText(`${home}/Alpha`)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start Upload" })).toBeDisabled();
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Back to folder info" }),
      ).toHaveFocus();
    });

    await user.click(
      screen.getByRole("button", { name: "Back to folder info" }),
    );
    expect(
      screen.getByRole("button", { name: "Upload here" }),
    ).toBeInTheDocument();
    // Focus returns to the columns.
    await waitFor(async () => {
      expect(await findOption("Home", "Alpha")).toHaveFocus();
    });
  });

  it("goes back from the form's own Back button", async () => {
    const { user } = await openUpload();

    await user.click(screen.getByRole("button", { name: "Back" }));

    expect(
      screen.getByRole("button", { name: "Upload here" }),
    ).toBeInTheDocument();
  });

  it("uploads into Home when Home is selected", async () => {
    const { user } = renderPicker();
    await findOption("Home", "Alpha");

    await user.click(screen.getByRole("button", { name: "Upload here" }));

    expect(screen.getByText("Upload to “Home”")).toBeInTheDocument();
    expect(screen.getByText(home, { selector: "p" })).toBeInTheDocument();
  });

  it("closes when another folder is selected", async () => {
    const { user } = await openUpload();

    await user.click(await findOption("Home", "Experiments"));

    expect(screen.queryByText("Upload to “Alpha”")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upload here" })).toBeVisible();
  });

  it("widens the info pane to fit the form while it is open", async () => {
    const { user } = await openUpload();

    expect(infoPaneWidth()).toBe("384px");
    // The pane's own width is untouched, so it comes back afterwards.
    expect(
      screen.getByRole("separator", { name: "Resize info pane" }),
    ).toHaveAttribute("aria-valuenow", "320");

    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(infoPaneWidth()).toBe("320px");
  });

  it("keeps an info pane already wider than the form", async () => {
    const { user } = renderPicker();
    await user.click(await findOption("Home", "Alpha"));
    screen.getByRole("separator", { name: "Resize info pane" }).focus();
    await user.keyboard("{ArrowLeft}{ArrowLeft}{ArrowLeft}{ArrowLeft}{ArrowLeft}");

    await user.click(screen.getByRole("button", { name: "Upload here" }));

    expect(infoPaneWidth()).toBe("400px");
  });

  it("starts the upload in the selected folder", async () => {
    const { user, repository } = await openUpload();

    chooseFile("reads.fq");
    await user.click(screen.getByRole("button", { name: "Start Upload" }));

    await waitFor(() => {
      expect(repository.calls).toContainEqual({
        method: "createUploadNode",
        input: {
          directoryPath: `${home}/Alpha`,
          filename: "reads.fq",
          type: "unspecified",
        },
      });
    });
  });

  it("locks the picker while an upload runs, and unlocks it when it fails", async () => {
    const repository = makePickerRepository();
    const gate = repository.holdUpload();
    const { user, onOpenChange } = await openUpload("Alpha", repository);
    chooseFile("reads.fq");

    await user.click(screen.getByRole("button", { name: "Start Upload" }));

    expect(
      await screen.findByRole("button", { name: /Uploading/ }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Close" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(selectButton()).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Back to folder info" }),
    ).toBeDisabled();
    expect(screen.getByRole("navigation", { name: "Places" })).toHaveAttribute(
      "inert",
    );
    for (const crumb of within(breadcrumb()).getAllByRole("button")) {
      expect(crumb).toBeDisabled();
    }
    for (const folderColumn of document.querySelectorAll(
      "[data-picker-column]",
    )) {
      expect(folderColumn).toHaveAttribute("inert");
    }

    await user.keyboard("{Escape}");
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    gate.fail(new Error("Upload service unavailable"));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Close" })).toBeEnabled();
    });
    expect(toast.error).toHaveBeenCalledWith("Upload service unavailable");
    expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
    expect(screen.getByRole("navigation", { name: "Places" })).not.toHaveAttribute(
      "inert",
    );
    expect(selectButton()).toBeEnabled();
  });
});
