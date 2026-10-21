import { render, screen } from "@testing-library/react";
import type { ReactElement } from "react";

vi.mock("../experiment-collection", () => ({
  ExperimentCollection: ({ initialState, activeTab }: { initialState: unknown; activeTab: string }) => <div data-testid="state" data-tab={activeTab}>{JSON.stringify(initialState)}</div>,
}));
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
    const key = async (params: Record<string, string>) => ((await ExperimentCollectionPage({ searchParams: Promise.resolve(params) })) as ReactElement<{ children: ReactElement }>).props.children.key;
    expect(await key({ taxon_id: "561" })).toBeNull();
    expect(await key({ taxon_id: "562", page: "2" })).toBeNull();
  });
});
