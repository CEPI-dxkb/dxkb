import { fireEvent, render, screen } from "@testing-library/react";

import { stateViewUnavailableReason } from "../county-availability";
import { MapControls } from "../map-controls";

function renderControls(stateViewAvailable: boolean) {
  const onViewChange = vi.fn();
  render(
    <MapControls
      mapState={{ view: "us", selectedStateFips: null, selectedStateName: null }}
      stateOptions={[]}
      stateViewAvailable={stateViewAvailable}
      onViewChange={onViewChange}
      onSelectState={vi.fn()}
    />,
  );
  return onViewChange;
}

describe("MapControls State pill", () => {
  it("opens the State view when county data exists", () => {
    const onViewChange = renderControls(true);
    const pill = screen.getByRole("button", { name: "State" });

    expect(pill).toBeEnabled();
    expect(pill).not.toHaveAccessibleDescription(stateViewUnavailableReason);
    fireEvent.click(pill);

    expect(onViewChange).toHaveBeenCalledWith("state");
  });

  it("is disabled and described when there is no county data", () => {
    const onViewChange = renderControls(false);
    const pill = screen.getByRole("button", { name: "State" });

    expect(pill).toBeDisabled();
    expect(pill).toHaveAccessibleDescription(stateViewUnavailableReason);
    fireEvent.click(pill);

    expect(onViewChange).not.toHaveBeenCalled();
  });

  it("keeps World and United States usable either way", () => {
    const onViewChange = renderControls(false);

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
    render(
      <MapControls
        mapState={{
          view,
          selectedStateFips: view === "state" ? "17" : null,
          selectedStateName: view === "state" ? "Illinois" : null,
        }}
        stateOptions={options}
        stateViewAvailable
        onViewChange={vi.fn()}
        onSelectState={vi.fn()}
      />,
    );
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
