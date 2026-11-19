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

describe("CollectionToolbar filter labels", () => {
  // A filter with no definition (the Interactions Graph's focus) has no menu
  // entry to take a label from, so the caller names it.
  const filterLabels = { interactor: "Protein" };
  const focus = { interactor: ["fig|224914.16.peg.635"] };

  it("labels the pill of an undefined filter from filterLabels", () => {
    renderToolbar({ filters: focus, overrides: { filterLabels } });

    expect(
      screen.getByRole("button", {
        name: "Protein: fig|224914.16.peg.635. Edit filter",
      }),
    ).toHaveTextContent("Protein fig|224914.16.peg.635");
    expect(
      screen.queryByRole("button", { name: /^interactor/ }),
    ).not.toBeInTheDocument();
  });

  it("falls back to the field name without a label", () => {
    renderToolbar({ filters: focus });

    expect(
      screen.getByRole("button", {
        name: "interactor: fig|224914.16.peg.635. Edit filter",
      }),
    ).toBeInTheDocument();
  });

  it("prefers a definition's own label", () => {
    renderToolbar({
      filters: { genome_status: ["WGS"] },
      overrides: { filterLabels: { genome_status: "Not this" } },
    });

    expect(
      screen.getByRole("button", { name: "Genome Status: WGS. Edit filter" }),
    ).toBeInTheDocument();
  });

  it("clears the field from the pill's ×", async () => {
    const user = userEvent.setup();
    const { spies } = renderToolbar({
      filters: focus,
      overrides: { filterLabels },
    });

    await user.click(
      screen.getByRole("button", { name: "Clear Protein filter" }),
    );

    expect(spies.setFieldValues).toHaveBeenCalledWith("interactor", []);
    expect(
      screen.queryByRole("button", { name: /Edit filter$/ }),
    ).not.toBeInTheDocument();
  });

  it("removes the pill with Clear all", async () => {
    const user = userEvent.setup();
    const { spies } = renderToolbar({
      filters: focus,
      overrides: { filterLabels },
    });

    await user.click(screen.getByRole("button", { name: "Clear all" }));

    expect(spies.clearAll).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole("button", { name: /Edit filter$/ }),
    ).not.toBeInTheDocument();
  });
});
