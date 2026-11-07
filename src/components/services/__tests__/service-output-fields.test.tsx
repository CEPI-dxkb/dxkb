import { fireEvent, render, screen } from "@testing-library/react";
import { ServiceOutputFields } from "@/components/services/service-output-fields";

vi.mock("@/components/services/output-folder", () => ({
  default: ({
    variant,
    value,
    onChange,
    outputFolderPath,
    onValidationChange,
    required,
    invalid,
  }: {
    required?: boolean;
    invalid?: boolean;
    variant?: "name";
    value: string;
    onChange: (value: string) => void;
    outputFolderPath?: string;
    onValidationChange?: (valid: boolean) => void;
  }) => (
    <div
      data-required={String(required)}
      data-invalid={String(invalid)}
    >
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

  describe("row layout", () => {
    const bindings = {
      outputPath: {
        value: "/alice/home",
        onChange: vi.fn(),
        errors: <span>Path error</span>,
        invalid: true,
      },
      outputName: {
        value: "analysis",
        onChange: vi.fn(),
        errors: <span>Name error</span>,
      },
      onOutputNameValidationChange: vi.fn(),
    };

    it("renders each field in a service-card-row-item of one service-card-row", () => {
      const { container } = render(
        <ServiceOutputFields layout="row" required={false} {...bindings} />,
      );

      const row = container.firstElementChild;
      expect(row).toHaveClass("service-card-row");
      const items = Array.from(row?.children ?? []);
      expect(items).toHaveLength(2);
      for (const item of items) {
        expect(item).toHaveClass("service-card-row-item");
        expect(item.children).toHaveLength(1);
        expect(item.firstElementChild).toHaveAttribute(
          "data-slot",
          "form-item",
        );
      }
      expect(items[0]).toHaveTextContent("Path error");
      expect(items[1]).toHaveTextContent("Name error");
    });

    it("passes required and invalid through to both folders", () => {
      const { container } = render(
        <ServiceOutputFields layout="row" required={false} {...bindings} />,
      );
      const [pathFolder, nameFolder] = Array.from(
        container.querySelectorAll("[data-required]"),
      );
      expect(pathFolder).toHaveAttribute("data-required", "false");
      expect(pathFolder).toHaveAttribute("data-invalid", "true");
      expect(nameFolder).toHaveAttribute("data-required", "false");
      expect(nameFolder).toHaveAttribute("data-invalid", "undefined");
    });

    it("keeps the column layout by default", () => {
      const { container } = render(
        <ServiceOutputFields {...bindings} />,
      );
      expect(container.firstElementChild).toHaveClass(
        "flex",
        "flex-col",
        "space-y-4",
        { exact: true },
      );
      expect(container.querySelector(".service-card-row-item")).toBeNull();
      expect(container.querySelector("[data-required]")).toHaveAttribute(
        "data-required",
        "true",
      );
    });
  });
});
