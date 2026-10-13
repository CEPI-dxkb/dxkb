import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Blocks, Dna } from "lucide-react";

const { mockHideOnScroll } = vi.hoisted(() => ({
  mockHideOnScroll: vi.fn((): boolean => false),
}));

vi.mock("@/hooks/use-hide-on-scroll", () => ({
  useHideOnScroll: mockHideOnScroll,
}));

import { LandingMobileNav } from "../landing-mobile-nav";
import type { OrganismLandingNavItem } from "@/components/organisms/types";

const items: OrganismLandingNavItem[] = [
  { key: "overview", label: "Overview", icon: <Blocks /> },
  { key: "genomes", label: "Genomes", icon: <Dna /> },
];

function getPillWrapper() {
  return screen.getByRole("button", { name: /Views: Overview/ }).closest("div.fixed");
}

describe("LandingMobileNav", () => {
  beforeEach(() => {
    mockHideOnScroll.mockReturnValue(false);
  });

  it("renders the active view label in the pill trigger", () => {
    render(<LandingMobileNav items={items} activeView="overview" onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Views: Overview" })).toBeInTheDocument();
  });

  it("takes its own heading and shows item counts", async () => {
    render(
      <LandingMobileNav
        items={[{ key: "overview", label: "Genomes", icon: <Dna />, count: "12" }]}
        activeView="overview"
        title="Data types"
        onChange={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Data types: Genomes" }));
    expect(screen.getByRole("dialog", { name: "Data types" })).toHaveTextContent("Genomes12");
  });

  it("opens the sheet with all view options on trigger click", async () => {
    render(<LandingMobileNav items={items} activeView="overview" onChange={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Views: Overview" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getAllByText("Genomes").length).toBeGreaterThan(0);
  });

  it("calls onChange with the selected key and closes the sheet", async () => {
    const onChange = vi.fn();
    render(<LandingMobileNav items={items} activeView="overview" onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Views: Overview" }));
    const [genomesBtn] = screen.getAllByRole("button", { name: /Genomes/ });
    await userEvent.click(genomesBtn);
    expect(onChange).toHaveBeenCalledWith("genomes");
  });

  it("passes open state as forceShow to useHideOnScroll", async () => {
    render(<LandingMobileNav items={items} activeView="overview" onChange={vi.fn()} />);
    expect(mockHideOnScroll).toHaveBeenLastCalledWith(false);
    await userEvent.click(screen.getByRole("button", { name: "Views: Overview" }));
    expect(mockHideOnScroll).toHaveBeenLastCalledWith(true);
  });

  it("applies hidden classes when useHideOnScroll returns true", () => {
    mockHideOnScroll.mockReturnValue(true);
    render(<LandingMobileNav items={items} activeView="overview" onChange={vi.fn()} />);
    const wrapper = getPillWrapper();
    expect(wrapper).toHaveClass("translate-y-24");
    expect(wrapper).toHaveClass("opacity-0");
    expect(wrapper).toHaveClass("pointer-events-none");
  });

  it("removes hidden classes when useHideOnScroll returns false", () => {
    render(<LandingMobileNav items={items} activeView="overview" onChange={vi.fn()} />);
    const wrapper = getPillWrapper();
    expect(wrapper).not.toHaveClass("translate-y-24");
    expect(wrapper).not.toHaveClass("opacity-0");
  });

  it("uses has-focus-visible not focus-within to keep pill visible on keyboard focus (regression guard)", () => {
    // CSS :focus-within fires for any focus, including programmatic focus restoration
    // after a dialog closes (e.g. Radix returning focus to the Sheet trigger on close).
    // This caused scroll-hide to stop working after the user opened and closed the sheet.
    // has-focus-visible only activates for keyboard-driven focus, not click/programmatic focus.
    mockHideOnScroll.mockReturnValue(true);
    render(<LandingMobileNav items={items} activeView="overview" onChange={vi.fn()} />);
    const wrapper = getPillWrapper();
    expect(wrapper?.className).not.toMatch(/\bfocus-within:/);
    expect(wrapper).toHaveClass(
      "has-focus-visible:pointer-events-auto",
      "has-focus-visible:translate-y-0",
      "has-focus-visible:opacity-100",
    );
  });
});

describe("LandingMobileNav — disabled tabs", () => {
  it("renders a disabled tile that cannot be selected", async () => {
    const onChange = vi.fn();
    const disabledItems = [
      { key: "overview", label: "Overview", icon: <Blocks /> },
      { key: "phylogeny", label: "Phylogeny", icon: <Dna />, enabled: false, disabledReason: "No phylogenetic tree available for this taxon." },
    ] as OrganismLandingNavItem[];

    render(<LandingMobileNav items={disabledItems} activeView="overview" onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: /Views:/ }));

    const phylogeny = await screen.findByRole("button", { name: /Phylogeny/ });
    expect(phylogeny).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(phylogeny);
    expect(onChange).not.toHaveBeenCalled();
  });
});
