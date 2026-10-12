import { render, screen } from "@testing-library/react";

import { AssemblyInputs } from "../assembly-sections";
import type { AssemblyUiState } from "../page";

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

const state: AssemblyUiState = {
  showAdvanced: false,
  genomeSizeUnit: "M",
  expectedGenomeSize: 5,
  pairedRead1: "/u@bvbrc/home/r1.fq",
  pairedRead2: null,
  singleRead: "/u@bvbrc/home/s.fq",
  isOutputNameValid: true,
  sraResetKey: 0,
};

describe("AssemblyInputs", () => {
  it("shows the reads held in page state", () => {
    render(
      <AssemblyInputs
        state={state}
        dispatch={vi.fn()}
        libraries={[]}
        setLibraries={vi.fn()}
        addPaired={vi.fn()}
        addSingle={vi.fn()}
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
