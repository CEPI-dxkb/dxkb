import { render, screen } from "@testing-library/react";
import { DetailKeyValueTable, type DetailField } from "../detail-key-value";

describe("DetailKeyValueTable", () => {
  it("shows an empty-state message when every field is unset", () => {
    const fields: DetailField[] = [
      { label: "Empty", value: undefined },
      { label: "Null", value: null },
      { label: "Blank", value: "" },
    ];
    render(<DetailKeyValueTable fields={fields} />);
    expect(screen.getByText("None available")).toBeInTheDocument();
  });

  it("renders a plain string value with no special treatment", () => {
    render(
      <DetailKeyValueTable fields={[{ label: "Name", value: "Test Genome" }]} />,
    );
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Test Genome")).toBeInTheDocument();
  });

  it("formats an ISO date string when format is 'date'", () => {
    render(
      <DetailKeyValueTable
        fields={[
          { label: "Inserted", value: "2024-01-15T00:00:00Z", format: "date" },
        ]}
      />,
    );
    expect(screen.queryByText("2024-01-15T00:00:00Z")).not.toBeInTheDocument();
  });

  it("auto-detects an ISO date string even without an explicit format", () => {
    render(
      <DetailKeyValueTable
        fields={[{ label: "Modified", value: "2024-06-01T12:00:00Z" }]}
      />,
    );
    expect(screen.queryByText("2024-06-01T12:00:00Z")).not.toBeInTheDocument();
  });

  it("invokes a custom render function instead of the default text path", () => {
    render(
      <DetailKeyValueTable
        fields={[
          {
            label: "Link",
            value: "100.1",
            render: () => <a href="/genome/100.1">100.1</a>,
          },
        ]}
      />,
    );
    expect(screen.getByRole("link", { name: "100.1" })).toHaveAttribute(
      "href",
      "/genome/100.1",
    );
  });

  it("filters out unset fields but keeps visible ones", () => {
    render(
      <DetailKeyValueTable
        fields={[
          { label: "Hidden", value: undefined },
          { label: "Visible", value: "shown" },
        ]}
      />,
    );
    expect(screen.queryByText("Hidden")).not.toBeInTheDocument();
    expect(screen.getByText("Visible")).toBeInTheDocument();
    expect(screen.getByText("shown")).toBeInTheDocument();
  });

  it("renders falsy-but-defined values such as 0 and false", () => {
    render(
      <DetailKeyValueTable
        fields={[
          { label: "Count", value: 0 },
          { label: "Flag", value: false },
        ]}
      />,
    );
    expect(screen.getByText("Count")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.getByText("Flag")).toBeInTheDocument();
    expect(screen.getByText("false")).toBeInTheDocument();
  });
});
