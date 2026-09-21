import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const pushSpy = vi.fn();
const searchParamsRef = { current: new URLSearchParams() };

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushSpy }),
  usePathname: () => "/taxonomy/234",
  useSearchParams: () => searchParamsRef.current,
}));

vi.mock("@tanstack/react-hotkeys", () => ({ useHotkey: vi.fn() }));

import {
  LandingShellClient,
  organismTabCollectionOptionsByView,
} from "../landing-shell-client";

// Derived from the same exhaustive, compiler-enforced record the component
// uses — not a second hand-maintained list — so this can't drift out of
// sync the way the pre-fix code (and an earlier draft of this test) could.
const everyOrganismTabCollectionOptions = Object.values(
  organismTabCollectionOptionsByView,
).filter(
  (options): options is NonNullable<typeof options> => options !== null,
);

const navItems = [
  { key: "overview", label: "Overview", icon: null },
  { key: "genomes", label: "Genomes", icon: null },
] as const;

beforeEach(() => {
  pushSpy.mockClear();
  searchParamsRef.current = new URLSearchParams();
});

it("pushes ?tab= when selecting a non-default view", () => {
  render(
    <LandingShellClient
      displayName="Brucella"
      activeView="overview"
      defaultView="overview"
      navItems={navItems}
    >
      <div />
    </LandingShellClient>,
  );
  screen.getByRole("button", { name: "Genomes" }).click();
  expect(pushSpy).toHaveBeenCalledWith("/taxonomy/234?tab=genomes");
});

it("omits the param when selecting the default view", () => {
  searchParamsRef.current = new URLSearchParams("tab=genomes");
  render(
    <LandingShellClient
      displayName="Brucella"
      activeView="genomes"
      defaultView="overview"
      navItems={navItems}
    >
      <div />
    </LandingShellClient>,
  );
  screen.getByRole("button", { name: "Overview" }).click();
  expect(pushSpy).toHaveBeenCalledWith("/taxonomy/234");
});

it("removes the legacy view parameter while preserving unrelated parameters", async () => {
  searchParamsRef.current = new URLSearchParams("view=overview&open=235&utm_source=test");
  render(
    <LandingShellClient
      displayName="Brucella"
      activeView="overview"
      defaultView="overview"
      navItems={navItems}
    >
      <div />
    </LandingShellClient>,
  );

  await userEvent.click(screen.getByRole("button", { name: "Genomes" }));
  expect(pushSpy).toHaveBeenCalledWith(
    "/taxonomy/234?open=235&utm_source=test&tab=genomes",
  );
});

it("clears a Strain-owned parameter and a stale refine on an unrelated tab switch, while preserving unrelated params (regression for the cross-tab cleanup bug)", async () => {
  // Before this fix, a tab switch only cleared genomeCollectionOptions's own
  // friendly filters (and never "refine" at all), so a Strain-owned value
  // like "strain" — and any leftover refinement — could survive a Genomes ->
  // Overview transition and reactivate on a later tab that recognizes it.
  searchParamsRef.current = new URLSearchParams(
    "strain=H5N1&refine=N034&utm_source=email",
  );
  render(
    <LandingShellClient
      displayName="Brucella"
      activeView="genomes"
      defaultView="overview"
      navItems={navItems}
    >
      <div />
    </LandingShellClient>,
  );

  await userEvent.click(screen.getByRole("button", { name: "Overview" }));

  expect(pushSpy).toHaveBeenCalledWith("/taxonomy/234?utm_source=email");
});

it("clears a friendly filter belonging to every participating organism view on a tab switch", async () => {
  const distinctFriendlyFilterNames = [
    ...new Set(
      everyOrganismTabCollectionOptions.flatMap(
        (options) => options.friendlyFilters?.[0] ?? [],
      ),
    ),
  ];
  expect(distinctFriendlyFilterNames.length).toBeGreaterThan(0);

  const sampleParams = distinctFriendlyFilterNames
    .map((name, index) => `${name}=sample${String(index)}`)
    .concat("utm_source=email")
    .join("&");
  searchParamsRef.current = new URLSearchParams(sampleParams);

  render(
    <LandingShellClient
      displayName="Brucella"
      activeView="genomes"
      defaultView="overview"
      navItems={navItems}
    >
      <div />
    </LandingShellClient>,
  );

  await userEvent.click(screen.getByRole("button", { name: "Overview" }));

  const pushedUrl = pushSpy.mock.calls.at(0)?.[0] as string;
  const pushedParams = new URLSearchParams(pushedUrl.split("?")[1] ?? "");
  for (const name of distinctFriendlyFilterNames) {
    expect(pushedParams.has(name)).toBe(false);
  }
  expect(pushedParams.get("utm_source")).toBe("email");
});

it("does not navigate to a disabled item", async () => {
  render(
    <LandingShellClient
      displayName="Brucella"
      activeView="overview"
      defaultView="overview"
      navItems={[...navItems, { key: "phylogeny", label: "Phylogeny", icon: null, enabled: false }]}
    >
      <div />
    </LandingShellClient>,
  );

  await userEvent.click(screen.getByRole("button", { name: "Phylogeny" }));
  expect(pushSpy).not.toHaveBeenCalled();
});

it("uses the parent flex boundary for both fill and scroll views", () => {
  const { container, rerender } = render(
    <LandingShellClient
      displayName="Brucella"
      activeView="genomes"
      defaultView="overview"
      navItems={navItems}
      layout="fill"
    >
      <div />
    </LandingShellClient>,
  );

  const fillWrapper = container.querySelector("section")?.parentElement;
  expect(fillWrapper).toHaveClass("min-h-0", "flex-1");
  expect(fillWrapper?.className).not.toContain("100dvh");
  expect(container.querySelector(".overflow-hidden")).not.toBeNull();

  rerender(
    <LandingShellClient
      displayName="Brucella"
      activeView="overview"
      defaultView="overview"
      navItems={navItems}
      layout="scroll"
    >
      <div />
    </LandingShellClient>,
  );
  const scrollWrapper = container.querySelector("section")?.parentElement;
  expect(scrollWrapper).toHaveClass("min-h-0", "flex-1");
  expect(scrollWrapper?.className).not.toContain("100dvh");
  expect(container.querySelector(".overflow-y-auto")).not.toBeNull();
});
