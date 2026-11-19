import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Link from "next/link";

import {
  FamilyPathogensDisclosure,
  FamilyPathogensDrawer,
  FamilyPathogensToggle,
  type FamilyPathogenLink,
} from "../family-pathogens-disclosure";

// The toggle's name may end ", +N more"; the panel's is the plain sentence.
const label = /^Major human pathogens in Coronaviridae/;
const pathogens: FamilyPathogenLink[] = [
  { name: "SARS-CoV-2", href: "/taxonomy/2697049" },
  { name: "SARS-CoV", href: "/taxonomy/2901879" },
  { name: "MERS-CoV", href: "/taxonomy/1335626" },
  { name: "Human coronavirus OC43", href: "/taxonomy/31631" },
  { name: "Human coronavirus HKU1", href: "/taxonomy/290028" },
];

function renderCard({
  list = pathogens,
  familyName = "Coronaviridae",
  note,
}: {
  list?: FamilyPathogenLink[];
  familyName?: string;
  note?: string;
} = {}) {
  return render(
    <FamilyPathogensDisclosure>
      <Link href="/taxonomy/11118">View {familyName} genomes</Link>
      <FamilyPathogensToggle familyName={familyName} pathogens={list} />
      <FamilyPathogensDrawer
        familyName={familyName}
        pathogens={list}
        note={note}
      />
    </FamilyPathogensDisclosure>,
  );
}

function panel(name: string | RegExp = label) {
  return screen.queryByRole("group", { name });
}

describe("FamilyPathogensDisclosure", () => {
  it("shows only the toggle until opened", () => {
    renderCard();

    const toggle = screen.getByRole("button", { name: label });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).not.toHaveAttribute("aria-controls");
    expect(panel()).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "SARS-CoV-2" })).toBeNull();
    expect(
      screen.getByRole("link", { name: "View Coronaviridae genomes" }).parentElement,
    ).toHaveAttribute("data-open", "false");
  });

  it("lists each pathogen as a taxon link when the toggle is clicked, and closes on a second click", () => {
    renderCard();
    const toggle = screen.getByRole("button", { name: label });

    fireEvent.click(toggle);

    const open = panel();
    expect(open).toBeInTheDocument();
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(toggle).toHaveAttribute("aria-controls", open?.id);
    expect(
      within(open as HTMLElement).getByRole("link", { name: "SARS-CoV-2" }),
    ).toHaveAttribute("href", "/taxonomy/2697049");
    expect(
      within(open as HTMLElement).getByRole("link", { name: "MERS-CoV" }),
    ).toHaveAttribute("href", "/taxonomy/1335626");
    expect(
      screen.getByRole("link", { name: "View Coronaviridae genomes" }).parentElement,
    ).toHaveAttribute("data-open", "true");

    fireEvent.click(toggle);

    expect(panel()).not.toBeInTheDocument();
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("opens on hover and closes when the pointer leaves", async () => {
    const user = userEvent.setup();
    renderCard();
    const link = screen.getByRole("link", { name: "View Coronaviridae genomes" });

    await user.hover(link);

    expect(await screen.findByRole("group", { name: label })).toBeInTheDocument();

    await user.unhover(link);

    expect(panel()).not.toBeInTheDocument();
  });

  it("opens on keyboard focus without a click", async () => {
    const user = userEvent.setup();
    renderCard();

    await user.tab();

    expect(
      screen.getByRole("link", { name: "View Coronaviridae genomes" }),
    ).toHaveFocus();
    expect(panel()).toBeInTheDocument();

    await user.tab();
    await user.tab();

    expect(screen.getByRole("link", { name: "SARS-CoV-2" })).toHaveFocus();
    expect(panel()).toBeInTheDocument();
  });

  it("closes on Escape and keeps focus on the toggle", async () => {
    const user = userEvent.setup();
    renderCard();
    const toggle = screen.getByRole("button", { name: label });

    await user.click(toggle);
    expect(panel()).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(panel()).not.toBeInTheDocument();
    expect(toggle).toHaveFocus();
  });

  it("closes on Escape while only hovered, with no focus inside", async () => {
    const user = userEvent.setup();
    renderCard();

    await user.hover(
      screen.getByRole("link", { name: "View Coronaviridae genomes" }),
    );
    expect(await screen.findByRole("group", { name: label })).toBeInTheDocument();
    expect(document.body).toHaveFocus();

    await user.keyboard("{Escape}");

    expect(panel()).not.toBeInTheDocument();
  });

  it("keeps a pinned panel open when the pointer leaves, and closes it on a press outside", async () => {
    const user = userEvent.setup();
    renderCard();
    const link = screen.getByRole("link", { name: "View Coronaviridae genomes" });

    await user.click(screen.getByRole("button", { name: label }));
    await user.hover(link);
    await user.unhover(link);

    expect(panel()).toBeInTheDocument();

    fireEvent.pointerDown(document.body);

    expect(panel()).not.toBeInTheDocument();
  });

  it("piles the first three avatars and counts the rest, in the name too", () => {
    renderCard();

    const toggle = screen.getByRole("button", { name: label });
    expect(toggle.querySelectorAll("svg")).toHaveLength(3);
    expect(within(toggle).getByText("+2")).toBeInTheDocument();
    expect(toggle).toHaveAccessibleName(
      "Major human pathogens in Coronaviridae, +2 more",
    );
    expect(
      screen.queryByRole("group", { name: /\+2 more/ }),
    ).not.toBeInTheDocument();
  });

  it("shows no count when every pathogen fits in the pile", () => {
    renderCard({ list: pathogens.slice(0, 3) });

    const toggle = screen.getByRole("button", { name: label });
    expect(toggle.querySelectorAll("svg")).toHaveLength(3);
    expect(within(toggle).queryByText(/^\+/)).toBeNull();
    expect(toggle).toHaveAccessibleName(
      "Major human pathogens in Coronaviridae",
    );
  });

  it("shows a chevron and the note for a family with no pathogens", () => {
    renderCard({
      familyName: "Asfarviridae",
      list: [],
      note: "No known human pathogens. African swine fever virus infects pigs.",
    });
    const asfarLabel = "Major human pathogens in Asfarviridae";
    const toggle = screen.getByRole("button", { name: asfarLabel });

    expect(toggle.querySelectorAll("svg")).toHaveLength(1);

    fireEvent.click(toggle);

    const open = panel(asfarLabel);
    expect(open).toHaveTextContent("No known human pathogens");
    expect(within(open as HTMLElement).queryByRole("list")).toBeNull();
  });

  it("throws a clear error when a part renders outside the wrapper", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() =>
      render(<FamilyPathogensToggle familyName="Coronaviridae" pathogens={[]} />),
    ).toThrow(/inside FamilyPathogensDisclosure/);

    error.mockRestore();
  });
});
