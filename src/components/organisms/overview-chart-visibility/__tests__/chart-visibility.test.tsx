import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import {
  emptyOverviewHiddenCharts,
  type OverviewChartViewType,
  type OverviewHiddenCharts,
} from "@/lib/overview-charts";
import { stubMenuLayout } from "@/test-helpers/menu-layout";
import { createUiPreferencesWrapper } from "@/test-helpers/react";
import { ChartVisibilityGrid } from "../chart-visibility-grid";
import { ChartVisibilityMenu } from "../chart-visibility-menu";

stubMenuLayout();

const hiddenChartsCookie = "dxkb-overview-hidden-charts";
const emptyCookieValue = '{"genome":[],"bacteria":[],"viruses":[],"otherTaxa":[]}';

/** The four-key preference with only the given lists filled in. */
function hiddenCharts(
  lists: Partial<OverviewHiddenCharts>,
): OverviewHiddenCharts {
  return { ...emptyOverviewHiddenCharts(), ...lists };
}

const charts = [
  { id: "host_group", title: "Host Group" },
  { id: "collection_year", title: "Collection Year" },
  { id: "amr_profile", title: "Antimicrobial Resistance Profile" },
];
const items = charts.map(({ id, title }) => ({
  id,
  node: <div data-testid={`chart-${id}`}>{title}</div>,
}));

function Overview({ viewType }: { viewType: OverviewChartViewType }) {
  return (
    <>
      <ChartVisibilityMenu viewType={viewType} charts={charts} />
      <ChartVisibilityGrid viewType={viewType} items={items} />
    </>
  );
}

function renderWithPreference(
  ui: ReactNode,
  overviewHiddenCharts?: OverviewHiddenCharts,
) {
  return render(ui, {
    wrapper: createUiPreferencesWrapper(
      overviewHiddenCharts ? { overviewHiddenCharts } : {},
    ),
  });
}

async function openMenu() {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: /^Charts \d\/3 shown/ }));
  return { user, menu: await screen.findByRole("menu") };
}

function expectShown(...ids: string[]) {
  for (const { id } of charts) {
    if (ids.includes(id)) {
      expect(screen.getByTestId(`chart-${id}`)).toBeInTheDocument();
    } else {
      expect(screen.queryByTestId(`chart-${id}`)).not.toBeInTheDocument();
    }
  }
}

afterEach(() => {
  // The shared setup silences console.error, so a React warning (act, keys) would pass unseen.
  expect(console.error).not.toHaveBeenCalled();
  document.cookie = `${hiddenChartsCookie}=; Path=/; Max-Age=0`;
  vi.restoreAllMocks();
});

describe("ChartVisibilityGrid", () => {
  it("renders every item when nothing is hidden, and without a view type", () => {
    const { unmount } = renderWithPreference(
      <ChartVisibilityGrid viewType="genome" items={items} />,
    );
    expectShown("host_group", "collection_year", "amr_profile");
    unmount();

    renderWithPreference(
      <ChartVisibilityGrid items={items} />,
      hiddenCharts({ genome: ["host_group"], bacteria: ["collection_year"] }),
    );
    expectShown("host_group", "collection_year", "amr_profile");
  });

  it("omits only the items hidden for its own view type", () => {
    const seeded = hiddenCharts({ genome: ["host_group"] });

    const { unmount } = renderWithPreference(
      <ChartVisibilityGrid viewType="bacteria" items={items} />,
      seeded,
    );
    expectShown("host_group", "collection_year", "amr_profile");
    unmount();

    renderWithPreference(
      <ChartVisibilityGrid viewType="genome" items={items} />,
      seeded,
    );
    expectShown("collection_year", "amr_profile");
  });

  it("keeps the grid classes the section used before the menu existed", () => {
    renderWithPreference(<ChartVisibilityGrid items={items} />);

    expect(screen.getByTestId("chart-host_group").parentElement).toHaveClass(
      "grid",
      "grid-cols-1",
      "gap-3",
      "@[640px]:grid-cols-2",
      "@[1080px]:grid-cols-3",
      "@[1600px]:grid-cols-4",
    );
  });
});

describe("ChartVisibilityGrid when every chart is hidden", () => {
  const hiddenEverywhere = hiddenCharts({
    genome: ["host_group", "collection_year", "amr_profile"],
  });
  const emptyText = "All charts are hidden for this view.";

  it("says so, offers the charts back, and draws none, as the menu counts them", () => {
    renderWithPreference(<Overview viewType="genome" />, hiddenEverywhere);

    expect(screen.getByText(emptyText)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Show all charts" }),
    ).toBeEnabled();
    expectShown();
    expect(
      screen.getByRole("button", { name: "Charts 0/3 shown, customised" }),
    ).toBeInTheDocument();
  });

  it("restores every chart from its button and remembers it", async () => {
    const user = userEvent.setup();
    renderWithPreference(<Overview viewType="genome" />, hiddenEverywhere);

    await user.click(screen.getByRole("button", { name: "Show all charts" }));

    expectShown("host_group", "collection_year", "amr_profile");
    expect(screen.queryByText(emptyText)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Show all charts" }),
    ).not.toBeInTheDocument();
    expect(decodeURIComponent(document.cookie)).toContain(
      `${hiddenChartsCookie}=${emptyCookieValue}`,
    );
  });

  it("is not shown for an empty chart list, or without a view type", () => {
    const { unmount } = renderWithPreference(
      <ChartVisibilityGrid viewType="genome" items={[]} />,
      hiddenEverywhere,
    );
    expect(screen.queryByText(emptyText)).not.toBeInTheDocument();
    unmount();

    renderWithPreference(<ChartVisibilityGrid items={items} />, hiddenEverywhere);
    expect(screen.queryByText(emptyText)).not.toBeInTheDocument();
    expectShown("host_group", "collection_year", "amr_profile");
  });

  it("is not shown while a chart of the page is still visible", () => {
    renderWithPreference(
      <ChartVisibilityGrid viewType="genome" items={items.slice(0, 1)} />,
      hiddenCharts({ genome: ["collection_year", "amr_profile"] }),
    );

    expect(screen.queryByText(emptyText)).not.toBeInTheDocument();
    expect(screen.getByTestId("chart-host_group")).toBeInTheDocument();
  });
});

