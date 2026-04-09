import { render, screen, fireEvent } from "@testing-library/react";
import { FallbackViewer } from "../fallback-viewer";

const mockTriggerDownload = vi.fn();

vi.mock("@/lib/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/utils")>();
  return {
    ...actual,
    triggerDownload: (...args: unknown[]) => mockTriggerDownload(...args),
  };
});

vi.mock("../../file-viewer-registry", () => ({
  getProxyUrl: vi.fn((path: string) => `/api/workspace/view/${path.replace(/^\//, "")}`),
}));

describe("FallbackViewer", () => {
  beforeEach(() => {
    mockTriggerDownload.mockClear();
  });

  it("renders the file type label", () => {
    render(
      <FallbackViewer fileName="data.xyz" fileType="custom_type" filePath="/user/data.xyz" />,
    );
    expect(screen.getByText("Type: custom_type")).toBeInTheDocument();
  });

  it("renders the no-viewer message", () => {
    render(
      <FallbackViewer fileName="data.xyz" fileType="custom" filePath="/user/data.xyz" />,
    );
    expect(screen.getByText("No viewer available for this file type")).toBeInTheDocument();
  });

  it("triggers download on button click", () => {
    render(
      <FallbackViewer fileName="data.xyz" fileType="custom" filePath="/user/data.xyz" />,
    );
    fireEvent.click(screen.getByText("Download"));
    expect(mockTriggerDownload).toHaveBeenCalledWith(
      "/api/workspace/view/user/data.xyz",
      "data.xyz",
    );
  });
});
