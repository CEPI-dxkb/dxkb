import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import type {
  OverviewChartViewType,
  OverviewHiddenCharts,
} from "@/lib/overview-charts";
import { stubMenuLayout } from "@/test-helpers/menu-layout";
import { createUiPreferencesWrapper } from "@/test-helpers/react";
import { ChartVisibilityGrid } from "../chart-visibility-grid";
import { ChartVisibilityMenu } from "../chart-visibility-menu";

stubMenuLayout();

const hiddenChartsCookie = "dxkb-overview-hidden-charts";

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

    renderWithPreference(<ChartVisibilityGrid items={items} />, {
      genome: ["host_group"],
      taxon: ["collection_year"],
    });
    expectShown("host_group", "collection_year", "amr_profile");
  });

  it("omits only the items hidden for its own view type", () => {
    const seeded = { genome: ["host_group"], taxon: [] };

    const { unmount } = renderWithPreference(
      <ChartVisibilityGrid viewType="taxon" items={items} />,
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
    renderWithPreference(<Overview viewType="taxon" />);
    const { user, menu } = await openMenu();

    await user.click(
      within(menu).getByRole("menuitemcheckbox", { name: "Host Group" }),
    );

    expectShown("collection_year", "amr_profile");
    expect(
      screen.getByRole("button", { name: "Charts 2/3 shown, customised" }),
    ).toBeInTheDocument();
    expect(decodeURIComponent(document.cookie)).toContain(
      `${hiddenChartsCookie}={"genome":[],"taxon":["host_group"]}`,
    );
  });

  it("will not hide the last visible chart", async () => {
    renderWithPreference(<Overview viewType="genome" />, {
      genome: ["host_group", "collection_year"],
      taxon: [],
    });
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
    renderWithPreference(<Overview viewType="taxon" />);
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
      `${hiddenChartsCookie}={"genome":[],"taxon":[]}`,
    );
  });

  it("leaves the other view type's charts alone", async () => {
    renderWithPreference(
      <>
        <section aria-label="genome overview">
          <Overview viewType="genome" />
        </section>
        <section aria-label="taxon overview">
          <Overview viewType="taxon" />
        </section>
      </>,
    );
    const genome = within(screen.getByRole("region", { name: "genome overview" }));
    const taxon = within(screen.getByRole("region", { name: "taxon overview" }));
    const user = userEvent.setup();

    await user.click(taxon.getByRole("button", { name: /^Charts 3\/3 shown/ }));
    await user.click(
      within(await screen.findByRole("menu")).getByRole("menuitemcheckbox", {
        name: "Host Group",
      }),
    );

    expect(taxon.queryByTestId("chart-host_group")).not.toBeInTheDocument();
    expect(genome.getByTestId("chart-host_group")).toBeInTheDocument();
    expect(
      genome.getByRole("button", { name: "Charts 3/3 shown" }),
    ).toBeInTheDocument();
  });

  it("ignores ids that no longer name a chart", () => {
    renderWithPreference(<Overview viewType="genome" />, {
      genome: ["gone_field"],
      taxon: [],
    });

    expectShown("host_group", "collection_year", "amr_profile");
    expect(
      screen.getByRole("button", { name: "Charts 3/3 shown" }),
    ).toBeInTheDocument();
  });
});
