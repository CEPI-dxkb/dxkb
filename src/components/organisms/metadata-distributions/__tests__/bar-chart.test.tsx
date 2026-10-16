import { fireEvent, render, screen } from "@testing-library/react";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { BarChart } from "../bar-chart";

describe("BarChart", () => {
  it("renders a bar for each valid year, sorted chronologically", () => {
    render(
      <BarChart
        title="Collection Year"
        data={[
          { label: "2020", value: 100 },
          { label: "2018", value: 50 },
          { label: "2022", value: 200 },
        ]}
      />,
    );

    expect(
      screen.getByRole("group", { name: "Collection Year distribution" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("2018: 50")).toBeInTheDocument();
    expect(screen.getByLabelText("2020: 100")).toBeInTheDocument();
    expect(screen.getByLabelText("2022: 200")).toBeInTheDocument();
  });

  it("filters out non-integer labels", () => {
    render(
      <BarChart
        title="Collection Year"
        data={[
          { label: "2020", value: 100 },
          { label: "unknown", value: 50 },
          { label: "", value: 10 },
        ]}
      />,
    );

    expect(screen.getByLabelText("2020: 100")).toBeInTheDocument();
    expect(
      screen.queryByLabelText(/unknown/),
    ).not.toBeInTheDocument();
  });

  it("shows tooltip on hover", () => {
    render(
      <BarChart
        title="Collection Year"
        data={[{ label: "2021", value: 42 }]}
      />,
    );

    fireEvent.mouseMove(screen.getByTestId("chart-overlay"), {
      clientX: 10,
      clientY: 10,
    });

    expect(screen.getByRole("status")).toHaveTextContent("2021: 42");
  });

  it("renders empty state when no valid data", () => {
    render(
      <BarChart
        title="Collection Year"
        data={[{ label: "unknown", value: 5 }]}
      />,
    );

    expect(screen.getByText("No data available")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Collection Year distribution" }),
    ).toBeInTheDocument();
  });

  describe("linked bars", () => {
    beforeEach(() => {
      push.mockClear();
    });

    it("follows the year under the pointer and shows the pointer cursor", () => {
      render(
        <BarChart
          title="Collection Year"
          data={[{ label: "2014", value: 1458, href: "/genomes?year=2014" }]}
        />,
      );
      const overlay = screen.getByTestId("chart-overlay");

      expect(overlay).not.toHaveClass("cursor-pointer");
      fireEvent.mouseMove(overlay, { clientX: 10, clientY: 10 });
      expect(overlay).toHaveClass("cursor-pointer");

      fireEvent.click(overlay, { clientX: 10, clientY: 10 });
      expect(push).toHaveBeenCalledWith("/genomes?year=2014");
    });

    it("exposes each linked bar as a link followed with Enter", () => {
      render(
        <BarChart
          title="Collection Year"
          data={[
            { label: "2014", value: 1458, href: "/genomes?year=2014" },
            { label: "2015", value: 0 },
          ]}
        />,
      );

      fireEvent.keyDown(screen.getByRole("link", { name: "2014: 1,458" }), {
        key: "Enter",
      });
      expect(push).toHaveBeenCalledWith("/genomes?year=2014");
      expect(
        screen.getByRole("graphics-symbol", { name: "2015: 0" }),
      ).toBeInTheDocument();
    });

    it("follows nothing for an unlinked year", () => {
      render(
        <BarChart
          title="Collection Year"
          data={[{ label: "2021", value: 42 }]}
        />,
      );
      const overlay = screen.getByTestId("chart-overlay");

      fireEvent.mouseMove(overlay, { clientX: 10, clientY: 10 });
      fireEvent.click(overlay, { clientX: 10, clientY: 10 });

      expect(overlay).not.toHaveClass("cursor-pointer");
      expect(push).not.toHaveBeenCalled();
    });
  });
});
