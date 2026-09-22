import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { PhyloFamilyBlock } from "@/lib/services/organisms/phylogeny";
import { ViralTreePicker } from "../viral-tree-picker";

// Segment suffixes matter now that a row is keyed by (strain, segment): without
// them every tree parses to segment `null` and collapses into one row, silently
// shadowing "Missing NA" behind "Auspice HA" in the nextstrain slot.
const block: PhyloFamilyBlock = {
  groups: [
    {
      key: "h3n2",
      title: "H3N2",
      archaeopteryx: [
        { name: "XML HA (HA)", path: "/ha.xml", metadata: "/ha.tar.gz" },
      ],
      nextstrain: [
        { name: "Auspice HA (HA)", path: "/Influenza-A-Virus/H3N2/HA/" },
        { name: "Missing NA (NA)", path: "Influenza-A-Virus/H3N2/NA" },
      ],
    },
  ],
};

// Two strains where H5N1 is Archaeopteryx-only and PB2-only, so every facet has
// at least one dead-end option to disable.
const mixedBlock: PhyloFamilyBlock = {
  groups: [
    {
      key: "h3n2",
      title: "H3N2",
      archaeopteryx: [{ name: "XML HA (HA)", path: "/h3n2-ha.xml" }],
      nextstrain: [
        { name: "Auspice NA (NA)", path: "/Influenza-A-Virus/H3N2/NA/" },
      ],
    },
    {
      key: "h5n1",
      title: "H5N1",
      archaeopteryx: [{ name: "XML PB2 (PB2)", path: "/h5n1-pb2.xml" }],
      nextstrain: [],
    },
  ],
};

function row(name: string): HTMLElement {
  const element = screen
    .getByText(name)
    .closest<HTMLElement>("[data-slot=tree-row]");
  if (!element) throw new Error(`row '${name}' not found`);
  return element;
}

