import { fireEvent, render, screen } from "@testing-library/react";
import { SelectedLibrariesCard } from "@/components/services/selected-libraries-card";

describe("SelectedLibrariesCard", () => {
  it("renders library labels and removes the selected item by id", () => {
    const onRemove = vi.fn();

    render(
      <SelectedLibrariesCard
        items={[
          { id: "paired-id", name: "reads_1 + reads_2", type: "paired" },
          { id: "sra-id", name: "SRR123", type: "sra" },
        ]}
        onRemove={onRemove}
      />,
    );

    expect(screen.getByText("Selected Libraries")).toBeVisible();
    expect(screen.getByText("Paired Read")).toBeVisible();
    expect(screen.getByText("SRA Accession")).toBeVisible();

    fireEvent.click(screen.getAllByRole("button", { name: "Remove item" })[1]);
    expect(onRemove).toHaveBeenCalledWith("sra-id");
  });

  it("passes optional styling to the selected-items table", () => {
    const { container } = render(
      <SelectedLibrariesCard
        items={[]}
        onRemove={vi.fn()}
        tableClassName="max-h-80 overflow-y-auto"
      />,
    );

    expect(container.querySelector(".max-h-80.overflow-y-auto")).not.toBeNull();
    expect(screen.getByText("No items selected")).toBeVisible();
  });
});
