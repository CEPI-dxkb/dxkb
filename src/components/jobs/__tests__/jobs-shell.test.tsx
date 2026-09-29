import { fireEvent, render, screen } from "@testing-library/react";
import { createUiPreferencesWrapper } from "@/test-helpers/react";
import {
  panelShares,
  pressOnSeparator,
  stubResizableGeometry,
} from "@/test-helpers/resizable";
import { JobsShell } from "../jobs-shell";

// The library sizes the group as the sum of its panels' widths, so every element at
// 800px makes the group 1600px. That keeps every split below inside the details
// panel's 110–600px limits (21.053% ≈ 337px, 30% = 480px, 35% = 560px): nothing clamps.
stubResizableGeometry(800);

// vitest.config.mts sets clearMocks but not restoreMocks. Restore here so a failing
// assertion cannot leave document.cookie spied for the next test.
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
    // End moves the separator all the way right: a user-attributed collapse, the
    // keyboard twin of dragging the panel shut.
    pressOnSeparator("End");
    expect(panelShares()).toStrictEqual(["100", "0"]);
    // Only the ArrowLeft width was saved; the drag-close never overwrote it with 0.
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