describe("ChartVisibilityMenu", () => {
  it("lists a checked item per chart, under a name that starts with its visible text", async () => {
    renderWithPreference(<Overview viewType="genome" />);

    const trigger = screen.getByRole("button", { name: /^Charts 3\/3 shown/ });
    // axe joins the visible text as is: "Charts3/3" would not match the label's words.
    expect(trigger.textContent).toBe("Charts 3/3");
    expect(trigger).toHaveAccessibleName("Charts 3/3 shown");

    const { menu } = await openMenu();
    const boxes = within(menu).getAllByRole("menuitemcheckbox");
    expect(boxes.map((box) => box.textContent)).toEqual(
      charts.map((chart) => chart.title),
    );
    for (const box of boxes) {
      expect(box).toHaveAttribute("aria-checked", "true");
    }
  });

  it("hides a chart, says so in the trigger, and remembers it in the cookie", async () => {
    renderWithPreference(<Overview viewType="bacteria" />);
    const { user, menu } = await openMenu();

    await user.click(
      within(menu).getByRole("menuitemcheckbox", { name: "Host Group" }),
    );

    expectShown("collection_year", "amr_profile");
    expect(
      screen.getByRole("button", { name: "Charts 2/3 shown, customised" }),
    ).toBeInTheDocument();
    expect(decodeURIComponent(document.cookie)).toContain(
      `${hiddenChartsCookie}={"genome":[],"bacteria":["host_group"],"viruses":[],"otherTaxa":[]}`,
    );
  });

  it("will not hide the last visible chart", async () => {
    renderWithPreference(
      <Overview viewType="genome" />,
      hiddenCharts({ genome: ["host_group", "collection_year"] }),
    );
    const { menu } = await openMenu();

    expect(
      within(menu).getByRole("menuitemcheckbox", {
        name: "Antimicrobial Resistance Profile",
      }),
    ).toHaveAttribute("aria-disabled", "true");
    expect(
      within(menu).getByRole("menuitemcheckbox", { name: "Host Group" }),
    ).not.toHaveAttribute("aria-disabled", "true");
  });

  it("shows all charts again, and only offers to when one is hidden", async () => {
    renderWithPreference(<Overview viewType="bacteria" />);
    const { user, menu } = await openMenu();
    const showAll = within(menu).getByRole("menuitem", {
      name: "Show all charts",
    });
    expect(showAll).toHaveAttribute("aria-disabled", "true");

    await user.click(
      within(menu).getByRole("menuitemcheckbox", { name: "Host Group" }),
    );
    expectShown("collection_year", "amr_profile");
    expect(showAll).not.toHaveAttribute("aria-disabled", "true");

    await user.click(showAll);

    expectShown("host_group", "collection_year", "amr_profile");
    expect(
      screen.getByRole("button", { name: "Charts 3/3 shown" }),
    ).toBeInTheDocument();
    expect(decodeURIComponent(document.cookie)).toContain(
      `${hiddenChartsCookie}=${emptyCookieValue}`,
    );
  });

  it("leaves the other view types' charts alone", async () => {
    renderWithPreference(
      <>
        <section aria-label="genome overview">
          <Overview viewType="genome" />
        </section>
        <section aria-label="bacteria overview">
          <Overview viewType="bacteria" />
        </section>
        <section aria-label="viruses overview">
          <Overview viewType="viruses" />
        </section>
      </>,
    );
    const genome = within(screen.getByRole("region", { name: "genome overview" }));
    const bacteria = within(
      screen.getByRole("region", { name: "bacteria overview" }),
    );
    const viruses = within(
      screen.getByRole("region", { name: "viruses overview" }),
    );
    const user = userEvent.setup();

    await user.click(
      bacteria.getByRole("button", { name: /^Charts 3\/3 shown/ }),
    );
    await user.click(
      within(await screen.findByRole("menu")).getByRole("menuitemcheckbox", {
        name: "Host Group",
      }),
    );

    expect(bacteria.queryByTestId("chart-host_group")).not.toBeInTheDocument();
    expect(viruses.getByTestId("chart-host_group")).toBeInTheDocument();
    expect(
      viruses.getByRole("button", { name: "Charts 3/3 shown" }),
    ).toBeInTheDocument();
    expect(genome.getByTestId("chart-host_group")).toBeInTheDocument();
    expect(
      genome.getByRole("button", { name: "Charts 3/3 shown" }),
    ).toBeInTheDocument();
    // Only the bacteria list changed: the viruses list stays empty in the cookie.
    expect(decodeURIComponent(document.cookie)).toContain(
      `${hiddenChartsCookie}={"genome":[],"bacteria":["host_group"],"viruses":[],"otherTaxa":[]}`,
    );
  });

  it("ignores ids that no longer name a chart", () => {
    renderWithPreference(
      <Overview viewType="genome" />,
      hiddenCharts({ genome: ["gone_field"] }),
    );

    expectShown("host_group", "collection_year", "amr_profile");
    expect(
      screen.getByRole("button", { name: "Charts 3/3 shown" }),
    ).toBeInTheDocument();
  });
});
