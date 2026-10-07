import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UploadDialog } from "@/components/workspace/upload-dialog";
import { WorkspaceRepositoryProvider } from "@/contexts/workspace-repository-context";
import { InMemoryWorkspaceRepository } from "@/lib/services/workspace/adapters/in-memory-workspace-repository";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const targetPath = "/alice@bvbrc/home";

function renderUploadDialog() {
  const repository = new InMemoryWorkspaceRepository();
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <WorkspaceRepositoryProvider
        value={{ authenticated: repository, public: repository }}
      >
        {children}
      </WorkspaceRepositoryProvider>
    );
  }
  const onOpenChange = vi.fn();
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
  return { repository, onOpenChange, onUploadComplete, user: userEvent.setup() };
}

function chooseFile(name: string) {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error("No file input");
  fireEvent.change(input, {
    target: { files: [new File(["ACGT"], name, { type: "text/plain" })] },
  });
}

describe("UploadDialog", () => {
  it("shows the target folder and waits for a file", () => {
    renderUploadDialog();

    expect(screen.getByRole("dialog", { name: "Upload" })).toBeInTheDocument();
    expect(screen.getByText(targetPath)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start Upload" })).toBeDisabled();
  });

  // jsdom's File cannot be serialized by Node's fetch, so the multipart POST
  // itself is out of reach here; this covers everything up to it.
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

  it("closes from Cancel", async () => {
    const { onOpenChange, user } = renderUploadDialog();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
