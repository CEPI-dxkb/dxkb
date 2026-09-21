import { fireEvent, render, screen } from "@testing-library/react";
import { ServiceOutputFields } from "@/components/services/service-output-fields";

vi.mock("@/components/services/output-folder", () => ({
  default: ({
    variant,
    value,
    onChange,
    outputFolderPath,
    onValidationChange,
  }: {
    variant?: "name";
    value: string;
    onChange: (value: string) => void;
    outputFolderPath?: string;
    onValidationChange?: (valid: boolean) => void;
  }) => (
    <div>
      <input
        aria-label={variant === "name" ? "output name" : "output path"}
        value={value}
        data-output-path={outputFolderPath}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />
      {onValidationChange ? (
        <button
          type="button"
          onClick={() => {
            onValidationChange(false);
          }}
        >
          invalidate
        </button>
      ) : null}
    </div>
  ),
}));

describe("ServiceOutputFields", () => {
  it("wires typed path, name, errors, and name validation", () => {
    const onPathChange = vi.fn();
    const onNameChange = vi.fn();
    const onValidationChange = vi.fn();

    render(
      <ServiceOutputFields
        outputPath={{
          value: "/alice/home/results",
          onChange: onPathChange,
          errors: <span>Path error</span>,
        }}
        outputName={{
          value: "analysis",
          onChange: onNameChange,
          errors: <span>Name error</span>,
        }}
        onOutputNameValidationChange={onValidationChange}
      />,
    );

    const nameInput = screen.getByRole("textbox", { name: "output name" });
    expect(nameInput).toHaveAttribute(
      "data-output-path",
      "/alice/home/results",
    );
    expect(screen.getByText("Path error")).toBeVisible();
    expect(screen.getByText("Name error")).toBeVisible();

    fireEvent.change(
      screen.getByRole("textbox", { name: "output path" }),
      { target: { value: "/alice/home/new" } },
    );
    fireEvent.change(nameInput, { target: { value: "new-analysis" } });
    fireEvent.click(screen.getByRole("button", { name: "invalidate" }));

    expect(onPathChange).toHaveBeenCalledWith("/alice/home/new");
    expect(onNameChange).toHaveBeenCalledWith("new-analysis");
    expect(onValidationChange).toHaveBeenCalledWith(false);
  });
});
