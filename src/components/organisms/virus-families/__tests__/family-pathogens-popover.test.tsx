import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { FamilyPathogensPopover } from "../family-pathogens-popover";

const pathogens = [
  { name: "SARS-CoV-2", href: "/taxonomy/2697049" },
  { name: "MERS-CoV", href: "/taxonomy/1335626" },
];
const buttonName = "Major human pathogens in Coronaviridae";

describe("FamilyPathogensPopover", () => {
  it("renders nothing but the button until opened", () => {
    render(
      <FamilyPathogensPopover familyName="Coronaviridae" pathogens={pathogens} />,
    );

    expect(screen.getByRole("button", { name: buttonName })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText("SARS-CoV-2")).not.toBeInTheDocument();
  });

  it("lists each pathogen as a taxon link when clicked", async () => {
    render(
      <FamilyPathogensPopover familyName="Coronaviridae" pathogens={pathogens} />,
    );

    fireEvent.click(screen.getByRole("button", { name: buttonName }));

    const dialog = await screen.findByRole("dialog", { name: buttonName });
    expect(
      within(dialog).getByRole("link", { name: "SARS-CoV-2" }),
    ).toHaveAttribute("href", "/taxonomy/2697049");
    expect(
      within(dialog).getByRole("link", { name: "MERS-CoV" }),
    ).toHaveAttribute("href", "/taxonomy/1335626");
  });

  it("shows the note instead of a list when the family has no pathogens", async () => {
    render(
      <FamilyPathogensPopover
        familyName="Asfarviridae"
        pathogens={[]}
        note="No known human pathogens. African swine fever virus infects pigs."
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Major human pathogens in Asfarviridae" }),
    );

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("No known human pathogens");
    expect(within(dialog).queryByRole("list")).not.toBeInTheDocument();
  });

  it("opens on hover", async () => {
    const user = userEvent.setup();
    render(
      <FamilyPathogensPopover familyName="Coronaviridae" pathogens={pathogens} />,
    );

    await user.hover(screen.getByRole("button", { name: buttonName }));

    expect(await screen.findByRole("dialog", { name: buttonName })).toBeInTheDocument();
  });
});
