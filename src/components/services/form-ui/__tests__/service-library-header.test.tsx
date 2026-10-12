import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  ServiceLibraryAddButton,
  ServiceLibraryHeader,
} from "@/components/services/form-ui/service-library-header";

describe("ServiceLibraryHeader", () => {
  it("renders a string title as a service label beside a decorative rule", () => {
    const { container } = render(
      <ServiceLibraryHeader title="Paired Read Library" />,
    );

    const header = container.firstElementChild;
    expect(header).toHaveClass("service-library-header");
    // A direct child of the header, so globals.css drops its `mb-2` and the
    // label shares the row's midline with the rule and the button.
    const label = screen.getByText("Paired Read Library");
    expect(label).toHaveClass("service-card-label");
    expect(label.parentElement).toBe(header);
    const rule = header?.querySelector(".service-library-divider");
    expect(rule).toHaveAttribute("aria-hidden", "true");
  });

  it("renders a node title as given and the action after the rule", () => {
    render(
      <ServiceLibraryHeader title={<span>Custom title</span>}>
        <button type="button">Act</button>
      </ServiceLibraryHeader>,
    );

    const title = screen.getByText("Custom title");
    expect(title).not.toHaveClass("service-card-label");
    const action = screen.getByRole("button", { name: "Act" });
    expect(action.previousElementSibling).toHaveClass("service-library-divider");
  });
});

describe("ServiceLibraryAddButton", () => {
  it("reads Add with an arrow, on the soft primary tint, and adds on click", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <ServiceLibraryAddButton
        aria-label="Add paired read library"
        onClick={onClick}
      />,
    );

    const button = screen.getByRole("button", { name: "Add paired read library" });
    // Visible text, so the button is findable before it is enabled; the
    // accessible name still contains it (WCAG 2.5.3).
    expect(button).toHaveTextContent(/^Add$/);
    expect(button).toHaveAttribute("data-variant", "soft");
    expect(button).toHaveAttribute("type", "button");
    expect(button.querySelector("svg.lucide-chevron-right")).not.toBeNull();

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
        <ServiceLibraryAddButton aria-label="Add paired read library" {...untyped} />
      </form>,
    );

    const button = screen.getByRole("button", { name: "Add paired read library" });
    expect(button).toHaveAttribute("type", "button");
    await user.click(button);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("stays visible but inert while disabled", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <ServiceLibraryAddButton
        aria-label="Add single read library"
        onClick={onClick}
        disabled
      />,
    );

    const button = screen.getByRole("button", { name: "Add single read library" });
    expect(button).toBeDisabled();
    expect(button).toBeVisible();
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("swaps the arrow for a spinner and disables itself while pending", () => {
    render(
      <ServiceLibraryAddButton
        aria-label="Add SRA run accession to selected libraries"
        pending
      />,
    );

    const button = screen.getByRole("button", {
      name: "Add SRA run accession to selected libraries",
    });
    expect(button).toBeDisabled();
    expect(button.querySelector("svg.animate-spin")).not.toBeNull();
    expect(button.querySelector("svg.lucide-chevron-right")).toBeNull();
  });
});
