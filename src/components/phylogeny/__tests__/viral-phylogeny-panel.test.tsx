const { useNextstrainInventory, useViralFamily, useViralTreeXml } = vi.hoisted(
  () => ({
    useNextstrainInventory: vi.fn(),
    useViralFamily: vi.fn(),
    useViralTreeXml: vi.fn(),
  }),
);

vi.mock("../use-phylogeny-data", () => ({
  useNextstrainInventory,
  useViralFamily,
  useViralTreeXml,
}));
vi.mock("../archaeopteryx-phylogeny", () => ({
  ArchaeopteryxPhylogeny: ({ title }: { title: string }) => (
    <div>Archaeopteryx: {title}</div>
  ),
}));

import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";

import { ViralPhylogenyPanel } from "../viral-phylogeny-panel";

// Segment suffixes matter: a row is keyed by (strain, segment), and a row's
// own displayed name is its primary (first) choice — so when Archaeopteryx and
// Auspice cover the same segment, "Auspice HA (HA)" never appears as row text,
// only inside that peer button's aria-label. Locate rows by "XML HA (HA)" (the
// primary choice) and buttons within them by aria-label.
const family = {
  groups: [
    {
      key: "h3n2",
      title: "H3N2",
      archaeopteryx: [{ name: "XML HA (HA)", path: "/tree.xml" }],
      nextstrain: [
        { name: "Auspice HA (HA)", path: "Influenza-A-Virus/H3N2/HA" },
        { name: "Missing NA (NA)", path: "Influenza-A-Virus/H3N2/NA" },
      ],
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

beforeEach(() => {
  useViralFamily.mockReturnValue({
    data: family,
    isPending: false,
    isError: false,
  });
  useNextstrainInventory.mockReturnValue({
    data: new Set(["Influenza-A-Virus/H3N2/HA"]),
    isPending: false,
    isError: false,
  });
  useViralTreeXml.mockReturnValue({
    data: "<phyloxml />",
    isPending: false,
    isError: false,
  });
});

describe("ViralPhylogenyPanel", () => {
  it("enables the exact available Auspice button and keeps the missing one inert", () => {
    render(
      <ViralPhylogenyPanel taxonId={2955291} taxonName="Influenza A virus" />,
    );

    const available = within(row("XML HA (HA)")).getByRole("button", {
      name: "Open Auspice HA (HA) in Auspice",
    });
    expect(available).not.toHaveTextContent("Not Available");

    // NA has an Auspice tree that isn't in the inventory (unavailable, not
    // simply absent), so its peer slot carries the "dataset is not available"
    // tooltip rather than the "no tree for this segment" one.
    const missing = within(row("Missing NA (NA)")).getByTitle(
      "Auspice dataset is not available",
    );
    expect(missing).toHaveTextContent("Not Available");
    expect(missing.tagName).toBe("SPAN");
  });

  it("renders a same-origin Auspice iframe without fetching XML", () => {
    render(
      <ViralPhylogenyPanel taxonId={2955291} taxonName="Influenza A virus" />,
    );

    fireEvent.click(
      within(row("XML HA (HA)")).getByRole("button", {
        name: "Open Auspice HA (HA) in Auspice",
      }),
    );

    expect(useViralTreeXml).toHaveBeenLastCalledWith(null);
    expect(
      screen.getByTitle("Auspice phylogeny viewer for Auspice HA (HA)"),
    ).toHaveAttribute("src", "/nextstrain-viewer/Influenza-A-Virus/H3N2/HA");
    expect(
      screen.getByTitle("Auspice phylogeny viewer for Auspice HA (HA)"),
    ).not.toHaveAttribute("sandbox");
    expect(
      screen.getByTitle("Auspice phylogeny viewer for Auspice HA (HA)"),
    ).toHaveClass("min-h-150");
  });

  it("returns focus to the exact button clicked and preserves the Archaeopteryx path", async () => {
    render(
      <ViralPhylogenyPanel taxonId={2955291} taxonName="Influenza A virus" />,
    );

    const auspiceButton = within(row("XML HA (HA)")).getByRole("button", {
      name: "Open Auspice HA (HA) in Auspice",
    });
    fireEvent.click(auspiceButton);
    fireEvent.click(screen.getByRole("button", { name: /back to trees/i }));
    expect(
      screen.queryByTitle(/Auspice phylogeny viewer/),
    ).not.toBeInTheDocument();
    await waitFor(() => {
      expect(
        within(row("XML HA (HA)")).getByRole("button", {
          name: "Open Auspice HA (HA) in Auspice",
        }),
      ).toHaveFocus();
    });

    fireEvent.click(
      within(row("XML HA (HA)")).getByRole("button", {
        name: "Open XML HA (HA) in Archaeopteryx",
      }),
    );
    expect(useViralTreeXml).toHaveBeenLastCalledWith(
      "https://www.bv-brc.org/tree.xml",
    );
    expect(screen.getByText("Archaeopteryx: XML HA (HA)")).toBeInTheDocument();
  });

  it("shows a defensive dead state for an invalid inventoried identifier", () => {
    useViralFamily.mockReturnValue({
      data: {
        groups: [
          {
            key: "invalid",
            title: "Invalid",
            nextstrain: [
              { name: "Invalid dataset", path: "//example.org/tree" },
            ],
          },
        ],
      },
      isPending: false,
      isError: false,
    });
    useNextstrainInventory.mockReturnValue({
      data: new Set(["//example.org/tree"]),
      isPending: false,
      isError: false,
    });

    render(
      <ViralPhylogenyPanel taxonId={2955291} taxonName="Influenza A virus" />,
    );

    const invalid = within(row("Invalid dataset")).getByTitle(
      "Auspice dataset is not available",
    );
    expect(invalid).toHaveTextContent("Not Available");
    expect(
      screen.queryByTitle(/Auspice phylogeny viewer/),
    ).not.toBeInTheDocument();
  });

  it("renders family loading, error, and empty states", () => {
    useViralFamily.mockReturnValue({ isPending: true, isError: false });
    const { rerender } = render(
      <ViralPhylogenyPanel taxonId={2955291} taxonName="Influenza A virus" />,
    );
    expect(
      document.querySelector('[data-slot="skeleton"]'),
    ).toBeInTheDocument();

    useViralFamily.mockReturnValue({
      isPending: false,
      isError: true,
      error: new Error("family failed"),
    });
    rerender(
      <ViralPhylogenyPanel taxonId={2955291} taxonName="Influenza A virus" />,
    );
    expect(screen.getByText("Viral trees could not be loaded")).toBeInTheDocument();

    useViralFamily.mockReturnValue({
      isPending: false,
      isError: false,
      data: { groups: [] },
    });
    rerender(
      <ViralPhylogenyPanel taxonId={2955291} taxonName="Influenza A virus" />,
    );
    expect(screen.getByText("No published trees")).toBeInTheDocument();
  });

  // TanStack resets a query without data to pending, error cleared, the moment
  // it refetches; these drive the panel through that answer by hand.
  it("keeps a family failure up, retrying, until Retry answers", () => {
    const refetch = vi.fn();
    const error = new Error(
      "The BV-BRC phylogeny tree service did not respond (timed out after 2 s).",
    );
    useViralFamily.mockReturnValue({
      isPending: false,
      isError: true,
      isFetching: false,
      error,
      refetch,
    });
    const { rerender } = render(
      <ViralPhylogenyPanel taxonId={2955291} taxonName="Influenza A virus" />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalledTimes(1);
    useViralFamily.mockReturnValue({
      isPending: true,
      isError: false,
      isFetching: true,
      error: null,
      refetch,
    });
    rerender(
      <ViralPhylogenyPanel taxonId={2955291} taxonName="Influenza A virus" />,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(error.message);
    expect(
      within(alert).getByRole("button", { name: "Retrying…" }),
    ).toBeDisabled();
    expect(document.querySelector('[data-slot="skeleton"]')).toBeNull();

    useViralFamily.mockReturnValue({
      data: family,
      isPending: false,
      isError: false,
      isFetching: false,
      error: null,
      refetch,
    });
    rerender(
      <ViralPhylogenyPanel taxonId={2955291} taxonName="Influenza A virus" />,
    );

    expect(screen.queryByRole("alert")).toBeNull();
    expect(row("XML HA (HA)")).toBeInTheDocument();
  });

  it("keeps a tree failure up, retrying, until Retry answers", () => {
    const refetch = vi.fn();
    const error = new Error(
      "The BV-BRC phylogeny tree service is unavailable (HTTP 503 Service Unavailable).",
    );
    useViralTreeXml.mockReturnValue({
      isPending: false,
      isError: true,
      isFetching: false,
      error,
      refetch,
    });
    const { rerender } = render(
      <ViralPhylogenyPanel taxonId={2955291} taxonName="Influenza A virus" />,
    );
    fireEvent.click(
      within(row("XML HA (HA)")).getByRole("button", {
        name: "Open XML HA (HA) in Archaeopteryx",
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalledTimes(1);
    useViralTreeXml.mockReturnValue({
      isPending: true,
      isError: false,
      isFetching: true,
      error: null,
      refetch,
    });
    rerender(
      <ViralPhylogenyPanel taxonId={2955291} taxonName="Influenza A virus" />,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("This tree could not be loaded");
    expect(alert).toHaveTextContent(error.message);
    expect(
      within(alert).getByRole("button", { name: "Retrying…" }),
    ).toBeDisabled();
    expect(document.querySelector('[data-slot="skeleton"]')).toBeNull();
  });

  it.each([
    [
      "pending",
      { data: undefined, isPending: true, isError: false },
      "Checking Auspice dataset availability...",
      "Auspice dataset availability has not been confirmed",
      "Checking Availability",
    ],
    [
      "failed",
      {
        data: undefined,
        isPending: false,
        isError: true,
        error: new Error("inventory failed"),
      },
      "Auspice dataset availability could not be checked: inventory failed",
      "Auspice dataset availability could not be confirmed",
      "Availability Unconfirmed",
    ],
  ])(
    "keeps Archaeopteryx usable while inventory is %s",
    (_name, inventory, message, title, availability) => {
      useNextstrainInventory.mockReturnValue(inventory);

      render(
        <ViralPhylogenyPanel taxonId={2955291} taxonName="Influenza A virus" />,
      );

      expect(screen.getByText(message)).toBeInTheDocument();
      const haRow = row("XML HA (HA)");
      expect(within(haRow).getByTitle(title)).toHaveTextContent(availability);
      expect(
        within(haRow).getByRole("button", {
          name: "Open XML HA (HA) in Archaeopteryx",
        }),
      ).toBeInTheDocument();
    },
  );

  it("shows confirmed absence only after an empty successful inventory", () => {
    useNextstrainInventory.mockReturnValue({
      data: new Set(),
      isPending: false,
      isError: false,
    });

    render(
      <ViralPhylogenyPanel taxonId={2955291} taxonName="Influenza A virus" />,
    );

    expect(
      within(row("XML HA (HA)")).getByTitle("Auspice dataset is not available"),
    ).toHaveTextContent("Not Available");
  });
});
