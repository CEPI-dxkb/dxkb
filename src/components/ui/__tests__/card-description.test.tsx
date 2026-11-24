import { render, screen } from "@testing-library/react";

import { CardDescription } from "@/components/ui/card";

function classes(element: Element): string[] {
  return (element.getAttribute("class") ?? "").split(/\s+/);
}

describe("CardDescription", () => {
  it("balances its wrapping with the balanced variant, keeping its base and passed classes", () => {
    render(
      <CardDescription variant="balanced" className="text-center">
        x
      </CardDescription>,
    );

    const element = screen.getByText("x");

    expect(classes(element)).toEqual(
      expect.arrayContaining([
        "text-balance",
        "text-center",
        "text-muted-foreground",
      ]),
    );
    expect(element).not.toHaveAttribute("variant");
  });

  it("does not balance without a variant", () => {
    render(<CardDescription className="text-center">x</CardDescription>);

    const element = screen.getByText("x");

    expect(classes(element)).not.toContain("text-balance");
    expect(classes(element)).toEqual(
      expect.arrayContaining(["text-center", "text-muted-foreground"]),
    );
  });
});
