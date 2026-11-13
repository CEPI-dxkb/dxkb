import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExplicitRqlChip } from "../explicit-rql-chip";

const query = {
  raw: "and(eq(genome_status,Complete),eq(host_name,Human))",
  clauses: ["Genome Status is Complete", "Host Name is Human"],
};

describe("ExplicitRqlChip", () => {
  it("names itself and opens a popover listing the conditions", async () => {
    const user = userEvent.setup();
    render(<ExplicitRqlChip query={query} onClear={vi.fn()} />);

    const trigger = screen.getByRole("button", {
      name: "Advanced query. Show details",
    });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    await user.click(trigger);

    const dialog = await screen.findByRole("dialog", {
      name: "Advanced query",
    });
    expect(dialog).toHaveAccessibleDescription(/Advanced Search/);
    expect(within(dialog).getByText("Genome Status is Complete")).toBeVisible();
    expect(within(dialog).getByText("Host Name is Human")).toBeVisible();
    expect(
      within(dialog).getByRole("button", { name: "Remove query" }),
    ).toBeVisible();
  });

  it("keeps the exact RQL one disclosure away", async () => {
    const user = userEvent.setup();
    render(<ExplicitRqlChip query={query} onClear={vi.fn()} />);
    await user.click(
      screen.getByRole("button", { name: "Advanced query. Show details" }),
    );

    const dialog = await screen.findByRole("dialog", { name: "Advanced query" });
    const summary = within(dialog).getByText("RQL");
    expect(summary.closest("details")).not.toHaveAttribute("open");
    await user.click(summary);
    expect(within(dialog).getByText(query.raw)).toBeVisible();
  });

  it("lists a repeated condition once per occurrence, without a key clash", async () => {
    const user = userEvent.setup();
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    render(
      <ExplicitRqlChip
        query={{
          raw: "and(eq(host_name,Human),eq(host_name,Human))",
          clauses: ["Host Name is Human", "Host Name is Human"],
        }}
        onClear={vi.fn()}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: "Advanced query. Show details" }),
    );

    const dialog = await screen.findByRole("dialog", { name: "Advanced query" });
    expect(within(dialog).getAllByText("Host Name is Human")).toHaveLength(2);
    expect(
      consoleError.mock.calls.some((call) =>
        call.some((arg) => String(arg).includes("same key")),
      ),
    ).toBe(false);
    consoleError.mockRestore();
  });

  it("shows the raw query as written when it could not be read", async () => {
    const user = userEvent.setup();
    render(
      <ExplicitRqlChip
        query={{ raw: "eq(nope,x)", clauses: null }}
        onClear={vi.fn()}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: "Advanced query. Show details" }),
    );

    const dialog = await screen.findByRole("dialog", { name: "Advanced query" });
    expect(within(dialog).getByText("eq(nope,x)")).toBeVisible();
    expect(within(dialog).queryByText("RQL")).not.toBeInTheDocument();
  });

  it("removes the query from the × without opening the popover", async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    render(<ExplicitRqlChip query={query} onClear={onClear} />);

    await user.click(
      screen.getByRole("button", { name: "Remove advanced query" }),
    );

    expect(onClear).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("removes the query from the popover button and closes the popover", async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    render(<ExplicitRqlChip query={query} onClear={onClear} />);
    await user.click(
      screen.getByRole("button", { name: "Advanced query. Show details" }),
    );

    await user.click(
      await screen.findByRole("button", { name: "Remove query" }),
    );

    expect(onClear).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
