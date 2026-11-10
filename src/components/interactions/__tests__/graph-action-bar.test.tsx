import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { GraphActionBar } from "../graph-action-bar";
import { defaultLayout } from "@/lib/interactions/renderer-capabilities";

const selectionProps = {
  activeSubgraph: null,
  activeHub: null,
  onSelectSubgraphs: vi.fn(),
  onSelectHubs: vi.fn(),
};

describe("GraphActionBar", () => {
  it("disables Export and does not invoke onExport while the canvas is not ready", async () => {
    const user = userEvent.setup();
    const onExport = vi.fn();

    render(
      <GraphActionBar
        layout={defaultLayout}
        onLayoutChange={vi.fn()}
        onExport={onExport}
        exportReady={false}
        {...selectionProps}
      />,
    );

    const exportButton = screen.getByRole("button", { name: "Export" });
    expect(exportButton).toBeDisabled();

    await user.click(exportButton);
    expect(onExport).not.toHaveBeenCalled();
  });

  it("enables Export and invokes onExport once the canvas is ready", async () => {
    const user = userEvent.setup();
    const onExport = vi.fn();

    render(
      <GraphActionBar
        layout={defaultLayout}
        onLayoutChange={vi.fn()}
        onExport={onExport}
        exportReady
        {...selectionProps}
      />,
    );

    const exportButton = screen.getByRole("button", { name: "Export" });
    expect(exportButton).toBeEnabled();

    await user.click(exportButton);
    expect(onExport).toHaveBeenCalledTimes(1);
  });

  it("offers legacy subgraph thresholds and reports the selected value", async () => {
    const user = userEvent.setup();
    const onSelectSubgraphs = vi.fn();
    render(
      <GraphActionBar
        layout={defaultLayout}
        onLayoutChange={vi.fn()}
        onExport={vi.fn()}
        activeSubgraph={null}
        activeHub={null}
        onSelectSubgraphs={onSelectSubgraphs}
        onSelectHubs={vi.fn()}
        exportReady
      />,
    );

    await user.click(screen.getByRole("button", { name: "Sub-Graph" }));
    await user.click(screen.getByRole("button", { name: "Largest Subgraph" }));
    expect(onSelectSubgraphs).toHaveBeenCalledWith("max");
  });

  it("offers legacy hub thresholds and reports the selected value", async () => {
    const user = userEvent.setup();
    const onSelectHubs = vi.fn();
    render(
      <GraphActionBar
        layout={defaultLayout}
        onLayoutChange={vi.fn()}
        onExport={vi.fn()}
        activeSubgraph={null}
        activeHub={null}
        onSelectSubgraphs={vi.fn()}
        onSelectHubs={onSelectHubs}
        exportReady
      />,
    );

    await user.click(screen.getByRole("button", { name: "Hub Protein" }));
    await user.click(
      screen.getByRole("button", { name: "10 or More Neighbors" }),
    );
    expect(onSelectHubs).toHaveBeenCalledWith(10);
  });

  it("shows the active preset on its trigger and marks it selected in the menu", async () => {
    const user = userEvent.setup();
    render(
      <GraphActionBar
        layout={defaultLayout}
        activeSubgraph={10}
        activeHub={null}
        onLayoutChange={vi.fn()}
        onExport={vi.fn()}
        onSelectSubgraphs={vi.fn()}
        onSelectHubs={vi.fn()}
        exportReady
      />,
    );

    const trigger = screen.getByRole("button", { name: "10 or More Nodes" });
    expect(trigger).toHaveClass("bg-secondary");
    await user.click(trigger);
    expect(
      screen.getByRole("button", { name: "10 or More Nodes", pressed: true }),
    ).toBeInTheDocument();
  });

  it("shows the human-readable layout label on the trigger, not the raw value", () => {
    // Without items={layoutLabels}, base-ui's Select.Value renders the raw value ("forceatlas2")
    // instead of the label.
    render(
      <GraphActionBar
        layout="forceatlas2"
        onLayoutChange={vi.fn()}
        onExport={vi.fn()}
        exportReady
        {...selectionProps}
      />,
    );

    const trigger = screen.getByRole("combobox", { name: "Layout" });
    expect(trigger).toHaveTextContent("Force Atlas 2");
    expect(trigger).not.toHaveTextContent("forceatlas2");
  });

  it("reflects the controlled layout prop on the trigger", () => {
    render(
      <GraphActionBar
        layout="circular"
        onLayoutChange={vi.fn()}
        onExport={vi.fn()}
        exportReady
        {...selectionProps}
      />,
    );

    expect(screen.getByRole("combobox", { name: "Layout" })).toHaveTextContent(
      "Circular",
    );
  });
});
