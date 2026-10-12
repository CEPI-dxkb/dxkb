import { fireEvent, render, screen } from "@testing-library/react";

import SelectedItemsTable from "@/components/services/selected-items-table";

describe("SelectedItemsTable", () => {
  it("draws one white bordered box that keeps the caller's className", () => {
    const { container } = render(
      <SelectedItemsTable
        items={[{ id: "a", name: "Genome A" }]}
        onRemove={vi.fn()}
        className="max-h-84 overflow-y-auto"
      />,
    );

    const box = screen.getByText("Genome A").closest(".rounded-md");
    expect(box).toHaveClass(
      "overflow-auto",
      "border",
      "bg-background",
      "max-h-84",
      "overflow-y-auto",
    );
    // No inner bordered box and no padding frame around the rows.
    expect(box).not.toHaveClass("p-4");
    expect(container.querySelectorAll(".rounded-md")).toHaveLength(1);
  });

  it("stripes the rows on white and removes by id", () => {
    const onRemove = vi.fn();
    render(
      <SelectedItemsTable
        items={[
          { id: "a", name: "Genome A", type: "Genome" },
          { id: "b", name: "Genome B" },
        ]}
        onRemove={onRemove}
      />,
    );

    const row = screen.getByText("Genome A").closest(".divide-y > div");
    expect(row).toHaveClass("bg-background", "even:bg-muted/50");

    fireEvent.click(screen.getAllByRole("button", { name: "Remove item" })[1]);
    expect(onRemove).toHaveBeenCalledWith("b");
  });

  it("shows the empty message on the same white box", () => {
    render(
      <SelectedItemsTable
        items={[]}
        onRemove={vi.fn()}
        emptyMessage="No genomes selected"
      />,
    );

    const message = screen.getByText("No genomes selected");
    expect(message).toHaveClass(
      "py-1.5",
      "text-center",
      "text-muted-foreground",
    );
    expect(message.parentElement).toHaveClass("bg-background");
  });
});
