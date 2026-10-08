import { File as NodeFile } from "node:buffer";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { toast } from "sonner";
import { server } from "@/test-helpers/msw-server";
import { UploadDialog } from "@/components/workspace/upload-dialog";
import { WorkspaceRepositoryProvider } from "@/contexts/workspace-repository-context";
import { InMemoryWorkspaceRepository } from "@/lib/services/workspace/adapters/in-memory-workspace-repository";
import { workspaceQueryKeys } from "@/lib/services/workspace/workspace-query-keys";
import { createQueryClientWrapper } from "@/test-helpers/react";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const targetPath = "/alice@bvbrc/home";

function renderUploadDialog(
  repository = new InMemoryWorkspaceRepository(),
) {
  const QueryWrapper = createQueryClientWrapper();
  let listings = 0;
  // Stands in for the folder listing behind the dialog.
  function FolderListing() {
    useQuery({
      queryKey: workspaceQueryKeys.browser("alice@bvbrc", "home", ""),
      queryFn: () => {
        listings += 1;
        return [];
      },
    });
    return null;
  }
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryWrapper>
        <WorkspaceRepositoryProvider
          value={{ authenticated: repository, public: repository }}
        >
          <FolderListing />
          {children}
        </WorkspaceRepositoryProvider>
      </QueryWrapper>
    );
  }
  const onOpenChange = vi.fn<(open: boolean) => void>();
  const onUploadComplete = vi.fn();
  render(
    <UploadDialog
      open
      onOpenChange={onOpenChange}
      targetPath={targetPath}
      onUploadComplete={onUploadComplete}
    />,
    { wrapper: Wrapper },
  );
  return {
    repository,
    onOpenChange,
    onUploadComplete,
    listings: () => listings,
    user: userEvent.setup(),
  };
}

function chooseFiles(files: File[]) {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error("No file input");
  fireEvent.change(input, { target: { files } });
}

function chooseFile(name: string) {
  chooseFiles([new File(["ACGT"], name, { type: "text/plain" })]);
}

/**
 * Node's fetch cannot send jsdom's File or FormData, so a test that needs an
 * upload to succeed swaps in Node's own: its File, and its FormData, which
 * jsdom's global hides but Node's Request still builds.
 */
async function stubNodeFormData() {
  const form = await new Request("http://localhost", {
    method: "POST",
    body: new URLSearchParams(),
  }).formData();
  vi.stubGlobal("FormData", form.constructor);
}

