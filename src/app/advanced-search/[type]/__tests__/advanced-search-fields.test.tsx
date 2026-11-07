import { render, screen } from "@testing-library/react";
import {
  GeographyCard,
  KeywordCard,
  RangeCard,
} from "../advanced-search-fields";

const noop = () => undefined;

describe("advanced search field cards", () => {
  it("pairs the keyword label with its input", () => {
    render(<KeywordCard value="abc" onChange={noop} />);
    const input = screen.getByLabelText("Keyword", { selector: "input" });
    expect(input).toHaveAttribute("id", "keyword");
    expect(input).toHaveAttribute("placeholder", "Search term");
    expect(input).toHaveValue("abc");
    expect(input).not.toHaveAttribute("type", "number");
  });

  it.each([
    ["collection", "Collection Country", "collection-country"],
    ["isolation", "Isolation Country", "isolation-country"],
  ] as const)("names the %s country field", (country, label, id) => {
    render(
      <GeographyCard
        country={country}
        group=""
        onGroupChange={noop}
        countryValue=""
        onCountryChange={noop}
      />,
    );
    expect(screen.getByLabelText(label)).toHaveAttribute("id", id);
    expect(screen.getByLabelText("Geographic Group")).toHaveAttribute(
      "id",
      "geographic-group",
    );
  });

  it("draws bounded number inputs for a year range", () => {
    render(
      <RangeCard
        kind="year"
        from="2000"
        to="2020"
        onFromChange={noop}
        onToChange={noop}
      />,
    );
    const from = screen.getByLabelText("From");
    const to = screen.getByLabelText("To");
    expect(from).toHaveAttribute("id", "year-from");
    expect(to).toHaveAttribute("id", "year-to");
    for (const input of [from, to]) {
      expect(input).toHaveAttribute("type", "number");
      expect(input).toHaveAttribute("min", "1900");
      expect(input).toHaveAttribute("max", "2100");
    }
    expect(from).toHaveAttribute("placeholder", "e.g. 2010");
    expect(to).toHaveAttribute("placeholder", "e.g. 2024");
  });

  it("draws free-text inputs for a date range", () => {
    render(
      <RangeCard
        kind="date"
        from=""
        to=""
        onFromChange={noop}
        onToChange={noop}
      />,
    );
    const from = screen.getByLabelText("From");
    const to = screen.getByLabelText("To");
    expect(from).toHaveAttribute("id", "date-from");
    expect(to).toHaveAttribute("id", "date-to");
    for (const input of [from, to]) {
      expect(input).not.toHaveAttribute("type", "number");
      expect(input).not.toHaveAttribute("min");
      expect(input).not.toHaveAttribute("max");
      expect(input).toHaveAttribute(
        "placeholder",
        "YYYY or YYYY-MM or YYYY-MM-DD",
      );
    }
  });
});
