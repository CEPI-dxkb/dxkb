import { render, screen } from "@testing-library/react";

import { ServiceNumberInput } from "@/components/services/form-ui/service-number-input";

describe("ServiceNumberInput", () => {
  it("renders one labelled numeric input with the service field class and its steppers", () => {
    render(
      <>
        <label htmlFor="min-contig-length">Min contig length</label>
        <ServiceNumberInput
          id="min-contig-length"
          value={300}
          min={1}
          className="w-24"
        />
      </>,
    );

    const input = screen.getByLabelText("Min contig length");
    expect(screen.getAllByRole("textbox")).toEqual([input]);
    expect(input).toHaveValue("300");
    expect(input).toHaveClass("service-card-input", "w-24");
    expect(
      screen.getByRole("button", { name: "Increase value" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Decrease value" }),
    ).toBeInTheDocument();
  });
});
