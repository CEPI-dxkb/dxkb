import { render, screen } from "@testing-library/react";
import { MetadataLink, MetadataLinkButton } from "../metadata-link";

describe("MetadataLinkButton", () => {
  // `nativeButton={false}` keeps the accessible role "button" on the anchor
  // rendered underneath.
  it("renders an internal button destination through Next Link", () => {
    render(<MetadataLinkButton href="/genome/1">View</MetadataLinkButton>);
    const button = screen.getByRole("button", { name: "View" });
    expect(button).toHaveAttribute("href", "/genome/1");
    expect(button).not.toHaveAttribute("target");
  });

  it("renders an external button destination as a safe new-tab anchor", () => {
    render(
      <MetadataLinkButton href="https://www.ncbi.nlm.nih.gov/taxonomy/1">
        View
      </MetadataLinkButton>,
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
      <MetadataLinkButton href="//evil.com">View</MetadataLinkButton>,
    );
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders nothing for an unsafe button destination — a javascript: URI", () => {
    const { container } = render(
      <MetadataLinkButton href="javascript:alert(1)">View</MetadataLinkButton>,
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

  it("renders nothing for a protocol-relative //host", () => {
    const { container } = render(
      <MetadataLink href="//evil.com">1</MetadataLink>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing for a bare mailto: URI", () => {
    const { container } = render(
      <MetadataLink href="mailto:someone@example.com">1</MetadataLink>,
    );
    expect(container).toBeEmptyDOMElement();
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
