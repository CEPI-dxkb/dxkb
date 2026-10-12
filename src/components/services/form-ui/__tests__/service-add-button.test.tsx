import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ArrowRight } from "lucide-react";

import { ServiceAddButton } from "@/components/services/form-ui/service-add-button";

describe("ServiceAddButton", () => {
  it("shows a plus on the soft primary tint the library Add button uses, and adds on click", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<ServiceAddButton aria-label="Add genome group" onClick={onClick} />);

    const button = screen.getByRole("button", { name: "Add genome group" });
    expect(button).toHaveAttribute("data-variant", "soft");
    // A plain button, so it never submits the service form around it.
    expect(button).toHaveAttribute("type", "button");
    expect(button.querySelector("svg.lucide-plus")).not.toBeNull();

    await user.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("never submits its form, even when a spread smuggles in type=submit", async () => {
    const onSubmit = vi.fn((event: React.SyntheticEvent) => {
      event.preventDefault();
    });
    const user = userEvent.setup();
    // `type` is not in the props type; an untyped spread can still carry it.
    const untyped = { type: "submit" } as object;
    render(
      <form onSubmit={onSubmit}>
        <ServiceAddButton aria-label="Add genome" {...untyped} />
      </form>,
    );

    const button = screen.getByRole("button", { name: "Add genome" });
    expect(button).toHaveAttribute("type", "button");
    await user.click(button);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("takes another glyph through icon", () => {
    render(<ServiceAddButton icon={ArrowRight} aria-label="Add metadata field" />);

    const button = screen.getByRole("button", { name: "Add metadata field" });
    expect(button.querySelector("svg.lucide-arrow-right")).not.toBeNull();
    expect(button.querySelector("svg.lucide-plus")).toBeNull();
  });

  it("stays visible but inert while disabled", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <ServiceAddButton aria-label="Add genome" onClick={onClick} disabled />,
    );

    const button = screen.getByRole("button", { name: "Add genome" });
    expect(button).toBeDisabled();
    expect(button).toBeVisible();
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("swaps the icon for a spinner and disables itself while pending", () => {
    render(<ServiceAddButton aria-label="Add genome group" pending />);

    const button = screen.getByRole("button", { name: "Add genome group" });
    expect(button).toBeDisabled();
    expect(
      within(button).getByRole("status", { name: "Loading" }),
    ).toBeInTheDocument();
    expect(button.querySelector("svg.lucide-plus")).toBeNull();
  });
});
