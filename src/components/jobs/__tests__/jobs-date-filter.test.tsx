import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import {
  fromLocalDateParam,
  toLocalDateParam,
} from "@/lib/jobs/jobs-url-state";
import { JobsDateFilter } from "../jobs-date-filter";

const noop = () => undefined;

function filterElement(from?: string, to?: string) {
  return (
    <JobsDateFilter
      dateFrom={from ? fromLocalDateParam(from) : undefined}
      dateTo={to ? fromLocalDateParam(to) : undefined}
      onFilterChange={noop}
    />
  );
}

/** Feeds the picked dates back as props through the URL's day-only form. */
function UrlBackedFilter() {
  const [dates, setDates] = useState<{ from?: Date; to?: Date }>({});
  const viaUrl = (date: Date | undefined) =>
    date ? fromLocalDateParam(toLocalDateParam(date)) : undefined;
  return (
    <JobsDateFilter
      dateFrom={dates.from}
      dateTo={dates.to}
      onFilterChange={(from, to) => {
        setDates({ from: viaUrl(from), to: viaUrl(to) });
      }}
    />
  );
}

function selectedDays() {
  return Array.from(
    document.querySelectorAll('td[data-selected="true"]'),
  ).map((cell) => cell.getAttribute("data-day"));
}

beforeEach(() => {
  // Date only: the calendar opens on September 2026 and user-event's timers run.
  vi.useFakeTimers({ toFake: ["Date"], now: new Date(2026, 8, 15, 12) });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("JobsDateFilter applied filter", () => {
  it.each([
    ["a range", "2026-09-01", "2026-09-10", "Between Sep 1, 2026 → Sep 10, 2026"],
    ["a single day", "2026-09-05", "2026-09-05", "On Sep 5, 2026"],
    ["a start only", "2026-09-01", undefined, "On or after Sep 1, 2026"],
    ["an end only", undefined, "2026-09-10", "On or before Sep 10, 2026"],
  ])("shows %s from the props on a fresh mount", (_case, from, to, label) => {
    render(filterElement(from, to));

    expect(screen.getByRole("button", { name: label })).toBeVisible();
    // The trigger and the clear button.
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });

  it("shows All dates, inactive, with no dates", () => {
    render(filterElement());

    expect(screen.getByRole("button", { name: "All dates" })).toBeVisible();
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("goes back to All dates when the props are cleared", () => {
    const view = render(filterElement("2026-09-01", "2026-09-10"));

    view.rerender(filterElement());

    expect(screen.getByRole("button", { name: "All dates" })).toBeVisible();
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("follows the props when they change from outside", () => {
    const view = render(filterElement("2026-09-01", "2026-09-10"));

    // Back to an earlier range, then Forward again.
    view.rerender(filterElement("2026-08-03", "2026-08-07"));
    expect(
      screen.getByRole("button", { name: "Between Aug 3, 2026 → Aug 7, 2026" }),
    ).toBeVisible();

    view.rerender(filterElement("2026-09-01", "2026-09-10"));
    expect(
      screen.getByRole("button", { name: "Between Sep 1, 2026 → Sep 10, 2026" }),
    ).toBeVisible();
  });

  it("selects the applied dates in the calendar", async () => {
    const user = userEvent.setup();
    render(filterElement("2026-09-08", "2026-09-10"));

    await user.click(screen.getByRole("button", { name: /^Between/ }));

    expect(screen.getByRole("combobox")).toHaveTextContent("Between");
    expect(selectedDays()).toEqual(["2026-09-08", "2026-09-09", "2026-09-10"]);
  });

  it("offers the condition it derived for a one-sided filter", async () => {
    const user = userEvent.setup();
    render(filterElement(undefined, "2026-09-10"));

    await user.click(screen.getByRole("button", { name: /^On or before/ }));

    expect(screen.getByRole("combobox")).toHaveTextContent("On or before");
    expect(selectedDays()).toEqual(["2026-09-10"]);
  });

  it("keeps the condition the user picked once the props come back", async () => {
    const user = userEvent.setup();
    render(<UrlBackedFilter />);

    await user.click(screen.getByRole("button", { name: "All dates" }));
    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "Before" }));
    await user.click(
      document.querySelector('button[data-day="2026-09-10"]') as HTMLElement,
    );

    // The props are now the day before (Sep 9); the label is still the user's.
    expect(
      screen.getByRole("button", { name: "Before Sep 10, 2026" }),
    ).toBeVisible();
    expect(screen.getByRole("combobox")).toHaveTextContent("Before");
    expect(selectedDays()).toEqual(["2026-09-10"]);
  });
});

describe("JobsDateFilter across a daylight-saving change", () => {
  // Before/After move the picked day by one, and that day goes into the URL. A
  // day is not always 24 hours long, so the test needs a zone that changes its
  // clocks. Each test file runs in its own process, so this reaches no other file.
  const originalZone = process.env.TZ;

  beforeAll(() => {
    process.env.TZ = "America/Chicago";
  });

  afterAll(() => {
    if (originalZone === undefined) delete process.env.TZ;
    else process.env.TZ = originalZone;
  });

  const day = (date: Date | undefined) =>
    date ? toLocalDateParam(date) : undefined;

  // US clocks went forward on 2026-03-08 and went back on 2026-11-01.
  it.each([
    ["Before", "2026-03-15", "2026-03-09", undefined, "2026-03-08"],
    ["After", "2026-11-15", "2026-11-01", "2026-11-02", undefined],
  ])(
    "moves the picked day by one calendar day for %s",
    async (condition, openOn, picked, expectedFrom, expectedTo) => {
      vi.setSystemTime(fromLocalDateParam(openOn));
      const user = userEvent.setup();
      const onFilterChange =
        vi.fn<(from: Date | undefined, to: Date | undefined) => void>();
      render(
        <JobsDateFilter
          dateFrom={undefined}
          dateTo={undefined}
          onFilterChange={onFilterChange}
        />,
      );

      await user.click(screen.getByRole("button", { name: "All dates" }));
      await user.click(screen.getByRole("combobox"));
      await user.click(await screen.findByRole("option", { name: condition }));
      await user.click(
        document.querySelector(`button[data-day="${picked}"]`) as HTMLElement,
      );

      const [from, to] = onFilterChange.mock.lastCall ?? [];
      expect(day(from)).toBe(expectedFrom);
      expect(day(to)).toBe(expectedTo);
    },
  );
});
