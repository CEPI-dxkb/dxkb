import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const pushSpy = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushSpy }),
  usePathname: () => "/organisms/bacteria",
  useSearchParams: () => new URLSearchParams(),
}));

import { LandingShellClient } from "@/components/organisms/landing-shell/landing-shell-client";
import { defaultUiPreferences } from "@/lib/ui-preferences/definitions";
import { UiPreferencesProvider } from "@/lib/ui-preferences/provider";
import { EntityViewShell, type EntityViewTab } from "../entity-view-shell";

type TabKey = "summary" | "records" | "history";

const tabs: readonly EntityViewTab<TabKey>[] = [
  { key: "summary", label: "Summary" },
  { key: "records", label: "Records" },
  {
    key: "history",
    label: "History",
    enabled: false,
    disabledReason: "History has not been indexed.",
  },
];

function renderShell(
  layout: "scroll" | "fill" = "scroll",
  activeTab: TabKey = "summary",
) {
  return render(
    <EntityViewShell
      viewLabel="Record View"
      title="Alpha record"
      tabs={tabs}
      activeTab={activeTab}
      defaultTab="summary"
      breadcrumbs={
        <div>
          Collection / <h1>Alpha record</h1>
        </div>
      }
      headerContent={<p>Reference entity</p>}
      metadataSummary={
        <dl>
          <dt>Status</dt>
          <dd>Reviewed</dd>
        </dl>
      }
      metadataActions={<button type="button">Export</button>}
      layout={layout}
    >
      <div>Active content</div>
    </EntityViewShell>,
  );
}

beforeEach(() => {
  pushSpy.mockClear();
  window.history.replaceState(null, "", "/records/alpha");
});

it("renders title, breadcrumbs, header content, metadata, actions, and content", () => {
  renderShell();

  expect(
    screen.getByRole("heading", { level: 1, name: "Alpha record" }),
  ).toBeInTheDocument();
  expect(screen.getByText(/Collection \/$/)).toBeInTheDocument();
  expect(screen.getByText("Reference entity")).toBeInTheDocument();
  expect(screen.getByText("Reviewed")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Export" })).toBeInTheDocument();
  expect(screen.getByText("Active content")).toBeInTheDocument();
});

it("uses the latest browser URL and updates only the tab parameter", async () => {
  const user = userEvent.setup();
  renderShell();
  const desktopNav = screen.getByRole("navigation", { name: "Entity views" });

  window.history.replaceState(
    null,
    "",
    "/records/beta?filter=open&page=2#results",
  );
  await user.click(within(desktopNav).getByRole("button", { name: "Records" }));
  expect(pushSpy).toHaveBeenCalledWith(
    "/records/beta?filter=open&page=2&tab=records#results",
  );

  window.history.replaceState(
    null,
    "",
    "/records/gamma?filter=closed&tab=records&page=3",
  );
  await user.click(
    within(desktopNav).getByRole("button", { name: "Summary" }),
  );
  expect(pushSpy).toHaveBeenLastCalledWith(
    "/records/gamma?filter=closed&page=3",
  );
});

it("drops nested-table params on a tab change and keeps the rest", async () => {
  const user = userEvent.setup();
  renderShell("scroll", "records");
  const desktopNav = screen.getByRole("navigation", { name: "Entity views" });

  window.history.replaceState(
    null,
    "",
    "/records/alpha?tab=records&features.page=2&features.sort=id:desc&source.id=123&keep=1#results",
  );
  await user.click(
    within(desktopNav).getByRole("button", { name: "Summary" }),
  );

  // A page number from one tab's table can't land on another tab's, and a dotted
  // param no nested table owns is carried through like any other.
  expect(pushSpy).toHaveBeenCalledWith(
    "/records/alpha?source.id=123&keep=1#results",
  );
  const pushed = String(pushSpy.mock.calls.at(-1)?.[0]);
  expect(pushed).toContain("keep=1");
  expect(pushed).not.toContain("features.");
});

it("keeps nested-table params when the active tab is chosen again", async () => {
  const user = userEvent.setup();
  renderShell("scroll", "records");
  const desktopNav = screen.getByRole("navigation", { name: "Entity views" });

  window.history.replaceState(
    null,
    "",
    "/records/alpha?tab=records&features.page=2",
  );
  await user.click(within(desktopNav).getByRole("button", { name: "Records" }));

  expect(pushSpy).toHaveBeenCalledWith(
    "/records/alpha?tab=records&features.page=2",
  );
});

it("exposes disabled reasons and prevents disabled navigation", async () => {
  const user = userEvent.setup();
  renderShell();
  const desktopNav = screen.getByRole("navigation", { name: "Entity views" });
  const disabledTab = within(desktopNav).getByRole("button", {
    name: "History",
  });

  expect(disabledTab).toHaveAttribute("aria-disabled", "true");
  expect(disabledTab).toHaveAttribute("title", "History has not been indexed.");
  await user.click(disabledTab);
  expect(pushSpy).not.toHaveBeenCalled();
});

it("provides desktop and mobile navigation with current-tab state", () => {
  renderShell("scroll", "records");

  const desktopNav = screen.getByRole("navigation", { name: "Entity views" });
  expect(
    within(desktopNav).getByRole("button", { name: "Records" }),
  ).toHaveAttribute("aria-current", "page");
  expect(
    screen.getByRole("button", { name: "Views: Records" }),
  ).toBeInTheDocument();
});

it("supports scrolling and bounded fill content regions", () => {
  const { rerender } = renderShell();
  expect(screen.getByTestId("entity-view-scroll-region")).toHaveClass(
    "overflow-y-auto",
  );
  expect(
    screen.getByRole("region", { name: "Record View content" }),
  ).toHaveAttribute("tabindex", "0");

  rerender(
    <EntityViewShell
      viewLabel="Record View"
      title="Alpha"
      tabs={tabs}
      activeTab="records"
      defaultTab="summary"
      layout="fill"
    >
      <div>Table</div>
    </EntityViewShell>,
  );
  expect(screen.getByTestId("entity-view-fill-region")).toHaveClass(
    "min-h-0",
    "overflow-hidden",
  );
  expect(
    screen.queryByTestId("entity-view-scroll-region"),
  ).not.toBeInTheDocument();
});

it("keeps the rail collapsed when moving from an organism page to an entity view", async () => {
  const user = userEvent.setup();
  const { rerender } = render(
    <UiPreferencesProvider initialPreferences={defaultUiPreferences}>
      <LandingShellClient
        displayName="Bacteria"
        activeView="overview"
        defaultView="overview"
        navItems={[{ key: "overview", label: "Overview", icon: null }]}
      >
        <div />
      </LandingShellClient>
    </UiPreferencesProvider>,
  );
  await user.click(
    screen.getByRole("button", { name: "Collapse view navigation" }),
  );

  // Same provider, different shell: what a client navigation to /taxonomy/1386 does.
  rerender(
    <UiPreferencesProvider initialPreferences={defaultUiPreferences}>
      <EntityViewShell
        viewLabel="Taxon"
        title="Bacillus"
        tabs={[{ key: "overview", label: "Overview" }]}
        activeTab="overview"
        defaultTab="overview"
      >
        <div />
      </EntityViewShell>
    </UiPreferencesProvider>,
  );
  expect(
    screen.getByRole("button", { name: "Expand view navigation" }),
  ).toBeInTheDocument();
});
