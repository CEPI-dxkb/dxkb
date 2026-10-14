import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Blocks, Dna } from "lucide-react";
import { vi } from "vitest";

import { LandingNav } from "../landing-nav";
import type { OrganismLandingNavItem } from "@/components/organisms/types";

const items: OrganismLandingNavItem[] = [
  { key: "overview", label: "Overview", icon: <Blocks /> },
  { key: "genomes", label: "Genomes", icon: <Dna /> },
];

describe("LandingNav", () => {
  it("renders items and marks the active view", () => {
    render(
      <LandingNav
        items={items}
        activeView="overview"
        collapsed={false}
        onChange={vi.fn()}
        onCollapseToggle={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /Overview/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: /Genomes/ })).toBeInTheDocument();
  });

  it("calls onChange when an item is clicked", async () => {
    const onChange = vi.fn();
    render(
      <LandingNav
        items={items}
        activeView="overview"
        collapsed={false}
        onChange={onChange}
        onCollapseToggle={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /Genomes/ }));

    expect(onChange).toHaveBeenCalledWith("genomes");
  });

  it("hides labels in collapsed mode", () => {
    render(
      <LandingNav
        items={items}
        activeView="overview"
        collapsed
        onChange={vi.fn()}
        onCollapseToggle={vi.fn()}
      />,
    );

    expect(screen.queryByText("Views")).not.toBeInTheDocument();
    expect(screen.getByTitle("Overview")).toBeInTheDocument();
  });

  it("takes its own heading, collapse label and item counts", () => {
    const counted: OrganismLandingNavItem[] = [
      { key: "overview", label: "Genomes", icon: <Dna />, count: "2.2M" },
    ];
    const { rerender } = render(
      <LandingNav
        items={counted}
        activeView="overview"
        title="Data types"
        toggleLabel="data type navigation"
        collapsed={false}
        onChange={vi.fn()}
        onCollapseToggle={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "Data types" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Collapse data type navigation" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Genomes/ })).toHaveTextContent("2.2M");

    rerender(
      <LandingNav
        items={counted}
        activeView="overview"
        title="Data types"
        toggleLabel="data type navigation"
        collapsed
        onChange={vi.fn()}
        onCollapseToggle={vi.fn()}
      />,
    );
    expect(screen.getByTitle("Genomes (2.2M)")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Expand data type navigation" }),
    ).toBeInTheDocument();
  });

  it("does not crash when navigator is undefined (SSR-safe initializer)", () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
    // jsdom defines `navigator` as a configurable getter; we can delete it
    // temporarily to simulate the Node SSR environment.
    Object.defineProperty(globalThis, "navigator", {
      value: undefined,
      configurable: true,
    });

    try {
      expect(() =>
        render(
          <LandingNav
            items={items}
            activeView="overview"
            collapsed={false}
            onChange={vi.fn()}
            onCollapseToggle={vi.fn()}
          />,
        ),
      ).not.toThrow();
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(globalThis, "navigator", originalDescriptor);
      }
    }
  });
});

const withDisabled: OrganismLandingNavItem[] = [
  { key: "overview", label: "Overview", icon: <Blocks /> },
  { key: "phylogeny", label: "Phylogeny", icon: <Dna />, enabled: false, disabledReason: "No phylogenetic tree available for this taxon." },
];

describe("LandingNav — disabled tabs", () => {
  it("marks a disabled item with aria-disabled and does not fire onChange", async () => {
    const onChange = vi.fn();
    render(
      <LandingNav items={withDisabled} activeView="overview" collapsed={false} onChange={onChange} onCollapseToggle={vi.fn()} />,
    );
    const phylogeny = screen.getByRole("button", { name: /Phylogeny/ });
    expect(phylogeny).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(phylogeny);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("shows disabledReason as title when collapsed (carryover bug fix)", () => {
    render(
      <LandingNav items={withDisabled} activeView="overview" collapsed onChange={vi.fn()} onCollapseToggle={vi.fn()} />,
    );
    // The wrapping span carries the aria-label with the reason when collapsed + disabled
    expect(screen.getByLabelText(/No phylogenetic tree available/)).toBeInTheDocument();
  });
});
