import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createQueryClientWrapper } from "@/test-helpers/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";

import MSAandSNPAnalysisPage from "../page";

// A non-Strict render on purpose: dev Strict Mode's extra unmount-and-remount
// of a newly shown field clears the stale "required" error these tests guard,
// so only a render without <StrictMode> (or a production build) can see it.

const mocks = vi.hoisted(() => ({
  validateGenomeGroup: vi.fn(),
}));

vi.mock("../validate-genome-group", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../validate-genome-group")>()),
  validateGenomeGroup: mocks.validateGenomeGroup,
}));

vi.mock("@/hooks/services/use-service-runtime", () => ({
  useServiceRuntime: () => ({ isSubmitting: false, jobParamsDialogProps: {} }),
}));

vi.mock("@/hooks/services/use-feature-group-options", () => ({
  useFeatureGroupOptions: () => ({
    features: [],
    isLoading: false,
    error: null,
  }),
}));

vi.mock("@/hooks/services/use-genome-group-options", () => ({
  useGenomeGroupOptions: () => ({
    options: [],
    isLoading: false,
    error: null,
  }),
}));

vi.mock("@/components/services/job-params-dialog", () => ({
  JobParamsDialog: () => null,
}));

vi.mock("@/components/services/service-header", () => ({
  ServiceHeader: () => null,
}));

