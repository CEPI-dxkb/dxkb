import { act, render, screen } from "@testing-library/react";
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
    // :focus-within fires on programmatic focus restoration after the sheet closes,
    // which broke scroll-hide; has-focus-visible only matches keyboard focus.
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

describe("LandingMobileNav — controlled sheet", () => {
  it("shows the sheet its owner holds open and reports every change", async () => {
    const onOpenChange = vi.fn();
    const onChange = vi.fn();
    const { rerender } = render(
      <LandingMobileNav
        items={items}
        activeView="overview"
        onChange={onChange}
        open
        onOpenChange={onOpenChange}
      />,
    );
    expect(screen.getByRole("dialog", { name: "Views" })).toBeInTheDocument();

    // A remount (a new instance) opens straight onto the owner's state.
    rerender(
      <LandingMobileNav
        key="remounted"
        items={items}
        activeView="overview"
        onChange={onChange}
        open
        onOpenChange={onOpenChange}
      />,
    );
    expect(screen.getByRole("dialog", { name: "Views" })).toBeInTheDocument();

    const [genomes] = screen.getAllByRole("button", { name: /Genomes/ });
    await userEvent.click(genomes);
    expect(onChange).toHaveBeenCalledWith("genomes");
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it("asks its owner to open the sheet and waits for it", async () => {
    const onOpenChange = vi.fn();
    render(
      <LandingMobileNav
        items={items}
        activeView="overview"
        onChange={vi.fn()}
        open={false}
        onOpenChange={onOpenChange}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Views: Overview" }));
    expect(onOpenChange).toHaveBeenLastCalledWith(true);
    expect(screen.queryByRole("dialog")).toBeNull();
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

describe("LandingMobileNav — disabled tile reasons", () => {
  const disabledItems = [
    { key: "overview", label: "Overview", icon: <Blocks /> },
    {
      key: "experiments",
      label: "Experiments",
      icon: <Dna />,
      enabled: false,
      disabledReason: "No experiments for this taxon.",
    },
  ] as OrganismLandingNavItem[];

  it("states the reason in a status line when a disabled tile is tapped", async () => {
    const onChange = vi.fn();
    render(<LandingMobileNav items={disabledItems} activeView="overview" onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: /Views:/ }));

    await userEvent.click(await screen.findByRole("button", { name: /Experiments/ }));

    expect(screen.getByRole("status")).toHaveTextContent(
      "Experiments: No experiments for this taxon.",
    );
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("states the reason when a disabled tile takes keyboard focus", async () => {
    render(<LandingMobileNav items={disabledItems} activeView="overview" onChange={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /Views:/ }));

    const tile = await screen.findByRole("button", { name: /Experiments/ });
    act(() => {
      tile.focus();
    });

    expect(screen.getByRole("status")).toHaveTextContent("No experiments for this taxon.");
  });

  it("shows no status text until a disabled tile is chosen, and clears it on close", async () => {
    render(<LandingMobileNav items={disabledItems} activeView="overview" onChange={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /Views:/ }));
    expect(screen.getByRole("status")).toBeEmptyDOMElement();

    await userEvent.click(await screen.findByRole("button", { name: /Experiments/ }));
    expect(screen.getByRole("status")).not.toBeEmptyDOMElement();

    await userEvent.keyboard("{Escape}");
    await userEvent.click(screen.getByRole("button", { name: /Views:/ }));
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });
});
