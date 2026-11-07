import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { TreeThresholdSelect } from "@/components/services/tree-threshold-select";
import { thresholdOptions } from "@/lib/forms/tree-threshold-options";

function renderSelect(onValueChange = vi.fn()) {
  render(
    <TreeThresholdSelect
      label={<span>Trim Threshold</span>}
      ariaLabel="Trim threshold"
      value="0.3"
      onValueChange={onValueChange}
    />,
  );
  return onValueChange;
}

describe("TreeThresholdSelect", () => {
  it("shows the label, the aria-label and the current value", () => {
    renderSelect();
    expect(screen.getByText("Trim Threshold")).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: "Trim threshold" }),
    ).toHaveTextContent("0.3");
  });

  it("lists 0 through 1.0 and reports the chosen value", async () => {
    const user = userEvent.setup();
    const onValueChange = renderSelect();
    await user.click(screen.getByRole("combobox", { name: "Trim threshold" }));
    const options = await screen.findAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual([
      ...thresholdOptions,
    ]);
    expect(options[0]).toHaveTextContent("0");
    expect(options.at(-1)).toHaveTextContent("1.0");
    await user.click(screen.getByRole("option", { name: "0.8" }));
    expect(onValueChange).toHaveBeenCalledWith("0.8");
  });
});
