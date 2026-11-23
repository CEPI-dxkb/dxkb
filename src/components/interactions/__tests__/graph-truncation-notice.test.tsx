import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  GraphTruncationNotice,
  graphTruncationReason,
  graphTruncationTitle,
} from "../graph-truncation-notice";

const reason =
  "The graph can't draw them all. Narrow with search or Filters, or use the Table to see every interaction.";

describe("graphTruncationTitle", () => {
  it("names only the limit while the total is not known", () => {
    expect(graphTruncationTitle(10_000)).toBe(
      "Showing the first 10,000 interactions",
    );
  });

  it("names the total beside the limit once it is known", () => {
    expect(graphTruncationTitle(10_000, 46_888)).toBe(
      "Showing the first 10,000 of 46,888 interactions",
    );
  });
});

describe("GraphTruncationNotice", () => {
  it("is a polite status, not an alert", () => {
    render(<GraphTruncationNotice limit={10_000} total={46_888} />);

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("names the limit and the total when the total is known", () => {
    render(<GraphTruncationNotice limit={10_000} total={46_888} />);

    expect(
      within(screen.getByRole("status")).getByText(
        "Showing the first 10,000 of 46,888 interactions",
      ),
    ).toBeInTheDocument();
  });

  it("names only the limit without a total", () => {
    render(<GraphTruncationNotice limit={10_000} />);

    const notice = screen.getByRole("status");
    expect(
      within(notice).getByText("Showing the first 10,000 interactions"),
    ).toBeInTheDocument();
    expect(notice).not.toHaveTextContent(" of ");
  });

  it("offers the reason through a button named for Why", () => {
    render(<GraphTruncationNotice limit={10_000} total={46_888} />);

    const trigger = within(screen.getByRole("status")).getByRole("button", {
      name: /Why/,
    });
    expect(trigger).toHaveTextContent("Why?");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("keeps the reason closed until it is asked for, then says it in one sentence", async () => {
    const user = userEvent.setup();
    render(<GraphTruncationNotice limit={10_000} total={46_888} />);
    expect(screen.queryByText(reason)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Why/ }));

    expect(await screen.findByText(reason)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Why/ })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("names the opened reason by the title beside the trigger", async () => {
    const user = userEvent.setup();
    render(<GraphTruncationNotice limit={10_000} total={46_888} />);

    await user.click(screen.getByRole("button", { name: /Why/ }));

    const popup = await screen.findByRole("dialog", {
      name: "Showing the first 10,000 of 46,888 interactions",
    });
    expect(popup).toHaveTextContent(reason);
  });

  it("closes the reason on Escape and keeps the notice", async () => {
    const user = userEvent.setup();
    render(<GraphTruncationNotice limit={10_000} />);
    await user.click(screen.getByRole("button", { name: /Why/ }));
    expect(await screen.findByText(reason)).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(screen.queryByText(reason)).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Showing the first 10,000 interactions",
    );
  });

  it("exports the sentence the popover shows", () => {
    // The e2e page object and these tests spell the sentence out; this ties the export to it.
    expect(graphTruncationReason).toBe(reason);
  });
});
