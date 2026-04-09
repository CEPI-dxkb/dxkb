import { render, screen, fireEvent } from "@testing-library/react";
import { SvgViewer } from "../svg-viewer";

vi.mock("../../file-viewer-registry", () => ({
  getProxyUrl: vi.fn((path: string) => `/api/workspace/view/${path.replace(/^\//, "")}`),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button onClick={onClick} {...props}>{children}</button>
  ),
}));

vi.mock("../text-viewer", () => ({
  TextViewer: vi.fn(() => <div data-testid="text-viewer" />),
}));

vi.mock("../zoomable-image", () => ({
  ZoomableImage: vi.fn((props: Record<string, unknown>) => (
    <div data-testid="zoomable-image" data-src={props.src as string}>
      {props.toolbarLeading as React.ReactNode}
    </div>
  )),
}));

describe("SvgViewer", () => {
  it("defaults to image mode", () => {
    render(<SvgViewer filePath="/user/diagram.svg" fileName="diagram.svg" />);
    expect(screen.getByTestId("zoomable-image")).toBeInTheDocument();
    expect(screen.queryByTestId("text-viewer")).not.toBeInTheDocument();
  });

  it("switches to code mode when Code button is clicked", () => {
    render(<SvgViewer filePath="/user/diagram.svg" fileName="diagram.svg" />);
    fireEvent.click(screen.getByText("Code"));
    expect(screen.getByTestId("text-viewer")).toBeInTheDocument();
    expect(screen.queryByTestId("zoomable-image")).not.toBeInTheDocument();
  });

  it("switches back to image mode when Image button is clicked", () => {
    render(<SvgViewer filePath="/user/diagram.svg" fileName="diagram.svg" />);
    // Switch to code
    fireEvent.click(screen.getByText("Code"));
    expect(screen.getByTestId("text-viewer")).toBeInTheDocument();
    // Switch back to image
    fireEvent.click(screen.getByText("Image"));
    expect(screen.getByTestId("zoomable-image")).toBeInTheDocument();
  });

  it("passes proxy URL to ZoomableImage in image mode", () => {
    render(<SvgViewer filePath="/user/diagram.svg" fileName="diagram.svg" />);
    const image = screen.getByTestId("zoomable-image");
    expect(image).toHaveAttribute("data-src", "/api/workspace/view/user/diagram.svg");
  });
});
