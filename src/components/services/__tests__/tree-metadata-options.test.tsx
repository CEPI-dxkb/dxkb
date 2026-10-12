import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { TreeMetadataOptions } from "@/components/services/tree-metadata-options";
import {
  defaultMetadataFields,
  metadataFieldOptions,
  metadataFieldSections,
} from "@/lib/forms/genome-metadata-fields";

function Harness() {
  const [selectedField, setSelectedField] = useState("");
  return (
    <TreeMetadataOptions
      open
      onOpenChange={vi.fn()}
      sections={metadataFieldSections}
      selectedField={selectedField}
      onSelectField={setSelectedField}
      onAdd={vi.fn()}
      fields={defaultMetadataFields}
      onRemove={vi.fn()}
    />
  );
}

describe("TreeMetadataOptions", () => {
  it("lists each field once, in a group per section, without key warnings", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(
      screen.getByRole("combobox", { name: "Metadata table field" }),
    );

    const names = (await screen.findAllByRole("option")).map(
      (option) => option.textContent,
    );
    expect(names).toHaveLength(metadataFieldOptions.length);
    expect(new Set(names).size).toBe(names.length);
    for (const section of metadataFieldSections) {
      expect(
        screen.getByRole("group", { name: section.label }),
      ).toBeInTheDocument();
    }
    // The repeated fields used to log "Encountered two children with the
    // same key" once per repeat.
    const keyWarnings = vi
      .mocked(console.error)
      .mock.calls.filter(([message]) => String(message).includes("same key"));
    expect(keyWarnings).toEqual([]);
  });

  it("shows the picked field's label in the trigger, not its id", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const trigger = screen.getByRole("combobox", {
      name: "Metadata table field",
    });

    await user.click(trigger);
    await user.click(await screen.findByRole("option", { name: "Host Group" }));

    expect(trigger).toHaveTextContent("Host Group");
    expect(trigger).not.toHaveTextContent("host_group");
    expect(
      screen.getByRole("button", { name: "Add metadata field" }),
    ).toBeEnabled();
  });
});
