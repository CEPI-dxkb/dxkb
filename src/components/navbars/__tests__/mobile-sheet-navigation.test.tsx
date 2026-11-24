import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { MobileSheetNavigation } from "../mobile-sheet-navigation";
import { organismItems } from "../navbar-links";

const props = {
  favoritePaths: ["/alice@bvbrc/home/Favorite Folder"],
  isAuthenticated: true,
  recentFolders: [
    {
      path: "/alice@bvbrc/home/Recent Folder",
      visitedAt: 1,
    },
  ],
  wsUsername: "alice@bvbrc",
};

describe("MobileSheetNavigation", () => {
  it("preserves the navigation landmark and section controls", () => {
    render(<MobileSheetNavigation {...props} />);

    expect(screen.getByRole("navigation")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Organisms9" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.getByRole("button", { name: /Services\d+/ })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.getByRole("button", { name: "Workspace10" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.getByRole("button", { name: "Resources4" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("lists the CEPI taxa, All Viruses, All Bacteria and Browse all in the Organisms section", async () => {
    const user = userEvent.setup();
    render(<MobileSheetNavigation {...props} />);

    await user.click(screen.getByRole("button", { name: "Organisms9" }));

    // Every other section is collapsed, so the navigation's visible links are the Organisms items.
    const links = within(screen.getByRole("navigation")).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual(
      organismItems.map((item) => item.href),
    );
    expect(links.map((link) => link.textContent)).toEqual(
      organismItems.map((item) => item.title),
    );
  });

  it("retains external-link behavior for sheet destinations", async () => {
    const user = userEvent.setup();
    render(<MobileSheetNavigation {...props} />);

    await user.click(screen.getByRole("button", { name: "Resources4" }));

    const docs = screen.getByRole("link", { name: /Documentation/ });
    expect(docs).toHaveAccessibleName(/Documentation \(opens in a new tab\)/);
    expect(docs).toHaveAttribute("target", "_blank");
    expect(docs).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("lists the structure prediction services as external links", async () => {
    const user = userEvent.setup();
    render(<MobileSheetNavigation {...props} />);

    await user.click(screen.getByRole("button", { name: /Services\d+/ }));
    await user.click(
      screen.getByRole("button", { name: "Structure Prediction" }),
    );

    const links = {
      "Protein Structure Prediction": "PredictStructure",
      StabiliNNator: "StabiliNNator",
      FrustraMPNN: "FrustraMPNN",
      "Structure Sequence Prediction": "StructureSequencePrediction",
      "Stability Prediction": "StabilityPrediction",
    };
    for (const [name, appId] of Object.entries(links)) {
      const link = screen.getByRole("link", { name: new RegExp(`^${name}`) });
      expect(link).toHaveAccessibleName(`${name} (opens in a new tab)`);
      expect(link).toHaveAttribute(
        "href",
        `https://www.dxkb.org/app/${appId}`,
      );
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
      expectIconAfterLabel(link, name);
    }
  });

  it("lists Mobile Element Detection under Metagenomics", async () => {
    const user = userEvent.setup();
    render(<MobileSheetNavigation {...props} />);

    await user.click(screen.getByRole("button", { name: /Services\d+/ }));
    await user.click(screen.getByRole("button", { name: "Metagenomics" }));

    const link = screen.getByRole("link", {
      name: /^Mobile Element Detection/,
    });
    expect(link).toHaveAccessibleName(
      "Mobile Element Detection (opens in a new tab)",
    );
    expect(link).toHaveAttribute(
      "href",
      "https://www.dxkb.org/app/MobileElementDetection",
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expectIconAfterLabel(link, "Mobile Element Detection");
  });
});

function expectIconAfterLabel(link: HTMLElement, label: string) {
  const icon = link.querySelector("svg.lucide-external-link");
  expect(icon).toHaveAttribute("aria-hidden", "true");
  const children = Array.from(link.childNodes);
  const labelIndex = children.findIndex((node) => node.textContent === label);
  expect(labelIndex).toBeGreaterThanOrEqual(0);
  expect(children.findIndex((node) => node === icon)).toBeGreaterThan(
    labelIndex,
  );
}
