import { render, screen } from "@testing-library/react";
import { IframeViewer } from "../iframe-viewer";

vi.mock("../../file-viewer-registry", () => ({
  getProxyUrl: vi.fn((path: string) => `/api/workspace/view/${path.replace(/^\//, "")}`),
}));

describe("IframeViewer", () => {
  it("renders an iframe with the proxy URL", () => {
    render(<IframeViewer filePath="/user/home/doc.pdf" />);
    const iframe = screen.getByTitle("doc.pdf");
    expect(iframe).toBeInTheDocument();
    expect(iframe).toHaveAttribute(
      "src",
      "/api/workspace/view/user/home/doc.pdf",
    );
  });

  it("sets sandbox to allow-same-origin by default", () => {
    render(<IframeViewer filePath="/user/home/model.pdb" />);
    const iframe = screen.getByTitle("model.pdb");
    expect(iframe).toHaveAttribute("sandbox", "allow-same-origin");
  });

  it("sets sandbox to allow-scripts (without allow-same-origin) when allowScripts is true", () => {
    render(<IframeViewer filePath="/user/home/page.html" allowScripts />);
    const iframe = screen.getByTitle("page.html");
    expect(iframe).toHaveAttribute("sandbox", "allow-scripts");
  });

  it("omits sandbox entirely for PDF files so Chrome's built-in viewer can render", () => {
    render(<IframeViewer filePath="/user/home/doc.pdf" allowScripts />);
    const iframe = screen.getByTitle("doc.pdf");
    expect(iframe).not.toHaveAttribute("sandbox");
  });

  it("extracts filename from path for title", () => {
    render(<IframeViewer filePath="/user/home/deep/nested/report.html" />);
    expect(screen.getByTitle("report.html")).toBeInTheDocument();
  });

  it("uses full path as fallback title when no segments", () => {
    render(<IframeViewer filePath="" />);
    const iframe = document.querySelector("iframe");
    expect(iframe).toHaveAttribute("title", "");
  });
});
