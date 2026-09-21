import { render, screen } from "@testing-library/react";
import Link from "next/link";
import { OverviewCard, OverviewField } from "../overview-card";
import {
  formatOverviewValue,
  isOverviewValueAvailable,
} from "../overview-value-policy";

describe("isOverviewValueAvailable", () => {
  it("treats null and undefined as unavailable", () => {
    expect(isOverviewValueAvailable(null)).toBe(false);
    expect(isOverviewValueAvailable(undefined)).toBe(false);
  });

  it("treats an empty string as unavailable", () => {
    expect(isOverviewValueAvailable("")).toBe(false);
  });

  it("treats an empty array or an array of blank strings as unavailable", () => {
    expect(isOverviewValueAvailable([])).toBe(false);
    expect(isOverviewValueAvailable(["", "   "])).toBe(false);
  });

  it("treats an array containing only non-primitive items as unavailable", () => {
    expect(isOverviewValueAvailable([{ nested: true }])).toBe(false);
  });

  it("treats a populated non-primitive object as available", () => {
    expect(isOverviewValueAvailable({ a: 1 })).toBe(true);
  });

  it("treats an empty object ({}) as unavailable (no content to serialize)", () => {
    expect(isOverviewValueAvailable({})).toBe(false);
  });

  it("treats a value that JSON-serializes to no content as unavailable", () => {
    // JSON.stringify(a function) returns undefined -- must fall through to unavailable.
    expect(isOverviewValueAvailable(() => undefined)).toBe(false);
  });

  it("treats 0 as available", () => {
    expect(isOverviewValueAvailable(0)).toBe(true);
  });

  it("treats false as available", () => {
    expect(isOverviewValueAvailable(false)).toBe(true);
  });

  it("treats a non-empty string as available", () => {
    expect(isOverviewValueAvailable("hello")).toBe(true);
  });

  it("treats an array with at least one primitive item as available", () => {
    expect(isOverviewValueAvailable(["a", { skip: true }])).toBe(true);
  });
});

describe("formatOverviewValue", () => {
  it("formats null as Not available", () => {
    expect(formatOverviewValue(null)).toBe("Not available");
  });

  it("formats an empty string as Not available", () => {
    expect(formatOverviewValue("")).toBe("Not available");
  });

  it("formats an empty array as Not available", () => {
    expect(formatOverviewValue([])).toBe("Not available");
  });

  it("formats a populated non-primitive object as real JSON (never [object Object])", () => {
    expect(formatOverviewValue({ a: 1, b: "two" })).toBe('{"a":1,"b":"two"}');
  });

  it("formats an empty object ({}) as Not available", () => {
    expect(formatOverviewValue({})).toBe("Not available");
  });

  it("formats a value that JSON-serializes to no content as Not available", () => {
    expect(formatOverviewValue(() => undefined)).toBe("Not available");
  });

  it("formats an array of only non-primitive objects as Not available", () => {
    expect(formatOverviewValue([{ a: 1 }, { b: 2 }])).toBe("Not available");
  });

  it("formats 0 as '0'", () => {
    expect(formatOverviewValue(0)).toBe("0");
  });

  it("formats false as 'false'", () => {
    expect(formatOverviewValue(false)).toBe("false");
  });

  it("formats a scalar array joined by comma-space without blank entries", () => {
    expect(formatOverviewValue(["a", "", "  ", "b", "c"])).toBe("a, b, c");
  });

  it("formats a mixed array by dropping non-primitive items", () => {
    expect(formatOverviewValue(["a", { drop: true }, "c"])).toBe("a, c");
  });

  it("formats a plain string unchanged", () => {
    expect(formatOverviewValue("hello")).toBe("hello");
  });
});

describe("OverviewField", () => {
  it("omits the field for a null value (no empty dt/dd pair)", () => {
    const { container } = render(
      <OverviewField label="Missing" value={null} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("omits the field for an empty string", () => {
    const { container } = render(<OverviewField label="Missing" value="" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("omits the field for an empty array instead of rendering an empty dd", () => {
    const { container } = render(
      <OverviewField label="Accessions" value={[]} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders a populated non-primitive object as real JSON instead of [object Object]", () => {
    render(<OverviewField label="Metadata" value={{ nested: true }} />);
    expect(screen.getByText("Metadata")).toBeInTheDocument();
    expect(screen.getByText('{"nested":true}')).toBeInTheDocument();
  });

  it("omits the field for an empty object ({}) instead of rendering empty braces", () => {
    const { container } = render(<OverviewField label="Metadata" value={{}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders 0 rather than omitting it", () => {
    render(<OverviewField label="Contigs" value={0} />);
    expect(screen.getByText("Contigs")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("renders false rather than omitting it", () => {
    render(<OverviewField label="Flag" value={false} />);
    expect(screen.getByText("Flag")).toBeInTheDocument();
    expect(screen.getByText("false")).toBeInTheDocument();
  });

  it("renders a scalar array joined by comma-space", () => {
    render(<OverviewField label="Tags" value={["alpha", "beta"]} />);
    expect(screen.getByText("alpha, beta")).toBeInTheDocument();
  });

  it("renders an internal link via children when available is true", () => {
    render(
      <OverviewField label="Genome" value="100.1" available>
        <Link href="/genome/100.1">100.1</Link>
      </OverviewField>,
    );
    const link = screen.getByRole("link", { name: "100.1" });
    expect(link).toHaveAttribute("href", "/genome/100.1");
  });

  it("renders an external link via children", () => {
    render(
      <OverviewField label="PubMed" value="12345" available>
        <a
          href="https://pubmed.ncbi.nlm.nih.gov/12345/"
          target="_blank"
          rel="noopener noreferrer"
        >
          12345
        </a>
      </OverviewField>,
    );
    const link = screen.getByRole("link", { name: "12345" });
    expect(link).toHaveAttribute(
      "href",
      "https://pubmed.ncbi.nlm.nih.gov/12345/",
    );
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("honors an explicit available override even when the value itself would be unavailable", () => {
    render(
      <OverviewField label="Taxon ID" value={null} available>
        <span>custom content</span>
      </OverviewField>,
    );
    expect(screen.getByText("custom content")).toBeInTheDocument();
  });

  it("omits the field when available is explicitly false regardless of value", () => {
    const { container } = render(
      <OverviewField label="Taxon ID" value="123" available={false} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("applies a custom className to the dd element", () => {
    render(<OverviewField label="Links" value="x" className="custom-class" />);
    const dd = screen.getByText("x");
    expect(dd.tagName).toBe("DD");
    expect(dd).toHaveClass("custom-class");
  });
});

describe("OverviewCard", () => {
  it("renders the title and children", () => {
    render(
      <OverviewCard title="Assembly summary">
        <p>content</p>
      </OverviewCard>,
    );
    expect(screen.getByText("Assembly summary")).toBeInTheDocument();
    expect(screen.getByText("content")).toBeInTheDocument();
  });

  // There is deliberately no empty-card test here. `OverviewCard` takes opaque
  // `children`, so it cannot know whether the body it was handed is empty; a
  // test that passed it the fallback paragraph and then asserted the paragraph
  // could not fail for any behaviour of this component. Deciding a section is
  // empty belongs to `OverviewSection` (see `overview-section.test.tsx`), and
  // the policy is asserted against real entity overviews in the six
  // `*-overview.test.tsx` suites under `src/app/(views)/`.
});
