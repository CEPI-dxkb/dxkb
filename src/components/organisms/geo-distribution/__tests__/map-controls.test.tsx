import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { stateViewUnavailableReason } from "../county-availability";
import { MapControls } from "../map-controls";
import type { GeoMapState } from "../types";

const worldState: GeoMapState = {
  view: "world",
  selectedStateFips: null,
  selectedStateName: null,
};

function renderControls(
  overrides: Partial<React.ComponentProps<typeof MapControls>> = {},
) {
  const props = {
    mapState: worldState,
    stateOptions: [{ fips: "17", name: "Illinois" }],
    stateViewAvailable: true,
    countryOptions: ["Brazil", "Germany", "Italy"],
    onViewChange: vi.fn(),
    onSelectState: vi.fn(),
    onZoomToCountry: vi.fn(),
    ...overrides,
  };
  render(<MapControls {...props} />);
  return props;
}

const countrySelect = () =>
  screen.queryByRole("combobox", { name: "Zoom to country" });

describe("MapControls State pill", () => {
  function renderPills(stateViewAvailable: boolean) {
    const onViewChange = vi.fn();
    renderControls({
      mapState: { ...worldState, view: "us" },
      stateOptions: [],
      stateViewAvailable,
      onViewChange,
    });
    return onViewChange;
  }

  it("opens the State view when county data exists", () => {
    const onViewChange = renderPills(true);
    const pill = screen.getByRole("button", { name: "State" });

    expect(pill).toBeEnabled();
    expect(pill).not.toHaveAccessibleDescription(stateViewUnavailableReason);
    fireEvent.click(pill);

    expect(onViewChange).toHaveBeenCalledWith("state");
  });

  it("is disabled and described when there is no county data", () => {
    const onViewChange = renderPills(false);
    const pill = screen.getByRole("button", { name: "State" });

    expect(pill).toBeDisabled();
    expect(pill).toHaveAccessibleDescription(stateViewUnavailableReason);
    fireEvent.click(pill);

    expect(onViewChange).not.toHaveBeenCalled();
  });

  it("keeps World and United States usable either way", () => {
    const onViewChange = renderPills(false);

    fireEvent.click(screen.getByRole("button", { name: "World" }));
    fireEvent.click(screen.getByRole("button", { name: "United States" }));

    expect(onViewChange.mock.calls).toEqual([["world"], ["us"]]);
  });
});

describe("MapControls state select", () => {
  const stateOptions = [{ fips: "17", name: "Illinois" }];

  function renderSelect(
    view: "world" | "us" | "state",
    options = stateOptions,
  ) {
    renderControls({
      mapState: {
        view,
        selectedStateFips: view === "state" ? "17" : null,
        selectedStateName: view === "state" ? "Illinois" : null,
      },
      stateOptions: options,
    });
    return screen.getByRole("combobox", { name: "View state" });
  }

  it.each(["world", "us"] as const)(
    "is inert in the %s view, so it leaves the tab order",
    (view) => {
      expect(renderSelect(view).closest("[inert]")).not.toBeNull();
    },
  );

  it("is inert in the State view while there are no state options", () => {
    expect(renderSelect("state", []).closest("[inert]")).not.toBeNull();
  });

  it("is reachable in the State view once state options exist", () => {
    expect(renderSelect("state").closest("[inert]")).toBeNull();
  });
});

describe("MapControls country Select", () => {
  it("shows in the World view, named for assistive tech", () => {
    renderControls();
    expect(countrySelect()).toBeInTheDocument();
    expect(countrySelect()).toHaveTextContent("Zoom to country…");
  });

  it.each(["us", "state"] as const)("is not mounted in the %s view", (view) => {
    renderControls({ mapState: { ...worldState, view } });
    expect(countrySelect()).not.toBeInTheDocument();
  });

  it("is not mounted when no country has data", () => {
    renderControls({ countryOptions: [] });
    expect(countrySelect()).not.toBeInTheDocument();
  });

  it("lists the options and reports the picked name", async () => {
    const user = userEvent.setup();
    const props = renderControls();
    await user.click(screen.getByRole("combobox", { name: "Zoom to country" }));
    expect(
      (await screen.findAllByRole("option")).map((option) => option.textContent),
    ).toEqual(["Brazil", "Germany", "Italy"]);
    await user.click(screen.getByRole("option", { name: "Germany" }));
    expect(props.onZoomToCountry).toHaveBeenCalledWith("Germany");
  });

  it("fires again when the same country is picked twice (value stays cleared)", async () => {
    const user = userEvent.setup();
    const props = renderControls();
    for (let pick = 0; pick < 2; pick += 1) {
      await user.click(screen.getByRole("combobox", { name: "Zoom to country" }));
      await user.click(await screen.findByRole("option", { name: "Germany" }));
    }
    expect(props.onZoomToCountry).toHaveBeenCalledTimes(2);
    expect(countrySelect()).toHaveTextContent("Zoom to country…");
  });
});
