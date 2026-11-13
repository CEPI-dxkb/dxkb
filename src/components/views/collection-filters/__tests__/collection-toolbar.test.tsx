import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { stubMenuLayout } from "@/test-helpers/menu-layout";
import { settleBackgroundWork } from "@/test-helpers/settle";
import { renderToolbar } from "./fixtures/toolbar-harness";

stubMenuLayout();

const explicitRql = {
  raw: "eq(genome_status,Complete)",
  clauses: ["Genome Status is Complete"],
};

describe("CollectionToolbar advanced query chip", () => {
  it("shows the chip, with no tooltip standing in for the explanation", async () => {
    const user = userEvent.setup();
    renderToolbar({ overrides: { explicitRql } });

    const chip = screen.getByRole("button", {
      name: "Advanced query. Show details",
    });
    // The old chip's tooltip opened on focus and hover (delay 0); give one the
    // chance to mount before asserting there is none.
    act(() => {
      chip.focus();
    });
    await user.hover(chip);
    await settleBackgroundWork();

    expect(document.querySelector("[data-slot='tooltip-content']")).toBeNull();
  });

  it("removes the query without Clear all", async () => {
    const user = userEvent.setup();
    const { spies } = renderToolbar({ overrides: { explicitRql } });

    await user.click(
      screen.getByRole("button", { name: "Remove advanced query" }),
    );

    expect(spies.clearExplicitRql).toHaveBeenCalledTimes(1);
    expect(spies.clearAll).not.toHaveBeenCalled();
  });

  it("omits the chip without an explicit query", () => {
    renderToolbar();

    expect(
      screen.queryByRole("button", { name: /Advanced query/ }),
    ).not.toBeInTheDocument();
  });
});
