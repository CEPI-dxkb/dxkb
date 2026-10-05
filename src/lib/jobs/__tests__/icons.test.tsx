import { render } from "@testing-library/react";
import { CirclePlaySpinner } from "../icons";

describe("CirclePlaySpinner", () => {
  it("spins the ring around the viewBox centre and keeps the play triangle still", () => {
    const { container } = render(<CirclePlaySpinner className="size-4" />);
    const svg = container.querySelector("svg");
    const [play, arc] = Array.from(container.querySelectorAll("path"));

    expect(svg).toHaveClass("lucide", "lucide-circle-play-spinner", "size-4");
    expect(play).not.toHaveClass("animate-spin");
    expect(arc).toHaveClass("animate-spin", "origin-center");
  });
});
