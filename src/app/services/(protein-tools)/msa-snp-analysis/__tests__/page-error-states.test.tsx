import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createQueryClientWrapper } from "@/test-helpers/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { server } from "@/test-helpers/msw-server";
import MSAandSNPAnalysisPage from "../page";
import type { GenomeGroupValidationResult } from "../validate-genome-group";

const mocks = vi.hoisted(() => ({
  validateGenomeGroup: vi.fn(),
  submitFormData: vi.fn(),
  featureOptionsError: null as string | null,
}));

vi.mock("../validate-genome-group", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../validate-genome-group")>()),
  validateGenomeGroup: mocks.validateGenomeGroup,
}));

vi.mock("@/hooks/services/use-service-runtime", () => ({
  useServiceRuntime: () => ({
    isSubmitting: false,
    jobParamsDialogProps: {},
    submitFormData: mocks.submitFormData,
  }),
}));

vi.mock("@/hooks/services/use-feature-group-options", () => ({
  useFeatureGroupOptions: () => ({
    features: [],
    isLoading: false,
    error: mocks.featureOptionsError,
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

interface OutputBinding {
  value: string;
  onChange: (value: string) => void;
  errors?: ReactNode;
  invalid?: boolean;
}

vi.mock("@/components/services/service-output-fields", () => ({
  ServiceOutputFields: ({
    outputPath,
    outputName,
  }: {
    outputPath: OutputBinding;
    outputName: OutputBinding;
  }) => (
    <div>
      {[
        ["Output folder", outputPath],
        ["Output name", outputName],
      ].map(([label, binding]) => {
        const { value, onChange, errors, invalid } = binding as OutputBinding;
        return (
          <div key={label as string}>
            <input
              aria-label={label as string}
              aria-invalid={invalid || undefined}
              value={value}
              onChange={(e) => {
                onChange(e.target.value);
              }}
            />
            {errors}
          </div>
        );
      })}
    </div>
  ),
}));

// The selector as a read-only box showing the `value` and error state the
// page gives it, with buttons that pick an object or clear the pick. A FASTA
// picker's "A" is a DNA file and its "B" a protein one.
vi.mock("@/components/workspace/workspace-object-selector", () => {
  const fastaTypes: Partial<Record<string, string[]>> = {
    featureFasta: ["feature_dna_fasta", "feature_protein_fasta"],
    alignedFasta: ["aligned_dna_fasta", "aligned_protein_fasta"],
  };
  return {
    WorkspaceObjectSelector: ({
      preset,
      value,
      invalid,
      onSelectedObjectChange,
    }: {
      preset: string;
      value?: string;
      invalid?: boolean;
      onSelectedObjectChange: (
        object: { id: string; name: string; path: string; type: string } | null,
      ) => void;
    }) => (
      <>
        <input
          readOnly
          aria-label={`${preset} selection`}
          aria-invalid={invalid || undefined}
          value={value ?? ""}
        />
        {["A", "B"].map((name, index) => (
          <button
            key={name}
            type="button"
            onClick={() => {
              onSelectedObjectChange({
                id: `${preset}-${name}`,
                name,
                path: `/groups/${preset}/${name}`,
                type: fastaTypes[preset]?.[index] ?? preset,
              });
            }}
          >
            Pick {preset} {name}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            onSelectedObjectChange(null);
          }}
        >
          Clear {preset}
        </button>
      </>
    ),
  };
});

/** File contents the preview route serves, by workspace path. */
let fastaFiles: Partial<Record<string, string>> = {};

function serveFastaFiles() {
  server.use(
    http.get("*/api/workspace/preview/*", ({ request }) => {
      const path = decodeURIComponent(
        new URL(request.url).pathname.replace("/api/workspace/preview", ""),
      );
      const text = fastaFiles[path];
      return text === undefined
        ? HttpResponse.json(
            { error: "Download URL not found" },
            { status: 404 },
          )
        : new HttpResponse(text);
    }),
  );
}

const radio = (name: string) => screen.getByRole("radio", { name });
const selection = (preset: string) =>
  screen.getByRole("textbox", { name: `${preset} selection` });
const pickButton = (preset: string, name: string) =>
  screen.getByRole("button", { name: `Pick ${preset} ${name}` });

/**
 * The card shows an error's summary; its info button opens the full text.
 * Returns that text.
 */
async function errorDetails(
  user: ReturnType<typeof userEvent.setup>,
  summary: string,
): Promise<string> {
  expect(await screen.findByText(summary)).toBeVisible();
  await user.click(
    screen.getByRole("button", { name: `Error details: ${summary}` }),
  );
  const dialog = await screen.findByRole("dialog");
  const details = dialog.querySelector('[data-slot="dialog-description"]');
  const text = details?.textContent ?? dialog.textContent;
  await user.keyboard("{Escape}");
  return text;
}

async function fillOutput(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Output folder"), "/home/user");
  await user.type(screen.getByLabelText("Output name"), "msa-out");
}

function submit(container: HTMLElement) {
  const form = container.querySelector("form");
  if (!form) throw new Error("form not found");
  fireEvent.submit(form);
}

const invalidGroup: GenomeGroupValidationResult = {
  status: "invalid",
  message:
    "This looks like an invalid genome group.\n- Invalid Superkingdom: only virus genomes are permitted",
};

describe("MSA & SNP page error states", () => {
  beforeEach(() => {
    mocks.validateGenomeGroup.mockReset();
    mocks.submitFormData.mockReset();
    mocks.featureOptionsError = null;
    fastaFiles = {
      "/groups/featureFasta/A": ">a\nACGT\n>b\nACGA\n",
      "/groups/featureFasta/B": ">p1\nMKVLQ\n>p2\nMKLVE\n",
    };
    serveFastaFiles();
  });

  it("keeps a rejected genome group on screen in its error state, in place of the one before it", async () => {
    mocks.validateGenomeGroup.mockImplementation((path: string) =>
      Promise.resolve(
        path.endsWith("/A")
          ? { status: "valid", genomeCount: 2 }
          : invalidGroup,
      ),
    );
    const user = userEvent.setup();
    const { container } = render(<MSAandSNPAnalysisPage />, { wrapper: createQueryClientWrapper() });
    await fillOutput(user);
    await user.click(radio("Viral Genome Group"));

    await user.click(pickButton("genomeGroup", "A"));
    await waitFor(() => {
      expect(selection("genomeGroup")).toHaveValue("/groups/genomeGroup/A");
    });
    await user.click(pickButton("genomeGroup", "B"));

    // The card keeps the summary; the full findings are one click away.
    expect(await errorDetails(user, "Genome group validation failed")).toMatch(
      /Invalid Superkingdom: only virus genomes/,
    );
    expect(screen.queryByText(/Invalid Superkingdom/)).toBeNull();
    expect(selection("genomeGroup")).toHaveValue("/groups/genomeGroup/B");
    expect(selection("genomeGroup")).toHaveAttribute("aria-invalid", "true");

    // The form no longer holds group A, so there is nothing to submit.
    submit(container);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();
    });
    expect(mocks.submitFormData).not.toHaveBeenCalled();
    expect(screen.queryByText("Genome group is required")).toBeNull();
  });

  it("submits a genome group only once it passes validation", async () => {
    let resolveValidation: (result: GenomeGroupValidationResult) => void = () =>
      undefined;
    mocks.validateGenomeGroup.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveValidation = resolve;
        }),
    );
    const user = userEvent.setup();
    const { container } = render(<MSAandSNPAnalysisPage />, { wrapper: createQueryClientWrapper() });
    await fillOutput(user);
    await user.click(radio("Viral Genome Group"));
    await user.click(radio("Genome ID"));

    await user.click(pickButton("genomeGroup", "B"));
    // Under the selector, and as the disabled Genome ID's placeholder.
    expect(screen.getAllByText("Validating genome group...")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();
    expect(
      screen.getByRole("combobox", { name: "Select genome ID" }),
    ).toBeDisabled();

    resolveValidation({ status: "valid", genomeCount: 2 });
    await waitFor(() => {
      expect(screen.queryAllByText("Validating genome group...")).toHaveLength(
        0,
      );
    });
    await user.click(radio("None"));
    submit(container);

    await waitFor(() => {
      expect(mocks.submitFormData).toHaveBeenCalledWith(
        expect.objectContaining({
          select_genomegroup: ["/groups/genomeGroup/B"],
        }),
      );
    });
  });

  it("shows a failed validation request on the genome group field", async () => {
    mocks.validateGenomeGroup.mockRejectedValue(new Error("Network down"));
    const user = userEvent.setup();
    render(<MSAandSNPAnalysisPage />, { wrapper: createQueryClientWrapper() });
    await user.click(radio("Viral Genome Group"));

    await user.click(pickButton("genomeGroup", "A"));

    expect(
      await errorDetails(user, "Could not validate the genome group"),
    ).toBe("Network down");
    expect(selection("genomeGroup")).toHaveAttribute("aria-invalid", "true");
  });

  it("drops the genome group when its selector is cleared", async () => {
    mocks.validateGenomeGroup.mockResolvedValue({
      status: "valid",
      genomeCount: 2,
    });
    const user = userEvent.setup();
    const { container } = render(<MSAandSNPAnalysisPage />, { wrapper: createQueryClientWrapper() });
    await fillOutput(user);
    await user.click(radio("Viral Genome Group"));
    await user.click(pickButton("genomeGroup", "A"));
    await waitFor(() => {
      expect(selection("genomeGroup")).toHaveValue("/groups/genomeGroup/A");
    });

    await user.click(screen.getByRole("button", { name: "Clear genomeGroup" }));

    expect(await screen.findByText("Genome group is required")).toBeVisible();
    expect(selection("genomeGroup")).toHaveAttribute("aria-invalid", "true");
    submit(container);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();
    });
    expect(mocks.submitFormData).not.toHaveBeenCalled();
  });

  it("keeps Genome ID disabled until a genome group passes", async () => {
    const user = userEvent.setup();
    render(<MSAandSNPAnalysisPage />, { wrapper: createQueryClientWrapper() });
    await user.click(radio("Viral Genome Group"));
    await user.click(radio("Genome ID"));

    const genomeId = screen.getByRole("combobox", { name: "Select genome ID" });
    expect(genomeId).toBeDisabled();
    expect(genomeId).toHaveTextContent(
      "Select a valid viral genome group first",
    );
  });

  it("keeps a feature-list load error on the Feature ID field", async () => {
    mocks.featureOptionsError = "Service unavailable";
    const toastError = vi.spyOn(toast, "error");
    const user = userEvent.setup();
    render(<MSAandSNPAnalysisPage />, { wrapper: createQueryClientWrapper() });
    await user.click(pickButton("featureGroup", "A"));
    await user.click(radio("Feature ID"));

    // The toast carries the error until it is closed.
    expect(toastError).toHaveBeenCalledWith(
      "Failed to load features",
      expect.objectContaining({
        description: "Service unavailable",
        duration: Infinity,
      }),
    );
    expect(await errorDetails(user, "Failed to load features")).toBe(
      "Service unavailable",
    );
    toastError.mockRestore();
    expect(
      screen.getByRole("combobox", { name: "Select feature ID" }),
    ).toHaveAttribute("aria-invalid", "true");
  });

  it("shows the picked FASTA file again after an input type round trip", async () => {
    const user = userEvent.setup();
    render(<MSAandSNPAnalysisPage />, { wrapper: createQueryClientWrapper() });
    await user.click(radio("DNA or Protein FASTA File"));
    await user.click(pickButton("featureFasta", "A"));

    await user.click(radio("Input Sequence"));
    await user.click(radio("DNA or Protein FASTA File"));

    expect(selection("featureFasta")).toHaveValue("/groups/featureFasta/A");
  });

  it("does not submit an unaligned FASTA file from the aligned selector", async () => {
    const user = userEvent.setup();
    const { container } = render(<MSAandSNPAnalysisPage />, { wrapper: createQueryClientWrapper() });
    await fillOutput(user);
    await user.click(radio("DNA or Protein FASTA File"));
    await user.click(pickButton("featureFasta", "A"));

    await user.click(radio("Aligned Sequences"));
    expect(selection("alignedFasta")).toHaveValue("");
    submit(container);

    expect(
      await screen.findByText("Aligned FASTA file is required"),
    ).toBeVisible();
    expect(selection("alignedFasta")).toHaveAttribute("aria-invalid", "true");
    expect(mocks.submitFormData).not.toHaveBeenCalled();
  });

  it("draws each required field in its error state on a submit attempt", async () => {
    const user = userEvent.setup();
    const { container } = render(<MSAandSNPAnalysisPage />, { wrapper: createQueryClientWrapper() });
    submit(container);

    expect(await screen.findByText("Output folder is required")).toBeVisible();
    expect(screen.getByLabelText("Output folder")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByLabelText("Output name")).toHaveAttribute(
      "aria-invalid",
      "true",
    );

    // The conditional "required" errors need the base object to parse.
    await fillOutput(user);
    submit(container);
    expect(await screen.findByText("Feature group is required")).toBeVisible();
    expect(selection("featureGroup")).toHaveAttribute("aria-invalid", "true");
  });
});

