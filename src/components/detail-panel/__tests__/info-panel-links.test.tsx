import { render, screen } from "@testing-library/react";
import {
  classifyHref,
  renderMetadataLink,
  renderMetadataLinkButton,
  resolveLink,
} from "../info-panel";

describe("resolveLink", () => {
  it("resolves a row-aware placeholder directly from a matching row field", () => {
    expect(
      resolveLink(
        "/genome/{genome_id}",
        { genome_id: "83332.12", genome_name: "M. tuberculosis H37Rv" },
        "genome_name",
      ),
    ).toBe("/genome/83332.12");
  });

  it("falls back to the field's own value for the {value} sentinel", () => {
    expect(
      resolveLink("/genome/{value}", { genome_id: "83332.12" }, "genome_id"),
    ).toBe("/genome/83332.12");
  });

  it("URL-encodes the resolved segment", () => {
    expect(
      resolveLink("/genome/{value}", { genome_id: "100/2" }, "genome_id"),
    ).toBe("/genome/100%2F2");
  });

  it("preserves falsy-but-real primitives such as 0", () => {
    expect(resolveLink("/thing/{value}", { count: 0 }, "count")).toBe(
      "/thing/0",
    );
  });

  it("rejects the link when a row-aware placeholder has no matching field anywhere", () => {
    expect(
      resolveLink(
        "/genome/{genome_id}",
        { unrelated: "x" },
        "unrelated_fallback",
      ),
    ).toBeUndefined();
  });

  it("rejects the link when the resolved value is an empty string", () => {
    expect(
      resolveLink("/genome/{value}", { genome_id: "" }, "genome_id"),
    ).toBeUndefined();
  });

  it("rejects the link when the value is a non-primitive (array/object)", () => {
    expect(
      resolveLink("/genome/{value}", { genome_id: ["a", "b"] }, "genome_id"),
    ).toBeUndefined();
  });

  it("never leaves a literal unresolved {placeholder} in the output", () => {
    const result = resolveLink("/genome/{missing}", {}, "also_missing");
    expect(result === undefined || !result.includes("{")).toBe(true);
  });
});

describe("classifyHref", () => {
  it("classifies a same-origin relative path as internal", () => {
    expect(classifyHref("/genome/123")).toBe("internal");
  });

  it("classifies an absolute http(s) URL as external", () => {
    expect(classifyHref("https://www.ncbi.nlm.nih.gov/taxonomy/1")).toBe(
      "external",
    );
    expect(classifyHref("http://example.com")).toBe("external");
  });

  it("classifies a protocol-relative //host as unsafe, not internal", () => {
    // A browser resolves "//evil.com" as an absolute, cross-origin URL despite
    // the missing scheme — a bare startsWith("/") check would wrongly treat it
    // as same-origin and hand it straight to Link.
    expect(classifyHref("//evil.com")).toBe("unsafe");
  });

  it("classifies a javascript: URI as unsafe, never internal", () => {
    expect(classifyHref("javascript:alert(1)")).toBe("unsafe");
  });

  it("classifies a bare mailto: URI as unsafe", () => {
    expect(classifyHref("mailto:someone@example.com")).toBe("unsafe");
  });

  it("classifies a scheme-less, non-rooted string as unsafe", () => {
    expect(classifyHref("genome/123")).toBe("unsafe");
    expect(classifyHref("")).toBe("unsafe");
  });
});

describe("renderMetadataLink", () => {
  it("renders an internal href through Next Link (relative, no new-tab attributes)", () => {
    render(<>{renderMetadataLink("/genome/1", "1")}</>);
    const link = screen.getByRole("link", { name: "1" });
    expect(link).toHaveAttribute("href", "/genome/1");
    expect(link).not.toHaveAttribute("target");
  });

  it("renders an external href as a safe new-tab anchor", () => {
    render(
      <>{renderMetadataLink("https://www.ncbi.nlm.nih.gov/taxonomy/1", "1")}</>,
    );
    const link = screen.getByRole("link", { name: "1" });
    expect(link).toHaveAttribute(
      "href",
      "https://www.ncbi.nlm.nih.gov/taxonomy/1",
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders nothing for an unsafe href — a protocol-relative //host", () => {
    const { container } = render(<>{renderMetadataLink("//evil.com", "1")}</>);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("renders nothing for an unsafe href — a javascript: URI", () => {
    const { container } = render(
      <>{renderMetadataLink("javascript:alert(1)", "1")}</>,
    );
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("renders nothing for an unsafe href — a bare mailto: URI", () => {
    const { container } = render(
      <>{renderMetadataLink("mailto:someone@example.com", "1")}</>,
    );
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});

describe("renderMetadataLinkButton", () => {
  // `nativeButton={false}` (the same prop every other `Button render={<Link/>}`
  // call site in this codebase sets, e.g. collection-selection-actions.tsx) keeps
  // the accessible role "button" even though the rendered element is an anchor
  // underneath — same href/target/rel contract as renderMetadataLink either way.
  it("renders an internal button destination through Next Link", () => {
    render(<>{renderMetadataLinkButton("/genome/1", "View")}</>);
    const button = screen.getByRole("button", { name: "View" });
    expect(button).toHaveAttribute("href", "/genome/1");
    expect(button).not.toHaveAttribute("target");
  });

  it("renders an external button destination as a safe new-tab anchor", () => {
    render(
      <>
        {renderMetadataLinkButton(
          "https://www.ncbi.nlm.nih.gov/taxonomy/1",
          "View",
        )}
      </>,
    );
    const button = screen.getByRole("button", { name: "View" });
    expect(button).toHaveAttribute(
      "href",
      "https://www.ncbi.nlm.nih.gov/taxonomy/1",
    );
    expect(button).toHaveAttribute("target", "_blank");
    expect(button).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders nothing for an unsafe button destination — a protocol-relative //host", () => {
    const { container } = render(
      <>{renderMetadataLinkButton("//evil.com", "View")}</>,
    );
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders nothing for an unsafe button destination — a javascript: URI", () => {
    const { container } = render(
      <>{renderMetadataLinkButton("javascript:alert(1)", "View")}</>,
    );
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
