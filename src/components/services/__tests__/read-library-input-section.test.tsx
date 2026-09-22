import { fireEvent, render, screen } from "@testing-library/react";
import { ReadLibraryInputSection } from "@/components/services/read-library-input-section";

vi.mock("@/components/workspace/workspace-object-selector", () => ({
  WorkspaceObjectSelector: ({
    placeholder,
    onObjectSelect,
  }: {
    placeholder: string;
    onObjectSelect: (object: { path: string }) => void;
  }) => (
    <button
      type="button"
      onClick={() => {
        onObjectSelect({ path: `/${placeholder}` });
      }}
    >
      {placeholder}
    </button>
  ),
}));

const callbacks = {
  onPairedRead1Change: vi.fn(),
  onPairedRead2Change: vi.fn(),
  onSingleReadChange: vi.fn(),
  onAddPairedLibrary: vi.fn(),
  onAddSingleLibrary: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ReadLibraryInputSection", () => {
  it("preserves add-button enablement and callbacks", () => {
    const { rerender } = render(
      <ReadLibraryInputSection
        pairedRead1={null}
        pairedRead2={null}
        singleRead={null}
        {...callbacks}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Add paired read library" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Add single read library" }),
    ).toBeDisabled();

    rerender(
      <ReadLibraryInputSection
        pairedRead1="/read-1.fastq"
        pairedRead2="/read-2.fastq"
        singleRead="/single.fastq"
        {...callbacks}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Add paired read library" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Add single read library" }),
    );

    expect(callbacks.onAddPairedLibrary).toHaveBeenCalledOnce();
    expect(callbacks.onAddSingleLibrary).toHaveBeenCalledOnce();
  });

  it("forwards selected workspace paths to the owning controller", () => {
    render(
      <ReadLibraryInputSection
        pairedRead1={null}
        pairedRead2={null}
        singleRead={null}
        {...callbacks}
      />,
    );

    fireEvent.click(screen.getByText("Select READ FILE 1..."));
    fireEvent.click(screen.getByText("Select READ FILE 2..."));
    fireEvent.click(screen.getByText("Select READ FILE..."));

    expect(callbacks.onPairedRead1Change).toHaveBeenCalledWith(
      "/Select READ FILE 1...",
    );
    expect(callbacks.onPairedRead2Change).toHaveBeenCalledWith(
      "/Select READ FILE 2...",
    );
    expect(callbacks.onSingleReadChange).toHaveBeenCalledWith(
      "/Select READ FILE...",
    );
  });
});
