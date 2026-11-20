import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TooltipProvider } from "@/components/ui/tooltip";
import { StatTile } from "../stat-tile";

function renderTile(props: Partial<React.ComponentProps<typeof StatTile>> = {}) {
  return render(
    <TooltipProvider>
      <StatTile
        id="genomes"
        label="Genomes / Segments"
        value="82,094"
        description="Assembled genome records"
        {...props}
      />
    </TooltipProvider>,
  );
}

describe("StatTile", () => {
  it("is a single link named by label and value when it has an href", () => {
    renderTile({ href: "/taxonomy/1?tab=genomes" });
    const link = screen.getByRole("link", { name: /Genomes \/ Segments\s*82,094/ });
    expect(link).toHaveAttribute("href", "/taxonomy/1?tab=genomes");
    expect(link).toHaveAccessibleDescription("Assembled genome records");
  });

  it("is not a link without an href", () => {
    renderTile();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("uses no native title tooltip", () => {
    const { container } = renderTile({ href: "/x" });
    expect(container.querySelector("[title]")).toBeNull();
  });

  // Base UI's tooltip popup has no `role="tooltip"`, so it is found by slot.
  it("shows the description in a tooltip above the tile on hover", async () => {
    renderTile({ href: "/x" });
    const popupSelector = '[data-slot="tooltip-content"]';
    expect(document.querySelector(popupSelector)).toBeNull();
    await userEvent.hover(screen.getByRole("link"));
    const popup = await screen.findByText("Assembled genome records", {
      selector: popupSelector,
    });
    expect(popup).toHaveAttribute("data-side", "top");
  });

  it("keeps the test id on the card", () => {
    renderTile({ testId: "organism-kpi-count" });
    expect(screen.getByTestId("organism-kpi-count")).toHaveTextContent("82,094");
  });
});
