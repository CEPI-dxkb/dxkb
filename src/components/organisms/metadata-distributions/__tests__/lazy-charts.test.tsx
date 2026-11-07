import { render, screen } from "@testing-library/react";

import {
  LazyAmrBarStackChart,
  LazyBarChart,
  LazyDonutChart,
} from "../lazy-charts";

vi.mock("../bar-chart", () => ({
  BarChart: (props: { title: string }) => (
    <div data-testid="bar-chart">{props.title}</div>
  ),
}));
vi.mock("../donut-chart", () => ({
  DonutChart: (props: { title: string }) => (
    <div data-testid="donut-chart">{props.title}</div>
  ),
}));
vi.mock("../amr-bar-stack-chart", () => ({
  AmrBarStackChart: (props: { title: string }) => (
    <div data-testid="amr-chart">{props.title}</div>
  ),
}));

describe("lazy metadata charts", () => {
  it("renders the bar chart with its props once the import resolves", async () => {
    render(<LazyBarChart title="Collection Year" data={[]} />);
    expect(await screen.findByTestId("bar-chart")).toHaveTextContent(
      "Collection Year",
    );
  });

  it("renders the donut chart with its props once the import resolves", async () => {
    render(<LazyDonutChart title="Host" data={[]} />);
    expect(await screen.findByTestId("donut-chart")).toHaveTextContent("Host");
  });

  it("renders the AMR chart with its props once the import resolves", async () => {
    render(
      <LazyAmrBarStackChart title="AMR" data={{ antibiotics: [] }} />,
    );
    expect(await screen.findByTestId("amr-chart")).toHaveTextContent("AMR");
  });
});