function nodeFile(name: string) {
  return new NodeFile(["ACGT"], name, { type: "text/plain" }) as unknown as File;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("UploadDialog", () => {
  it("shows the target folder and waits for a file", () => {
    renderUploadDialog();

    expect(screen.getByRole("dialog", { name: "Upload" })).toBeInTheDocument();
    expect(screen.getByText(targetPath)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start Upload" })).toBeDisabled();
  });

  // jsdom's File cannot be serialized by Node's fetch, so with it the
  // multipart POST is out of reach; this covers everything up to it.
  // (`stubNodeFormData` gets past it for tests that need the POST.)
  it("starts the upload in the target folder", async () => {
    const { repository, user } = renderUploadDialog();

    chooseFile("reads.fq");
    expect(screen.getByText("reads.fq")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Start Upload" }));

    await waitFor(() => {
      expect(repository.calls).toContainEqual({
        method: "createUploadNode",
        input: {
          directoryPath: targetPath,
          filename: "reads.fq",
          type: "unspecified",
        },
      });
    });
  });

  it("removes the new entry when the file never reaches storage", async () => {
    // A network failure. (jsdom cannot serialize the File either, which
    // rejects the request the same way before it is sent.)
    server.use(
      http.post("*/api/services/workspace/upload", () => HttpResponse.error()),
    );
    const { repository, onUploadComplete, listings, user } =
      renderUploadDialog();

    chooseFile("reads.fq");
    await user.click(screen.getByRole("button", { name: "Start Upload" }));

    await waitFor(() => {
      expect(repository.calls).toContainEqual(
        expect.objectContaining({
          method: "delete",
          paths: [`${targetPath}/reads.fq`],
        }),
      );
    });
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
    expect(onUploadComplete).not.toHaveBeenCalled();
    // Nothing reached the folder, so its listing is not fetched again.
    await screen.findByRole("button", { name: "Start Upload" });
    expect(listings()).toBe(1);
  });

  it("refreshes the listing when a file fails after earlier ones uploaded", async () => {
    await stubNodeFormData();
    let uploads = 0;
    server.use(
      http.post("*/api/services/workspace/upload", () => {
        uploads += 1;
        return uploads === 1
          ? HttpResponse.json({})
          : HttpResponse.json({ error: "Shock is unavailable" }, { status: 503 });
      }),
    );
    const { repository, onUploadComplete, listings, user } =
      renderUploadDialog();
    await waitFor(() => {
      expect(listings()).toBe(1);
    });

    chooseFiles([nodeFile("first.fq"), nodeFile("second.fq")]);
    await user.click(screen.getByRole("button", { name: "Start Upload" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Upload failed: second.fq", {
        description: "Shock is unavailable",
      });
    });
    await waitFor(() => {
      expect(listings()).toBe(2);
    });
    expect(onUploadComplete).not.toHaveBeenCalled();
    expect(repository.calls).toContainEqual(
      expect.objectContaining({
        method: "delete",
        paths: [`${targetPath}/second.fq`],
      }),
    );
  });

  it("deletes nothing when the entry itself cannot be created", async () => {
    // e.g. a file of that name is already there: it must survive.
    const { repository, user } = renderUploadDialog(
      new InMemoryWorkspaceRepository({
        errors: { createUploadNode: new Error("Object already exists") },
      }),
    );

    chooseFile("reads.fq");
    await user.click(screen.getByRole("button", { name: "Start Upload" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Object already exists");
    });
    expect(repository.calls).not.toContainEqual(
      expect.objectContaining({ method: "delete" }),
    );
  });

  it("freezes the form while an upload runs", async () => {
    // The upload works through the files and type it started with, so
    // anything added or changed meanwhile would be silently left out.
    const repository = new InMemoryWorkspaceRepository();
    const held = Promise.withResolvers<undefined>();
    const createUploadNode = repository.createUploadNode.bind(repository);
    vi.spyOn(repository, "createUploadNode").mockImplementation(
      async (input) => {
        await held.promise;
        return createUploadNode(input);
      },
    );
    const { user } = renderUploadDialog(repository);
    chooseFile("reads.fq");

    await user.click(screen.getByRole("button", { name: "Start Upload" }));
    await screen.findByRole("button", { name: /Uploading/ });

    const dropzone = screen.getByRole("button", { name: /Select Files/ });
    const fileInput = document.querySelector('input[type="file"]');
    const openPicker = vi.spyOn(fileInput as HTMLInputElement, "click");
    expect(dropzone).toHaveAttribute("aria-disabled", "true");
    expect(dropzone).toHaveAttribute("tabindex", "-1");
    expect(fileInput).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Upload type" })).toBeDisabled();

    await user.click(dropzone);
    expect(openPicker).not.toHaveBeenCalled();
    fireEvent.drop(dropzone, {
      dataTransfer: { files: [new File(["ACGT"], "late.fq")] },
    });
    expect(screen.queryByText("late.fq")).not.toBeInTheDocument();

    held.resolve(undefined);
  });

  it("stays open until a running upload ends", async () => {
    // Closing would unmount the panel that tracks the upload, and a reopened
    // one could start a second upload alongside it.
    const repository = new InMemoryWorkspaceRepository({
      errors: { createUploadNode: new Error("Upload service unavailable") },
    });
    const held = Promise.withResolvers<undefined>();
    const createUploadNode = repository.createUploadNode.bind(repository);
    vi.spyOn(repository, "createUploadNode").mockImplementation(
      async (input) => {
        await held.promise;
        return createUploadNode(input);
      },
    );
    const { onOpenChange, user } = renderUploadDialog(repository);
    chooseFile("reads.fq");
    await user.click(screen.getByRole("button", { name: "Start Upload" }));
    await screen.findByRole("button", { name: /Uploading/ });

    // Whatever else is passed along, no call asks to close.
    const openRequests = () => onOpenChange.mock.calls.map(([open]) => open);
    await user.keyboard("{Escape}");

    expect(openRequests()).not.toContain(false);
    expect(screen.getByRole("dialog", { name: "Upload" })).toBeInTheDocument();

    held.resolve(undefined);
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Upload service unavailable");
    });
    await user.keyboard("{Escape}");
    expect(openRequests()).toContain(false);
  });

  it("closes from Cancel", async () => {
    const { onOpenChange, user } = renderUploadDialog();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
