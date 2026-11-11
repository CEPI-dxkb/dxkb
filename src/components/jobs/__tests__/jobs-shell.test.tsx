import { fireEvent, render, screen } from "@testing-library/react";
import { createUiPreferencesWrapper } from "@/test-helpers/react";
import {
  panelShares,
  pressOnSeparator,
  stubResizableGeometry,
} from "@/test-helpers/resizable";
import { JobsShell } from "../jobs-shell";

// The library sizes the group as the sum of its panels' widths (every element at 800px makes it
// 1600px), which keeps every split inside the details panel's 110–600px limits.
stubResizableGeometry(800);

// clearMocks is set but not restoreMocks; restore here so a failing assertion cannot leave
// document.cookie spied.
afterEach(() => {
  vi.restoreAllMocks();
});

function renderShell(wrapper = createUiPreferencesWrapper()) {
  return render(
    <JobsShell actionBar={<span>Actions</span>} detailsPanel={<span>Job</span>}>
      <span>Jobs table</span>
    </JobsShell>,
    { wrapper },
  );
}

describe("JobsShell layout persistence", () => {
  it("keeps today's default split", () => {
    renderShell();
    expect(panelShares()).toStrictEqual(["78.947", "21.053"]);
  });

  it("restores the saved split", () => {
    renderShell(
      createUiPreferencesWrapper({
        jobsPanelLayout: { "jobs-main": 70, "jobs-details": 30 },
      }),
    );
    expect(panelShares()).toStrictEqual(["70", "30"]);
  });

  it("saves a user resize", () => {
    const cookieSpy = vi.spyOn(document, "cookie", "set");
    renderShell(
      createUiPreferencesWrapper({
        jobsPanelLayout: { "jobs-main": 70, "jobs-details": 30 },
      }),
    );
    pressOnSeparator("ArrowLeft");
    expect(panelShares()).toStrictEqual(["65", "35"]);
    expect(cookieSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        `dxkb-jobs-panel-layout=${encodeURIComponent('{"jobs-main":65,"jobs-details":35}')}`,
      ),
    );
  });

  it("reopens at the saved width after the user drags the panel shut", () => {
    const cookieSpy = vi.spyOn(document, "cookie", "set");
    renderShell(
      createUiPreferencesWrapper({
        jobsPanelLayout: { "jobs-main": 70, "jobs-details": 30 },
      }),
    );
    pressOnSeparator("ArrowLeft");
    pressOnSeparator("End");
    expect(panelShares()).toStrictEqual(["100", "0"]);
    const layoutWrites = cookieSpy.mock.calls
      .map(([value]) => value.split(";")[0])
      .filter((pair) => pair.startsWith("dxkb-jobs-panel-layout="));
    expect(layoutWrites).toStrictEqual([
      `dxkb-jobs-panel-layout=${encodeURIComponent('{"jobs-main":65,"jobs-details":35}')}`,
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Show" }));
    expect(panelShares()).toStrictEqual(["65", "35"]);
  });
});
