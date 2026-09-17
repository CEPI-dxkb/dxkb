import { render, screen } from "@testing-library/react";
import {
  MetadataLink,
  renderMetadataLink,
  renderMetadataLinkButton,
} from "../metadata-link";

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

describe("MetadataLink", () => {
  it("renders an internal href through Next Link (relative, no new-tab attributes)", () => {
    render(<MetadataLink href="/genome/1">1</MetadataLink>);
    const link = screen.getByRole("link", { name: "1" });
    expect(link).toHaveAttribute("href", "/genome/1");
    expect(link).not.toHaveAttribute("target");
  });

  it("renders an external href as a safe new-tab anchor", () => {
    render(
      <MetadataLink href="https://pubmed.ncbi.nlm.nih.gov/12345/">
        12345
      </MetadataLink>,
    );
    const link = screen.getByRole("link", { name: "12345" });
    expect(link).toHaveAttribute(
      "href",
      "https://pubmed.ncbi.nlm.nih.gov/12345/",
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders nothing for an unsafe href", () => {
    const { container } = render(
      <MetadataLink href="javascript:alert(1)">1</MetadataLink>,
    );
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("merges an extra className onto the shared link treatment", () => {
    render(
      <MetadataLink href="/genome/1" className="inline-flex">
        1
      </MetadataLink>,
    );
    const link = screen.getByRole("link", { name: "1" });
    expect(link).toHaveClass("inline-flex");
    expect(link).toHaveClass("text-primary");
    expect(link).toHaveClass("underline");
  });

  it("renders the external indicator only when the destination is external", () => {
    const { rerender } = render(
      <MetadataLink
        href="https://example.com/x"
        externalIndicator={<span data-testid="indicator" />}
      >
        x
      </MetadataLink>,
    );
    expect(screen.getByTestId("indicator")).toBeInTheDocument();

    rerender(
      <MetadataLink
        href="/genome/1"
        externalIndicator={<span data-testid="indicator" />}
      >
        x
      </MetadataLink>,
    );
    expect(screen.queryByTestId("indicator")).not.toBeInTheDocument();
  });
});
