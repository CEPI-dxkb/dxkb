import { render, screen } from "@testing-library/react";

import { LibraryInputSection } from "../library-input-section";
import type { VariationAnalysisController } from "../use-variation-analysis-form";

vi.mock("@/components/workspace/workspace-object-selector", () => ({
  WorkspaceObjectSelector: ({
    placeholder,
    value,
  }: {
    placeholder?: string;
    value?: string;
  }) => (
    <output aria-label={placeholder}>
      {value === undefined ? "<no value prop>" : value}
    </output>
  ),
}));

vi.mock("@/components/services/sra-run-accession-with-validation", () => ({
  default: () => null,
}));

function controllerWith(
  reads: Pick<
    VariationAnalysisController,
    "pairedRead1" | "pairedRead2" | "singleRead"
  >,
): VariationAnalysisController {
  return {
    ...reads,
    sraResetKey: 0,
    selectedLibraries: [],
    setLibraries: vi.fn(),
    setPairedRead1: vi.fn(),
    setPairedRead2: vi.fn(),
    setSingleRead: vi.fn(),
    handlePairedLibraryAdd: vi.fn(),
    handleSingleLibraryAdd: vi.fn(),
  } as unknown as VariationAnalysisController;
}

describe("LibraryInputSection", () => {
  it("shows the reads held in page state", () => {
    render(
      <LibraryInputSection
        controller={controllerWith({
          pairedRead1: "/u@bvbrc/home/r1.fq",
          pairedRead2: null,
          singleRead: "/u@bvbrc/home/s.fq",
        })}
      />,
    );
    expect(screen.getByLabelText("Select READ FILE 1...")).toHaveTextContent(
      "/u@bvbrc/home/r1.fq",
    );
    expect(screen.getByLabelText("Select READ FILE 2...")).toHaveTextContent(
      /^$/,
    );
    expect(screen.getByLabelText("Select READ FILE...")).toHaveTextContent(
      "/u@bvbrc/home/s.fq",
    );
  });
});
