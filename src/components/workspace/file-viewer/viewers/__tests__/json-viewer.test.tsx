import { render } from "@testing-library/react";
import { JsonViewer } from "../json-viewer";

vi.mock("../codemirror-viewer", () => ({
  CodeMirrorViewer: vi.fn((props: Record<string, unknown>) => (
    <div
      data-testid="codemirror-viewer"
      data-file-path={props.filePath}
      data-file-name={props.fileName}
      data-foldable={String(props.foldable)}
      data-start-folded={String(props.startFolded)}
    />
  )),
}));

vi.mock("../../file-viewer-registry", () => ({
  previewMaxBytes: 1000,
}));

describe("JsonViewer", () => {
  it("passes filePath and fileName to CodeMirrorViewer", () => {
    const { getByTestId } = render(
      <JsonViewer filePath="/user/data.json" fileName="data.json" />,
    );
    const viewer = getByTestId("codemirror-viewer");
    expect(viewer).toHaveAttribute("data-file-path", "/user/data.json");
    expect(viewer).toHaveAttribute("data-file-name", "data.json");
  });

  it("sets foldable to true", () => {
    const { getByTestId } = render(
      <JsonViewer filePath="/user/data.json" fileName="data.json" />,
    );
    expect(getByTestId("codemirror-viewer")).toHaveAttribute("data-foldable", "true");
  });

  it("sets startFolded to true for large files", () => {
    const { getByTestId } = render(
      <JsonViewer filePath="/user/big.json" fileName="big.json" fileSize={5000} />,
    );
    expect(getByTestId("codemirror-viewer")).toHaveAttribute("data-start-folded", "true");
  });

  it("sets startFolded to false for small files", () => {
    const { getByTestId } = render(
      <JsonViewer filePath="/user/small.json" fileName="small.json" fileSize={100} />,
    );
    expect(getByTestId("codemirror-viewer")).toHaveAttribute("data-start-folded", "false");
  });

  it("sets startFolded to false when fileSize is undefined", () => {
    const { getByTestId } = render(
      <JsonViewer filePath="/user/data.json" fileName="data.json" />,
    );
    expect(getByTestId("codemirror-viewer")).toHaveAttribute("data-start-folded", "false");
  });
});
