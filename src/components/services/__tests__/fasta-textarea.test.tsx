import { render, screen, waitFor } from "@testing-library/react";

import { FastaTextarea } from "@/components/services/fasta-textarea";

const validProtein = ">seq1 Nucleocapsid protein\nMAFELKLGQIYEVVSENNLRVRVGDAAQGKF\n";
const missingHeader = "MAFELKLGQIYEVVSENNLRVRVGDAAQGKF\nMAFELKLGQIYEVVSENNLRVRVGDAAQGKF\n";

function renderTextarea(
  props: Partial<React.ComponentProps<typeof FastaTextarea>> = {},
) {
  return render(
    <FastaTextarea
      value=""
      onChange={vi.fn()}
      inputType="blastp"
      debounceMs={0}
      {...props}
    />,
  );
}

describe("FastaTextarea status line", () => {
  it("keeps one message line in every state so the card does not resize", async () => {
    const { rerender } = renderTextarea();
    const status = screen.getByRole("status");
    expect(status).toBeEmptyDOMElement();
    expect(status).toHaveClass("min-h-5");

    rerender(
      <FastaTextarea
        value={validProtein}
        onChange={vi.fn()}
        inputType="blastp"
        debounceMs={0}
      />,
    );
    expect(
      await screen.findByText("✓ Valid FASTA with 1 sequence"),
    ).toBe(status);
    expect(status).toHaveClass("text-success");

    rerender(
      <FastaTextarea
        value={missingHeader}
        onChange={vi.fn()}
        inputType="blastp"
        debounceMs={0}
      />,
    );
    expect(
      await screen.findByText(/starts with ">"/),
    ).toBe(status);
    expect(status).toHaveClass("text-destructive");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveAttribute("aria-invalid", "true");
  });

  it("shows a form field error in the same line and marks the box invalid", () => {
    renderTextarea({ fieldError: "FASTA sequence is required" });

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("FASTA sequence is required");
    expect(status).toHaveClass("text-destructive");
    expect(screen.getByRole("textbox")).toHaveAttribute("aria-invalid", "true");
  });

  it("drops the valid border when a form field error accompanies valid FASTA", async () => {
    const onValidationChange = vi.fn();
    renderTextarea({
      value: validProtein,
      fieldError: "Too many sequences",
      onValidationChange,
    });

    await waitFor(() => {
      expect(onValidationChange).toHaveBeenLastCalledWith(
        true,
        expect.objectContaining({ valid: true }),
      );
    });
    const status = screen.getByRole("status");
    const textbox = screen.getByRole("textbox");
    expect(textbox).not.toHaveClass("border-success");
    expect(status).toHaveTextContent("Too many sequences");
    expect(status).toHaveClass("text-destructive");
    expect(textbox).toHaveAttribute("aria-invalid", "true");
  });

  it("prefers the FASTA format error over the form field error", async () => {
    renderTextarea({
      value: missingHeader,
      fieldError: "FASTA sequence is required",
    });

    expect(
      await screen.findByText(/starts with ">"/),
    ).toBe(screen.getByRole("status"));
  });
});
