import { render, screen } from "@testing-library/react";

import { InteractionsGraphSkeleton } from "../interactions-graph-skeleton";
import { defaultLayout } from "@/lib/interactions/renderer-capabilities";

describe("InteractionsGraphSkeleton", () => {
  it("shows a loading spinner and copy where the canvas will render", () => {
    render(<InteractionsGraphSkeleton layout={defaultLayout} onLayoutChange={vi.fn()} />);

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("Loading interactions…")).toBeInTheDocument();
  });

  it("renders the real action bar with Export disabled until the graph is ready", () => {
    render(<InteractionsGraphSkeleton layout={defaultLayout} onLayoutChange={vi.fn()} />);

    expect(screen.getByRole("button", { name: /export/i })).toBeDisabled();
  });

  it("renders a full column of placeholder protein rows", () => {
    const { container } = render(
      <InteractionsGraphSkeleton layout={defaultLayout} onLayoutChange={vi.fn()} />,
    );

    const dots = container.querySelectorAll('[data-slot="skeleton"].rounded-full');
    expect(dots).toHaveLength(12);
  });
});
