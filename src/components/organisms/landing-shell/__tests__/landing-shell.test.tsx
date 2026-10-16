import { act, render, screen, within } from "@testing-library/react";
import { vi } from "vitest";

vi.mock("next/navigation", async () =>
  (await import("@/test-helpers/history-navigation")).historyNavigationMock({
    pathname: "/organisms/bacteria",
  }),
);

import { useTabContentSearchParams } from "@/components/views/tab-content-search-params";
import { OrganismLandingShell } from "../landing-shell";
import type {
  OrganismLandingConfig,
  OrganismLandingView,
  OrganismViewKey,
} from "@/components/organisms/types";

function Overview() {
  return <div>Overview content</div>;
}

function Genomes() {
  return <div>Genomes content</div>;
}

const config: OrganismLandingConfig = {
  displayName: "Bacteria",
  taxonId: 2,
  accent: "bacteria",
  metadataFields: [],
  defaultView: "overview",
};

const views: OrganismLandingView[] = [
  { key: "overview", label: "Overview", icon: <span />, Component: Overview },
  { key: "genomes", label: "Genomes", icon: <span />, Component: Genomes },
];

beforeEach(() => {
  // The URL outlives a test.
  history.replaceState(null, "", "/organisms/bacteria");
});

function view(key: OrganismViewKey, enabled = true): OrganismLandingView {
  return {
    key,
    label: key,
    icon: null,
    enabled,
    disabledReason: enabled ? undefined : "nope",
    Component: () => <div data-testid={`view-${key}`}>{key} view</div>,
  };
}

describe("OrganismLandingShell — gate-aware tab resolution", () => {
  it("falls back to the default view when ?tab points at a disabled tab", () => {
    render(
      <OrganismLandingShell
        config={{ displayName: "T", taxonId: 1, accent: "all", metadataFields: [], defaultView: "overview" }}
        views={[view("overview"), view("phylogeny", false)]}
        activeViewKey="phylogeny"
        tabParam="phylogeny"
      />,
    );
    // The disabled tab must NOT become the active rendered view.
    expect(screen.queryByTestId("view-phylogeny")).not.toBeInTheDocument();
    expect(screen.getByTestId("view-overview")).toBeInTheDocument();
  });

  it("falls back to first ENABLED view when config.defaultView itself is disabled", () => {
    render(
      <OrganismLandingShell
        config={{ displayName: "T", taxonId: 1, accent: "all", metadataFields: [], defaultView: "phylogeny" }}
        views={[view("phylogeny", false), view("genomes", true)]}
        tabParam={null}
      />,
    );
    // disabled defaultView must NOT be rendered
    expect(screen.queryByTestId("view-phylogeny")).not.toBeInTheDocument();
    // first enabled view must be rendered instead
    expect(screen.getByTestId("view-genomes")).toBeInTheDocument();
  });

  it("opens an enabled tab named by ?tab", () => {
    render(
      <OrganismLandingShell
        config={{ displayName: "T", taxonId: 1, accent: "all", metadataFields: [], defaultView: "overview" }}
        views={[view("overview"), view("genomes", true)]}
        activeViewKey="genomes"
        tabParam="genomes"
      />,
    );
    expect(screen.getByTestId("view-genomes")).toBeInTheDocument();
  });
});

describe("OrganismLandingShell", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the configured default view", () => {
    render(
      <OrganismLandingShell config={config} views={views} tabParam={null} />,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Bacteria" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Overview content")).toBeInTheDocument();
  });

  it("renders the view selected by URL state", () => {
    render(
      <OrganismLandingShell
        config={config}
        views={views}
        activeViewKey="genomes"
        tabParam="genomes"
      />,
    );

    expect(screen.getByText("Genomes content")).toBeInTheDocument();
  });

  it("defaults to expanded navigation", () => {
    render(
      <OrganismLandingShell config={config} views={views} tabParam={null} />,
    );

    const desktopNav = screen.getByRole("navigation", { name: "Organism views" });
    expect(within(desktopNav).getByText("Views")).toBeInTheDocument();
  });
});

describe("OrganismLandingShell — hideDisabledTabs", () => {
  it("removes disabled tabs from the nav when hideDisabledTabs is true", () => {
    render(
      <OrganismLandingShell
        config={{
          displayName: "T",
          taxonId: 1,
          accent: "all",
          metadataFields: [],
          defaultView: "overview",
          hideDisabledTabs: true,
        }}
        views={[view("overview"), view("phylogeny", false)]}
        tabParam={null}
      />,
    );
    expect(screen.queryByRole("button", { name: /phylogeny/i })).not.toBeInTheDocument();
  });

  it("still shows disabled tabs greyed when hideDisabledTabs is false (default)", () => {
    render(
      <OrganismLandingShell
        config={{
          displayName: "T",
          taxonId: 1,
          accent: "all",
          metadataFields: [],
          defaultView: "overview",
        }}
        views={[view("overview"), view("phylogeny", false)]}
        tabParam={null}
      />,
    );
    const desktopNav = screen.getByRole("navigation", { name: "Organism views" });
    expect(
      within(desktopNav).getByRole("button", { name: /phylogeny/i }),
    ).toBeInTheDocument();
  });

  it("renders the first enabled view as active when defaultView is hidden by hideDisabledTabs", () => {
    render(
      <OrganismLandingShell
        config={{
          displayName: "T",
          taxonId: 1,
          accent: "all",
          metadataFields: [],
          defaultView: "phylogeny",
          hideDisabledTabs: true,
        }}
        views={[view("phylogeny", false), view("genomes", true)]}
        tabParam={null}
      />,
    );
    expect(screen.getByTestId("view-genomes")).toBeInTheDocument();
    expect(screen.queryByTestId("view-phylogeny")).not.toBeInTheDocument();
  });
});

describe("OrganismLandingShell — tabParam", () => {
  function SearchProbe() {
    return <output>{useTabContentSearchParams().toString()}</output>;
  }

  const probeViews: OrganismLandingView[] = [
    { key: "overview", label: "Overview", icon: null, Component: Overview },
    {
      key: "genomes",
      label: "Genomes",
      icon: null,
      Component: SearchProbe,
      layout: "fill",
    },
  ];

  function shell(tabParam: string | null) {
    return (
      <OrganismLandingShell
        config={config}
        views={probeViews}
        activeViewKey="genomes"
        tabParam={tabParam}
      />
    );
  }

  it("matches the raw tab, so a legacy ?view= page follows its own URL", () => {
    // A canonical Genomes visit records its search...
    history.replaceState(
      null,
      "",
      "/organisms/bacteria?tab=genomes&collection_year=2025",
    );
    const { rerender } = render(shell("genomes"));

    // ...then Back to a legacy link to the same view: Next keeps the subtree,
    // and the stale frame still holds the leaving search.
    act(() => {
      history.replaceState(null, "", "/organisms/bacteria?view=genomes");
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      "tab=genomes&collection_year=2025",
    );

    // The legacy page opens Genomes without a `tab`, and its content follows
    // the URL, including a nested table's History API write. Forwarding the
    // resolved view ("genomes") instead would hold the old search for good.
    rerender(shell(null));
    expect(screen.getByRole("status")).toHaveTextContent("view=genomes");
    act(() => {
      history.replaceState(
        null,
        "",
        "/organisms/bacteria?view=genomes&collection_year=2024",
      );
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      "view=genomes&collection_year=2024",
    );
  });
});
