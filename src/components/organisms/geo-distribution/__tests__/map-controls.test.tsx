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