vi.mock("@/components/forms/required-form-components", () => ({
  RequiredFormCardTitle: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock("@/components/services/service-output-fields", () => ({
  ServiceOutputFields: ({
    outputPath,
    outputName,
  }: {
    outputPath: {
      value: string;
      onChange: (value: string) => void;
      errors?: ReactNode;
    };
    outputName: {
      value: string;
      onChange: (value: string) => void;
      errors?: ReactNode;
    };
  }) => (
    <div>
      <input
        aria-label="Output folder"
        value={outputPath.value}
        onChange={(e) => {
          outputPath.onChange(e.target.value);
        }}
      />
      {outputPath.errors}
      <input
        aria-label="Output name"
        value={outputName.value}
        onChange={(e) => {
          outputName.onChange(e.target.value);
        }}
      />
      {outputName.errors}
    </div>
  ),
}));

vi.mock("@/components/workspace/workspace-object-selector", () => ({
  WorkspaceObjectSelector: ({
    preset,
    onSelectedObjectChange,
  }: {
    preset: string;
    onSelectedObjectChange: (
      object: { id: string; name: string; path: string } | null,
    ) => void;
  }) => (
    <>
      {["A", "B"].map((name) => (
        <button
          key={name}
          type="button"
          onClick={() => {
            onSelectedObjectChange({
              id: `${preset}-${name}`,
              name,
              path: `/groups/${preset}/${name}`,
            });
          }}
        >
          Pick {preset} {name}
        </button>
      ))}
    </>
  ),
}));

const requiredMessages = () => screen.queryAllByText(/is required/i);
const radio = (name: string) => screen.getByRole("radio", { name });

// The zod `superRefine` that holds every conditional "required" only runs
// once the base object parses, so fill the two output fields first.
async function fillOutput(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Output folder"), "/home/user");
  await user.type(screen.getByLabelText("Output name"), "msa-out");
}

describe("MSA & SNP page required errors on a non-Strict render", () => {
  beforeEach(() => {
    mocks.validateGenomeGroup.mockReset();
    mocks.validateGenomeGroup.mockResolvedValue({
      status: "valid",
      genomeCount: 2,
    });
  });

  it("opens Feature ID unvalidated after Feature ID -> None -> Feature ID", async () => {
    const user = userEvent.setup();
    render(<MSAandSNPAnalysisPage />, { wrapper: createQueryClientWrapper() });
    await fillOutput(user);

    await user.click(radio("Feature ID"));
    expect(requiredMessages()).toHaveLength(0);
    await user.click(radio("None"));
    expect(requiredMessages()).toHaveLength(0);
    await user.click(radio("Feature ID"));
    expect(requiredMessages()).toHaveLength(0);
  });

  it("opens Genome ID unvalidated after switching to Viral Genome Group", async () => {
    const user = userEvent.setup();
    render(<MSAandSNPAnalysisPage />, { wrapper: createQueryClientWrapper() });
    await fillOutput(user);

    await user.click(radio("Viral Genome Group"));
    expect(requiredMessages()).toHaveLength(0);
    await user.click(radio("Genome ID"));
    expect(requiredMessages()).toHaveLength(0);
  });

  it("opens Feature ID unvalidated after an input type round trip", async () => {
    const user = userEvent.setup();
    render(<MSAandSNPAnalysisPage />, { wrapper: createQueryClientWrapper() });
    await fillOutput(user);

    await user.click(radio("Viral Genome Group"));
    await user.click(radio("Feature Group"));
    await user.click(radio("Feature ID"));
    expect(requiredMessages()).toHaveLength(0);
  });

  it("opens Feature ID unvalidated after Aligned -> Unaligned", async () => {
    const user = userEvent.setup();
    render(<MSAandSNPAnalysisPage />, { wrapper: createQueryClientWrapper() });
    await fillOutput(user);

    await user.click(radio("Aligned Sequences"));
    await user.click(radio("Unaligned Sequences"));
    await user.click(radio("Feature ID"));
    expect(requiredMessages()).toHaveLength(0);
  });

  it("clears Feature ID quietly when the feature group changes", async () => {
    const user = userEvent.setup();
    render(<MSAandSNPAnalysisPage />, { wrapper: createQueryClientWrapper() });
    await fillOutput(user);

    await user.click(screen.getByRole("button", { name: "Pick featureGroup A" }));
    await user.click(radio("Feature ID"));
    await user.click(screen.getByRole("button", { name: "Pick featureGroup B" }));
    expect(requiredMessages()).toHaveLength(0);
  });

  it("clears Genome ID quietly when the genome group changes", async () => {
    const user = userEvent.setup();
    render(<MSAandSNPAnalysisPage />, { wrapper: createQueryClientWrapper() });
    await fillOutput(user);

    await user.click(radio("Viral Genome Group"));
    await user.click(screen.getByRole("button", { name: "Pick genomeGroup A" }));
    await waitFor(() => {
      expect(mocks.validateGenomeGroup).toHaveBeenCalledTimes(1);
    });
    await user.click(radio("Genome ID"));
    await user.click(screen.getByRole("button", { name: "Pick genomeGroup B" }));
    await waitFor(() => {
      expect(mocks.validateGenomeGroup).toHaveBeenCalledTimes(2);
    });
    expect(requiredMessages()).toHaveLength(0);
  });

  it("still shows the error once the user types a reference and clears it", async () => {
    const user = userEvent.setup();
    render(<MSAandSNPAnalysisPage />, { wrapper: createQueryClientWrapper() });
    await fillOutput(user);

    await user.click(radio("Input Reference Sequence"));
    expect(requiredMessages()).toHaveLength(0);

    const reference = screen.getByPlaceholderText(
      "Enter a FASTA record of a reference sequence to align",
    );
    await user.type(reference, "x");
    await user.clear(reference);
    expect(await screen.findByText("Reference sequence is required")).toBeVisible();
  });

  it("still shows the error on a submit attempt", async () => {
    const user = userEvent.setup();
    const { container } = render(<MSAandSNPAnalysisPage />, { wrapper: createQueryClientWrapper() });
    await fillOutput(user);

    await user.click(radio("Feature ID"));
    expect(requiredMessages()).toHaveLength(0);

    const form = container.querySelector("form");
    if (!form) throw new Error("form not found");
    fireEvent.submit(form);
    expect(await screen.findByText("Feature ID is required")).toBeVisible();
  });
});
