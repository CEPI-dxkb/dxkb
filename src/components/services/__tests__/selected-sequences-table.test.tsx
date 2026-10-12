import { fireEvent, render, screen, within } from "@testing-library/react";

import { SelectedSequencesTable } from "@/components/services/selected-sequences-table";

const rows = [
  {
    id: "aligned_dna_fasta:/user@bvbrc/home/fasta/aligned.fa",
    name: "aligned.fa",
    path: "/user@bvbrc/home/fasta/aligned.fa",
    typeLabel: "Aligned DNA FASTA",
  },
  {
    id: "genome_group:/user@bvbrc/home/Genome Groups/Influenza",
    name: "Influenza",
    path: "/user@bvbrc/home/Genome Groups/Influenza",
    typeLabel: "Genome Group",
  },
];

describe("SelectedSequencesTable", () => {
  it("lists each row's name, start-truncated path and type under the caller's heading", () => {
    render(
      <SelectedSequencesTable heading="Selected file" rows={rows} onRemove={vi.fn()} />,
    );

    expect(
      screen.getByRole("columnheader", { name: "Selected file" }),
    ).toBeInTheDocument();
    const path = screen.getByText(rows[1].path);
    // The whole path stays in the DOM and the title; CSS cuts its start.
    expect(path).toHaveAttribute("title", rows[1].path);
    expect(path).toHaveClass("truncate-start");
    const row = path.closest("tr");
    expect(row).not.toBeNull();
    if (!row) return;
    expect(within(row).getByText("Influenza")).toBeInTheDocument();
    expect(
      within(row).getByRole("cell", { name: "Genome Group" }),
    ).toBeInTheDocument();
  });

  it("removes by index", () => {
    const onRemove = vi.fn();
    render(
      <SelectedSequencesTable heading="Selected file" rows={rows} onRemove={onRemove} />,
    );

    fireEvent.click(
      screen.getAllByRole("button", { name: "Remove selected sequence" })[1],
    );
    expect(onRemove).toHaveBeenCalledWith(1);
  });

  it("shows the empty message and the note under its own rule", () => {
    const { container } = render(
      <SelectedSequencesTable
        heading="Selected file"
        rows={[]}
        onRemove={vi.fn()}
        note="No mixing of DNA and Protein FASTA files is allowed."
      />,
    );

    // One empty cell per layout; CSS shows one.
    expect(screen.getAllByText("No items selected.")).toHaveLength(2);
    const note = screen.getByText(
      "No mixing of DNA and Protein FASTA files is allowed.",
    );
    expect(note.previousElementSibling).toHaveAttribute(
      "data-slot",
      "separator",
    );
    expect(container.querySelectorAll('[data-slot="separator"]')).toHaveLength(1);
  });

  it("draws no rule without a note", () => {
    const { container } = render(
      <SelectedSequencesTable heading="Selected file" rows={rows} onRemove={vi.fn()} />,
    );

    expect(container.querySelector('[data-slot="separator"]')).toBeNull();
  });
});