describe("ViralTreePicker", () => {
  it.each(["{Enter}", " "])(
    "opens an available canonical dataset via keyboard (%j)",
    async (key) => {
      const user = userEvent.setup();
      const onOpen = vi.fn();
      render(
        <ViralTreePicker
          block={block}
          nextstrainInventory={{
            status: "ready",
            ids: new Set(["Influenza-A-Virus/H3N2/HA"]),
          }}
          onOpen={onOpen}
        />,
      );

      // Archaeopteryx and Auspice share the HA row, so the row's own displayed
      // name is the primary (first) choice — "XML HA (HA)" — even though the
      // button we're targeting is the Auspice peer within that same row. A
      // native <button> only fires click on Enter/Space through the browser's
      // real default action, which userEvent simulates but fireEvent does not.
      within(row("XML HA (HA)"))
        .getByRole("button", { name: "Open Auspice HA (HA) in Auspice" })
        .focus();
      await user.keyboard(key);
      expect(onOpen).toHaveBeenCalledOnce();
      expect(onOpen.mock.calls[0]?.[0]).toMatchObject({
        viewer: "nextstrain",
        ref: { path: "/Influenza-A-Virus/H3N2/HA/" },
      });
    },
  );

  it("keeps unavailable viewer slots inert and non-interactive", () => {
    const onOpen = vi.fn();
    render(
      <ViralTreePicker
        block={block}
        nextstrainInventory={{ status: "ready", ids: new Set() }}
        onOpen={onOpen}
      />,
    );

    // NA has no Archaeopteryx tree at all *and* an unavailable Auspice dataset,
    // so both peer slots in this row read "Not Available" — assert on the
    // Auspice one specifically via its distinguishing tooltip.
    const unavailable = within(row("Missing NA (NA)")).getByTitle(
      "Auspice dataset is not available",
    );
    expect(unavailable).toHaveTextContent("Not Available");
    expect(unavailable).toHaveClass("cursor-not-allowed");
    expect(unavailable.tagName).toBe("SPAN");
    fireEvent.click(unavailable);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("only labels existing Auspice choices as checking availability", () => {
    render(
      <ViralTreePicker
        block={mixedBlock}
        nextstrainInventory={{ status: "pending" }}
        onOpen={vi.fn()}
      />,
    );

    expect(
      within(row("Auspice NA (NA)")).getByTitle(
        "Auspice dataset availability has not been confirmed",
      ),
    ).toHaveTextContent("Checking Availability");
    expect(
      within(row("XML PB2 (PB2)")).getByTitle(
        "No Auspice tree for this segment",
      ),
    ).toHaveTextContent("Not Available");
  });

  it("keeps Auspice choices fail-closed without claiming they are unavailable when inventory loading fails", () => {
    const onOpen = vi.fn();
    render(
      <ViralTreePicker
        block={block}
        nextstrainInventory={{ status: "error", message: "Network error" }}
        onOpen={onOpen}
      />,
    );

    const unconfirmed = within(row("XML HA (HA)")).getByTitle(
      "Auspice dataset availability could not be confirmed",
    );
    expect(unconfirmed).toHaveTextContent("Availability Unconfirmed");
    expect(unconfirmed.tagName).toBe("SPAN");
    fireEvent.click(unconfirmed);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("labels each viewer button with the tree name so same-named viewers across rows are distinguishable", () => {
    render(
      <ViralTreePicker
        block={block}
        nextstrainInventory={{
          status: "ready",
          ids: new Set(["Influenza-A-Virus/H3N2/HA"]),
        }}
        onOpen={vi.fn()}
      />,
    );

    // Archaeopteryx and Auspice both cover HA, so they share one row (displayed
    // under the primary choice's name, "XML HA (HA)") — the aria-label is what
    // actually distinguishes the two buttons within it.
    const haRow = row("XML HA (HA)");
    expect(
      within(haRow).getByRole("button", {
        name: "Open XML HA (HA) in Archaeopteryx",
      }),
    ).toBeInTheDocument();
    expect(
      within(haRow).getByRole("button", {
        name: "Open Auspice HA (HA) in Auspice",
      }),
    ).toBeInTheDocument();
  });

  it("uses Archaeopteryx and Auspice labels and filters mixed choices", async () => {
    const user = userEvent.setup();
    render(
      <ViralTreePicker
        block={block}
        nextstrainInventory={{
          status: "ready",
          ids: new Set(["Influenza-A-Virus/H3N2/HA"]),
        }}
        onOpen={vi.fn()}
      />,
    );

    expect(screen.getAllByText("Archaeopteryx").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Auspice").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("radio", { name: /Auspice/ }));
    expect(screen.queryByText("XML HA (HA)")).not.toBeInTheDocument();
    expect(screen.getByText("Auspice HA (HA)")).toBeInTheDocument();
    expect(screen.getByText("Missing NA (NA)")).toBeInTheDocument();
  });

  it("renders every non-segmented tree for the same viewer", () => {
    render(
      <ViralTreePicker
        block={{
          groups: [
            {
              key: "ebola",
              title: "Ebola",
              nextstrain: [
                { name: "100 samples", path: "Orthoebolavirus/100" },
                { name: "500 samples", path: "Orthoebolavirus/500" },
              ],
            },
          ],
        }}
        nextstrainInventory={{
          status: "ready",
          ids: new Set(["Orthoebolavirus/100", "Orthoebolavirus/500"]),
        }}
        onOpen={vi.fn()}
      />,
    );

    expect(screen.getByText("100 samples")).toBeInTheDocument();
    expect(screen.getByText("500 samples")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /in Auspice/ })).toHaveLength(
      2,
    );
  });

  it("does not show a viewer filter for an Archaeopteryx-only block", () => {
    render(
      <ViralTreePicker
        block={{
          groups: [
            {
              key: "xml",
              title: "XML",
              archaeopteryx: [{ name: "Only XML", path: "/tree.xml" }],
            },
          ],
        }}
        nextstrainInventory={{ status: "ready", ids: new Set() }}
        onOpen={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole("radio", { name: /Auspice/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Only XML")).toBeInTheDocument();
  });

  it("disables viewer and segment options that have no trees for the chosen strain", async () => {
    const user = userEvent.setup();
    render(
      <ViralTreePicker
        block={mixedBlock}
        nextstrainInventory={{
          status: "ready",
          ids: new Set(["Influenza-A-Virus/H3N2/NA"]),
        }}
        onOpen={vi.fn()}
      />,
    );

    // Base UI renders these as <span role="radio"> with aria-disabled, not a
    // natively disabled input, so assert on the ARIA state.
    const auspice = screen.getByRole("radio", { name: /Auspice/ });
    expect(auspice).not.toHaveAttribute("aria-disabled", "true");

    await user.click(screen.getByRole("radio", { name: /H5N1/ }));
    // H5N1 has no Auspice trees, and only PB2 among the segments.
    expect(auspice).toHaveAttribute("aria-disabled", "true");
    expect(
      screen.getByRole("radio", { name: /Archaeopteryx/ }),
    ).not.toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("checkbox", { name: /PB2/ })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
    for (const segment of ["HA", "NA"]) {
      expect(
        screen.getByRole("checkbox", { name: new RegExp(`^${segment}`) }),
      ).toHaveAttribute("aria-disabled", "true");
    }

    // A disabled option must also be inert, not merely styled.
    await user.click(auspice);
    expect(auspice).toHaveAttribute("aria-checked", "false");

    // Strain is never disabled, so the cascade can relax the viewer rather
    // than locking the user into a dead end.
    await user.click(screen.getByRole("radio", { name: /All strains/ }));
    await user.click(screen.getByRole("radio", { name: /Auspice/ }));
    expect(screen.getByRole("radio", { name: /H5N1/ })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("re-enables options and keeps the segment list stable as filters change", async () => {
    const user = userEvent.setup();
    render(
      <ViralTreePicker
        block={mixedBlock}
        nextstrainInventory={{ status: "ready", ids: new Set() }}
        onOpen={vi.fn()}
      />,
    );

    // Trailing count is a separate span; drop it to compare the labels alone.
    const segmentNames = () =>
      screen.getAllByRole("checkbox").map((box) =>
        [...(box.parentElement?.childNodes ?? [])]
          .filter((node) => node.nodeType === Node.TEXT_NODE)
          .map((node) => node.textContent?.trim())
          .join(""),
      );
    const before = segmentNames();
    expect(before).toEqual(["PB2", "HA", "NA"]);

    // Options are disabled, never removed — the list must not reflow under the
    // cursor when a filter narrows the results.
    await user.click(screen.getByRole("radio", { name: /H5N1/ }));
    expect(segmentNames()).toEqual(before);

    // And clearing the filter brings them back enabled.
    await user.click(screen.getByRole("radio", { name: /All strains/ }));
    for (const box of screen.getAllByRole("checkbox")) {
      expect(box).not.toHaveAttribute("aria-disabled", "true");
    }
    expect(screen.getByRole("radio", { name: /Auspice/ })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("does not disable a checked segment when another filter narrows the set", async () => {
    const user = userEvent.setup();
    render(
      <ViralTreePicker
        block={mixedBlock}
        nextstrainInventory={{ status: "ready", ids: new Set() }}
        onOpen={vi.fn()}
      />,
    );

    // Segments are a union, so counting one must ignore the others; checking HA
    // must not zero out NA and strand the user on a single segment.
    await user.click(screen.getByRole("checkbox", { name: /^HA/ }));
    const na = screen.getByRole("checkbox", { name: /^NA/ });
    expect(na).not.toHaveAttribute("aria-disabled", "true");

    await user.click(na);
    expect(screen.getByRole("checkbox", { name: /^HA/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(na).toHaveAttribute("aria-checked", "true");
  });

  it("leaves a dead viewer slot inert when its segment is disabled", async () => {
    const user = userEvent.setup();
    render(
      <ViralTreePicker
        block={mixedBlock}
        nextstrainInventory={{ status: "ready", ids: new Set() }}
        onOpen={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("radio", { name: /H5N1/ }));
    const ha = screen.getByRole("checkbox", { name: /^HA/ });
    expect(ha).toHaveAttribute("aria-disabled", "true");

    await user.click(ha);
    expect(ha).toHaveAttribute("aria-checked", "false");
    // Result list unchanged: the dead-end click did nothing.
    expect(screen.getByText("XML PB2 (PB2)")).toBeInTheDocument();
  });

  it("hides the viewer filter entirely when only one viewer exists", () => {
    render(
      <ViralTreePicker
        block={{
          groups: [
            {
              key: "xml",
              title: "XML",
              archaeopteryx: [
                { name: "A (HA)", path: "/a.xml" },
                { name: "B (NA)", path: "/b.xml" },
              ],
            },
          ],
        }}
        nextstrainInventory={{ status: "ready", ids: new Set() }}
        onOpen={vi.fn()}
      />,
    );

    // A single-viewer block has nothing to disable — the fieldset is dropped
    // rather than rendered with one permanently-zero option.
    expect(
      screen.queryByRole("radio", { name: /Archaeopteryx/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("radio", { name: /All viewers/ }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole("checkbox")).toHaveLength(2);
  });

  it("scrolls the sidebar and grid independently at lg so filters stay pinned", () => {
    const { container } = render(
      <ViralTreePicker
        block={block}
        nextstrainInventory={{ status: "ready", ids: new Set() }}
        onOpen={vi.fn()}
      />,
    );

    // jsdom has no layout, so assert the class contract instead of geometry;
    // e2e/tests/organisms/auspice.spec.ts measures the real scroll behaviour.
    const grid = container.querySelector(
      "div.grid.lg\\:grid-cols-\\[260px_1fr\\]",
    );
    const aside = container.querySelector("aside");
    const results = grid?.lastElementChild;

    expect(grid).toHaveClass("lg:overflow-hidden");
    expect(container.querySelector("main")).not.toBeInTheDocument();
    for (const column of [aside, results]) {
      expect(column).toHaveClass("lg:min-h-0", "lg:overflow-y-auto");
    }
  });

  it("shows unavailable metadata without adding an interactive control", () => {
    const { container } = render(
      <ViralTreePicker
        block={{
          groups: [
            {
              key: "nextstrain",
              title: "Nextstrain",
              nextstrain: [
                { name: "Orthoebolavirus 100", path: "Orthoebolavirus/100" },
              ],
            },
          ],
        }}
        nextstrainInventory={{
          status: "ready",
          ids: new Set(["Orthoebolavirus/100"]),
        }}
        onOpen={vi.fn()}
      />,
    );

    expect(container.querySelector(".lucide-circle-off")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(
      screen.queryByRole("button", { name: /download metadata/i }),
    ).not.toBeInTheDocument();
  });

  it("keeps metadata downloads independent from viewer activation", () => {
    const onOpen = vi.fn();
    render(
      <ViralTreePicker
        block={block}
        nextstrainInventory={{ status: "ready", ids: new Set() }}
        onOpen={onOpen}
      />,
    );

    fireEvent.click(
      screen.getByRole("link", { name: "Download metadata for XML HA (HA)" }),
    );
    expect(onOpen).not.toHaveBeenCalled();
  });
});
