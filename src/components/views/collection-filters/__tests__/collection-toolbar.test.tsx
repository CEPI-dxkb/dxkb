import { screen } from "@testing-library/react";
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

  it("omits the badge without an explicit query", () => {
    renderToolbar();

    expect(screen.queryByText("Custom query")).not.toBeInTheDocument();
  });
});
