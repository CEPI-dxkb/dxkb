import { screen, waitFor } from "@testing-library/react";
import type { PickerTarget } from "@/lib/services/workspace/picker-views";
import {
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
// jsdom can't send the multipart request (see `folder-picker-upload.test.tsx`),
// so this panel calls `onUploadComplete` the way the real one does once the
// files are in. `vi.mock` is hoisted above the imports, so the paths are
// literals rather than built from `home`.
vi.mock("@/components/workspace/upload-panel", () => ({
  WorkspaceUploadPanel: ({
    initialUploadType,
    onUploadComplete,
  }: {
    initialUploadType?: string;
    onUploadComplete: (uploaded: { path: string; type: string }[]) => void;
  }) => (
    <>
      <p>Upload type: {initialUploadType ?? "unspecified"}</p>
      <button
        type="button"
        onClick={() => {
          onUploadComplete([
            { path: "/alice@bvbrc/home/Alpha/new.fasta", type: "contigs" },
          ]);
        }}
      >
        Finish contigs upload
      </button>
      <button
        type="button"
        onClick={() => {
          onUploadComplete([
            { path: "/alice@bvbrc/home/Alpha/new.txt", type: "txt" },
          ]);
        }}
      >
        Finish text upload
      </button>
    </>
  ),
}));
stubPickerBrowserApis();

const contigs = { kind: "object", types: ["contigs"] } as const;

/** Opens the upload form for Alpha, picking a folder or, with `target`, a file. */
async function openUpload(target?: PickerTarget) {
  const repository = makeFilePickerRepository();
  const picker = renderPicker({ target }, repository);
  await picker.user.click(await findOption("Home", "Alpha"));
  await picker.user.click(screen.getByRole("button", { name: "Upload here" }));
  return picker;
}

async function uploadInto(
  name: "new.fasta" | "new.txt",
  type: string,
  button: string,
) {
  const picker = await openUpload(contigs);
  expect(screen.getByText("Upload type: contigs")).toBeInTheDocument();
  // The file appears in the listing only from the next fetch, as after a real upload.
  picker.repository.addItem(`${home}/Alpha`, { name, type });
  await picker.user.click(screen.getByRole("button", { name: button }));
  return picker;
}

it("selects the file it just uploaded when it matches", async () => {
  await uploadInto("new.fasta", "contigs", "Finish contigs upload");
  await waitFor(() => {
    expect(selectButton()).toHaveAccessibleName("Select “new.fasta”");
  });
  expect(await findOption("Alpha", /new\.fasta/)).toHaveFocus();
});

it("leaves the selection on the folder when the upload doesn't match", async () => {
  await uploadInto("new.txt", "txt", "Finish text upload");
  await waitFor(() => {
    expect(
      screen.getByRole("button", { name: "Upload here" }),
    ).toBeInTheDocument();
  });
  expect(selectButton()).toHaveAccessibleName("Select “Alpha”");
});

// The panel keeps its files after an upload, so a form still open while the
// listings refresh would offer the same upload again.
describe("while the listings refresh after an upload", () => {
  it("has already closed the form when picking a folder", async () => {
    const { repository, user } = await openUpload();
    const refresh = repository.holdListing(`${home}/Alpha`);
    await user.click(
      screen.getByRole("button", { name: "Finish text upload" }),
    );
    expect(
      screen.queryByRole("button", { name: "Finish text upload" }),
    ).toBeNull();
    expect(screen.getByRole("button", { name: "Upload here" })).toBeEnabled();
    refresh.release();
  });

  it("has already closed the form when picking a file, and selects the file once it is listed", async () => {
    const { repository, user } = await openUpload(contigs);
    repository.addItem(`${home}/Alpha`, { name: "new.fasta", type: "contigs" });
    const refresh = repository.holdListing(`${home}/Alpha`);
    await user.click(
      screen.getByRole("button", { name: "Finish contigs upload" }),
    );
    expect(
      screen.queryByRole("button", { name: "Finish contigs upload" }),
    ).toBeNull();
    expect(selectButton()).toHaveAccessibleName("Select “Alpha”");
    refresh.release();
    await waitFor(() => {
      expect(selectButton()).toHaveAccessibleName("Select “new.fasta”");
    });
  });

  it("leaves the selection alone once the user has moved on", async () => {
    const { repository, user } = await openUpload(contigs);
    repository.addItem(`${home}/Alpha`, { name: "new.fasta", type: "contigs" });
    const refresh = repository.holdListing(`${home}/Alpha`);
    await user.click(
      screen.getByRole("button", { name: "Finish contigs upload" }),
    );
    await user.click(await findOption("Home", "Experiments"));
    await user.click(await findOption("Home", "Alpha"));
    refresh.release();
    // Listed only by the refresh, so the refresh is over.
    await findOption("Alpha", /new\.fasta/);
    expect(selectButton()).toHaveAccessibleName("Select “Alpha”");
  });
});