describe("MSA & SNP page FASTA file checks", () => {
  beforeEach(() => {
    mocks.submitFormData.mockReset();
    fastaFiles = {
      "/groups/featureFasta/A": ">a\nACGT\n>b\nACGA\n",
      "/groups/featureFasta/B": ">p1\nMKVLQ\n>p2\nMKLVE\n",
    };
    serveFastaFiles();
  });

  async function pickFastaFile(
    user: ReturnType<typeof userEvent.setup>,
    name: "A" | "B",
  ) {
    await user.click(radio("DNA or Protein FASTA File"));
    await user.click(pickButton("featureFasta", name));
  }

  it("submits a file that passes, typed by its workspace type", async () => {
    // "B" is a protein file whatever its path says.
    const user = userEvent.setup();
    const { container } = render(<MSAandSNPAnalysisPage />, { wrapper: createQueryClientWrapper() });
    await fillOutput(user);
    await pickFastaFile(user, "B");
    await waitFor(() => {
      expect(screen.queryByText("Checking FASTA file...")).toBeNull();
    });

    submit(container);

    await waitFor(() => {
      expect(mocks.submitFormData).toHaveBeenCalledWith(
        expect.objectContaining({
          fasta_files: [
            { file: "/groups/featureFasta/B", type: "feature_protein_fasta" },
          ],
        }),
      );
    });
  });

  it("keeps a file with too few sequences on screen in its error state", async () => {
    fastaFiles["/groups/featureFasta/A"] = ">only\nACGT\n";
    const user = userEvent.setup();
    const { container } = render(<MSAandSNPAnalysisPage />, { wrapper: createQueryClientWrapper() });
    await fillOutput(user);
    await pickFastaFile(user, "A");

    expect(await errorDetails(user, "Invalid FASTA file")).toBe(
      "At least 2 sequence(s) are required.",
    );
    expect(selection("featureFasta")).toHaveValue("/groups/featureFasta/A");
    expect(selection("featureFasta")).toHaveAttribute("aria-invalid", "true");
    submit(container);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();
    });
    expect(mocks.submitFormData).not.toHaveBeenCalled();
  });

  it("checks a DNA file's letters as nucleotides", async () => {
    fastaFiles["/groups/featureFasta/A"] = ">a\nACGT\n>b\nMKVLQ\n";
    const user = userEvent.setup();
    render(<MSAandSNPAnalysisPage />, { wrapper: createQueryClientWrapper() });
    await pickFastaFile(user, "A");

    expect(await errorDetails(user, "Invalid FASTA file")).toBe(
      "Invalid nucleotide letters on line 4.",
    );
  });

  it("shows why a file could not be read", async () => {
    delete fastaFiles["/groups/featureFasta/A"];
    const user = userEvent.setup();
    render(<MSAandSNPAnalysisPage />, { wrapper: createQueryClientWrapper() });
    await pickFastaFile(user, "A");

    expect(await errorDetails(user, "Could not read the FASTA file")).toBe(
      "Download URL not found",
    );
    expect(selection("featureFasta")).toHaveAttribute("aria-invalid", "true");
  });

  it("keeps Submit disabled while the file is checked", async () => {
    let release: () => void = () => undefined;
    const served = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.get("*/api/workspace/preview/*", async () => {
        await served;
        return new HttpResponse(">a\nACGT\n>b\nACGA\n");
      }),
    );
    const user = userEvent.setup();
    render(<MSAandSNPAnalysisPage />, { wrapper: createQueryClientWrapper() });
    await fillOutput(user);
    await pickFastaFile(user, "A");

    expect(screen.getByText("Checking FASTA file...")).toBeVisible();
    expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();

    release();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Submit" })).toBeEnabled();
    });
  });

  it("does not carry a rejected file over to the aligned selector", async () => {
    fastaFiles["/groups/featureFasta/A"] = ">only\nACGT\n";
    const user = userEvent.setup();
    const { container } = render(<MSAandSNPAnalysisPage />, { wrapper: createQueryClientWrapper() });
    await fillOutput(user);
    await pickFastaFile(user, "A");
    await screen.findByText("Invalid FASTA file");

    // The aligned selector opens empty and unvalidated (a swapped-in field
    // does not open on "required"), and Submit waits for its file.
    await user.click(radio("Aligned Sequences"));
    expect(selection("alignedFasta")).toHaveValue("");
    expect(selection("alignedFasta")).not.toHaveAttribute("aria-invalid");
    expect(screen.queryByText("Invalid FASTA file")).toBeNull();
    expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();

    await user.click(pickButton("alignedFasta", "A"));
    submit(container);
    await waitFor(() => {
      expect(mocks.submitFormData).toHaveBeenCalledWith(
        expect.objectContaining({
          fasta_files: [
            { file: "/groups/alignedFasta/A", type: "aligned_dna_fasta" },
          ],
        }),
      );
    });
  });

  it("does not check an aligned file's contents, as legacy does not", async () => {
    const user = userEvent.setup();
    const { container } = render(<MSAandSNPAnalysisPage />, { wrapper: createQueryClientWrapper() });
    await fillOutput(user);
    await user.click(radio("Aligned Sequences"));
    await user.click(pickButton("alignedFasta", "B"));

    submit(container);

    await waitFor(() => {
      expect(mocks.submitFormData).toHaveBeenCalledWith(
        expect.objectContaining({
          fasta_files: [
            { file: "/groups/alignedFasta/B", type: "aligned_protein_fasta" },
          ],
        }),
      );
    });
  });
});

describe("MSA & SNP page aligner", () => {
  it("hides the aligner for an aligned file, as legacy does", async () => {
    const user = userEvent.setup();
    render(<MSAandSNPAnalysisPage />, { wrapper: createQueryClientWrapper() });
    const aligner = () =>
      screen.queryByRole("combobox", { name: "Select aligner" });
    expect(aligner()).toBeInTheDocument();

    await user.click(radio("Aligned Sequences"));
    expect(aligner()).toBeNull();
    expect(screen.queryByText("Aligner")).toBeNull();

    await user.click(radio("Unaligned Sequences"));
    expect(aligner()).toHaveTextContent("Mafft");
  });
});
