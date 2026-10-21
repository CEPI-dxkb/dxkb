import { render, screen } from "@testing-library/react";

vi.mock("../experiment-collection", async () => {
  const { useState } = await import("react");
  return {
    // The first props it mounted with live in state, so a remount shows.
    ExperimentCollection: ({ initialState, activeTab }: { initialState: unknown; activeTab: string }) => {
      const [mountedWith] = useState(() => JSON.stringify(initialState));
      return <div data-testid="state" data-tab={activeTab} data-mounted-with={mountedWith}>{JSON.stringify(initialState)}</div>;
    },
  };
});
import ExperimentCollectionPage from "../page";

describe("Experiment collection route", () => {
  it("parses canonical URL state", async () => {
    render(await ExperimentCollectionPage({ searchParams: Promise.resolve({ keyword: "RNA", taxon_id: "561", page: "2", sort: "exp_id:desc", tab: "biosets" }) }));
    expect(screen.getByTestId("state")).toHaveTextContent('"keyword":"RNA"');
    expect(screen.getByTestId("state")).toHaveTextContent('"taxon_id":["561"]');
    expect(screen.getByTestId("state")).toHaveTextContent('"page":2');
    expect(screen.getByTestId("state")).toHaveAttribute("data-tab", "biosets");
  });

  it("keeps the collection mounted across queries, so its open menus survive a pick", async () => {
    const { rerender } = render(await ExperimentCollectionPage({ searchParams: Promise.resolve({ taxon_id: "561" }) }));
    const collection = screen.getByTestId("state");

    rerender(await ExperimentCollectionPage({ searchParams: Promise.resolve({ taxon_id: "562", page: "2", tab: "biosets" }) }));

    expect(screen.getByTestId("state")).toBe(collection);
    expect(collection).toHaveTextContent('"taxon_id":["562"]');
    expect(collection).toHaveTextContent('"page":2');
    expect(collection).toHaveAttribute("data-tab", "biosets");
    expect(collection.dataset.mountedWith).toContain('"taxon_id":["561"]');
  });
});
