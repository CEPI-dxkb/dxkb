import { render, screen, fireEvent } from "@testing-library/react";
import { WorkspaceItemHeader } from "../workspace-item-header";
import type { WorkspaceBrowserItem } from "@/types/workspace-browser";

const mockTriggerDownload = vi.fn();

vi.mock("@/lib/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/utils")>();
  return {
    ...actual,
    triggerDownload: (...args: unknown[]) => mockTriggerDownload(...args),
  };
});

vi.mock("@/components/workspace/file-viewer/file-viewer-registry", () => ({
  getProxyUrl: vi.fn((path: string) => `/api/workspace/view/${path.replace(/^\//, "")}`),
}));

vi.mock("@/lib/services/workspace/helpers", () => ({
  formatFileSize: vi.fn((bytes: number) => (bytes ? `${bytes} B` : "")),
}));

const makeItem = (overrides?: Partial<WorkspaceBrowserItem>): WorkspaceBrowserItem =>
  ({
    id: "id-1",
    path: "/user/home/data.fasta",
    name: "data.fasta",
    type: "contigs",
    size: 1024,
    creation_time: "2024-01-01",
    owner_id: "user@test.com",
    ...overrides,
  }) as WorkspaceBrowserItem;

describe("WorkspaceItemHeader", () => {
  beforeEach(() => {
    mockTriggerDownload.mockClear();
  });

  it("renders the file name", () => {
    render(<WorkspaceItemHeader item={makeItem()} />);
    expect(screen.getByText("data.fasta")).toBeInTheDocument();
  });

  it("renders the type badge", () => {
    render(<WorkspaceItemHeader item={makeItem()} />);
    expect(screen.getByText("contigs")).toBeInTheDocument();
  });

  it("renders formatted file size", () => {
    render(<WorkspaceItemHeader item={makeItem({ size: 2048 })} />);
    expect(screen.getByText("2048 B")).toBeInTheDocument();
  });

  it("does not render size when formatFileSize returns empty", () => {
    render(<WorkspaceItemHeader item={makeItem({ size: 0 })} />);
    expect(screen.queryByText("0 B")).not.toBeInTheDocument();
  });

  it("triggers download on download button click", () => {
    render(<WorkspaceItemHeader item={makeItem()} />);
    fireEvent.click(screen.getByTitle("Download file"));
    expect(mockTriggerDownload).toHaveBeenCalledWith(
      "/api/workspace/view/user/home/data.fasta",
      "data.fasta",
    );
  });

  it("renders close button when onClose is provided", () => {
    const onClose = vi.fn();
    render(<WorkspaceItemHeader item={makeItem()} onClose={onClose} />);
    fireEvent.click(screen.getByTitle("Close"));
    expect(onClose).toHaveBeenCalled();
  });

  it("does not render close button when onClose is not provided", () => {
    render(<WorkspaceItemHeader item={makeItem()} />);
    expect(screen.queryByTitle("Close")).not.toBeInTheDocument();
  });

  it("renders children", () => {
    render(
      <WorkspaceItemHeader item={makeItem()}>
        <span data-testid="custom-child">Custom</span>
      </WorkspaceItemHeader>,
    );
    expect(screen.getByTestId("custom-child")).toBeInTheDocument();
  });
});
