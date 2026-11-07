import { act, screen, waitFor } from "@testing-library/react";
import { stubMenuLayout } from "@/test-helpers/menu-layout";
import { renderToolbar } from "./fixtures/toolbar-harness";

stubMenuLayout();

describe("CollectionToolbar custom query badge", () => {
  it("describes the badge for screen readers without the tooltip", () => {
    renderToolbar({ overrides: { hasExplicitRql: true } });

    expect(screen.getByText("Custom query")).toHaveAccessibleDescription(
      "The link carries a hand-written query the filters cannot show. Clear all removes it.",
    );
  });

  it("hides the tooltip popup from screen readers so the explanation is announced once", async () => {
    renderToolbar({ overrides: { hasExplicitRql: true } });

    const badge = screen.getByText("Custom query");
    act(() => {
      badge.focus();
    });
    const popup = await waitFor(() => {
      const found = document.querySelector("[data-slot='tooltip-content']");
      expect(found).not.toBeNull();
      return found as Element;
    });
    expect(popup).toHaveAttribute("aria-hidden", "true");
    expect(popup).toHaveTextContent("hand-written query");
  });

  it("omits the badge without an explicit query", () => {
    renderToolbar();

    expect(screen.queryByText("Custom query")).not.toBeInTheDocument();
  });
});
