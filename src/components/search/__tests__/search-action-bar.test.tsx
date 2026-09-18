import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { SearchActionBar, notReady } from "../search-action-bar";

interface ExpectedAction {
  name: RegExp;
  enabled: boolean;
}

/**
 * Assert the bar rendered exactly these buttons, in this order, with these
 * enabled states. The cases that deliberately assert neither order nor count keep
 * looping over `screen.getByRole` themselves instead of calling this.
 */
function expectActionButtons(expected: readonly ExpectedAction[]) {
  const buttons = screen.getAllByRole("button");
  expect(buttons).toHaveLength(expected.length);
  expected.forEach((action, index) => {
    const button = buttons[index];
    expect(button).toHaveAccessibleName(action.name);
    expect(button).toHaveProperty("disabled", !action.enabled);
  });
}

describe("SearchActionBar (taxonomy)", () => {
  it("uses a horizontal fixed-width action row below md", () => {
    const { container } = render(
      <SearchActionBar selectedCount={1} searchType="taxonomy" />,
    );

    expect(container.firstElementChild).toHaveClass("max-md:flex-row");
    expect(
      screen.getByRole("button", { name: /taxon\s*overview/i }),
    ).toHaveClass("max-md:w-16", "max-md:shrink-0");
  });

  describe("maxSelection", () => {
    it("shows single-select-only actions when exactly one row is selected", () => {
      render(<SearchActionBar selectedCount={1} searchType="taxonomy" />);
      expect(
        screen.queryByRole("button", { name: /taxon\s*overview/i }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /features/i }),
      ).toBeInTheDocument();
    });

    it("hides single-select-only actions when more than one row is selected", () => {
      render(<SearchActionBar selectedCount={2} searchType="taxonomy" />);
      // taxonOverview + features are maxSelection:1 → hidden on multi
      expect(
        screen.queryByRole("button", { name: /taxon\s*overview/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /features/i }),
      ).not.toBeInTheDocument();
      // genomes has no maxSelection → still visible on multi
      expect(
        screen.queryByRole("button", { name: /genomes/i }),
      ).toBeInTheDocument();
    });

    it("hides selection-dependent actions when nothing is selected", () => {
      render(
        <SearchActionBar
          selectedCount={0}
          searchType="taxonomy"
          guideUrl="https://example.test/guide"
        />,
      );
      expect(
        screen.queryByRole("button", { name: /genomes/i }),
      ).not.toBeInTheDocument();
      // Guide is always shown (no selection required)
      expect(
        screen.queryByRole("button", { name: /guide/i }),
      ).toBeInTheDocument();
    });
  });

  describe("disabledActions", () => {
    it("disables an action when the consumer passes a reason for it", () => {
      render(
        <SearchActionBar
          selectedCount={1}
          searchType="taxonomy"
          disabledActions={{ taxonOverview: notReady }}
        />,
      );
      expect(
        screen.getByRole("button", { name: /taxon\s*overview/i }),
      ).toBeDisabled();
    });

    it("leaves an action enabled when no reason is passed for it", () => {
      render(<SearchActionBar selectedCount={1} searchType="taxonomy" />);
      // taxonOverview has no module-level disable and no consumer disable → enabled
      expect(
        screen.getByRole("button", { name: /taxon\s*overview/i }),
      ).not.toBeDisabled();
    });
  });

  describe("genome sequences", () => {
    it("matches the taxon-view sequence actions and availability", async () => {
      const user = userEvent.setup();
      render(
        <SearchActionBar
          selectedCount={1}
          searchType="genome_sequence"
          guideUrl="https://example.test/guide"
          enabledActions={["copyRows", "services", "group", "features"]}
        />,
      );

      const expectedActions = [
        { name: /guide/i, enabled: true },
        { name: /dwnld/i, enabled: true },
        { name: /copy/i, enabled: true },
        { name: /services/i, enabled: true },
        { name: /^ggenome$/i, enabled: true },
        { name: /^ffeatures$/i, enabled: true },
        { name: /group/i, enabled: true },
        // FASTA and Browser wait on a later PR.
        { name: /fasta/i, enabled: false },
        { name: /browser/i, enabled: false },
      ];

      for (const action of expectedActions) {
        const button = screen.getByRole("button", { name: action.name });
        expect(button).toHaveProperty("disabled", !action.enabled);
      }

      await user.hover(screen.getByRole("button", { name: /browser/i }));
      expect(await screen.findAllByText(notReady)).not.toHaveLength(0);
    });

    it("shows the sequence FEATURES action for one selected row", () => {
      render(
        <SearchActionBar
          selectedCount={1}
          searchType="genome_sequence"
          enabledActions={["copyRows", "services", "group", "features"]}
        />,
      );

      expect(
        screen.getByRole("button", { name: /^ffeatures$/i }),
      ).not.toBeDisabled();
    });

    it("hides the sequence FEATURES action above one selected row", () => {
      render(
        <SearchActionBar
          selectedCount={2}
          searchType="genome_sequence"
          enabledActions={["copyRows", "services", "group", "features"]}
        />,
      );

      // FEATURES resolves from the one displayed detail row's sequence_id, so it is
      // maxSelection:1 -> hidden on multi. COPY ROWS has no bound and stays.
      expect(
        screen.queryByRole("button", { name: /^ffeatures$/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /copy rows/i }),
      ).toBeInTheDocument();
    });

    it("keeps the sequence actions disabled where the consumer has no handler", () => {
      render(
        <SearchActionBar
          selectedCount={1}
          searchType="genome_sequence"
          guideUrl="https://example.test/guide"
        />,
      );

      for (const name of [/copy/i, /services/i, /^ffeatures$/i, /group/i]) {
        expect(screen.getByRole("button", { name })).toBeDisabled();
      }
    });
  });

  describe("genome features", () => {
    it("matches the taxon-view feature actions, their order and availability", () => {
      render(
        <SearchActionBar
          selectedCount={1}
          searchType="genome_feature"
          guideUrl="https://example.test/guide"
          enabledActions={["copyRows", "services", "group"]}
        />,
      );

      // Legacy order, minus SUBSYSTEMS and PATHWAYS which DXKB does not carry.
      const expectedActions = [
        { name: /guide/i, enabled: true },
        { name: /dwnld/i, enabled: true },
        { name: /^copy$/i, enabled: true },
        { name: /services/i, enabled: true },
        { name: /^ffeature$/i, enabled: true },
        { name: /^ggenome$/i, enabled: true },
        // FASTA and ID MAP wait on a later PR.
        { name: /fasta/i, enabled: false },
        { name: /id map/i, enabled: false },
        { name: /group/i, enabled: true },
      ];

      expectActionButtons(expectedActions);
    });
  });

  describe("sequence features (SFVT)", () => {
    it("matches the taxon-view SFVT actions, their order and availability", () => {
      render(
        <SearchActionBar
          selectedCount={1}
          searchType="sequence_feature"
          guideUrl="https://example.test/guide"
          enabledActions={["copyRows", "services"]}
        />,
      );

      const expectedActions = [
        { name: /guide/i, enabled: true },
        { name: /dwnld/i, enabled: true },
        { name: /copy rows/i, enabled: true },
        { name: /services/i, enabled: true },
        // VARIANT TYPES waits on a later PR.
        { name: /variant\s*types/i, enabled: false },
      ];

      expectActionButtons(expectedActions);
    });

    it("does not fire onAction for the disabled VARIANT TYPES button", async () => {
      const onAction = vi.fn();
      render(
        <SearchActionBar
          selectedCount={1}
          searchType="sequence_feature"
          onAction={onAction}
        />,
      );

      await userEvent.click(
        screen.getByRole("button", { name: /variant\s*types/i }),
      );
      expect(onAction).not.toHaveBeenCalled();
    });
  });

  describe("epitopes", () => {
    it("matches the taxon-view epitope actions, their order and availability", () => {
      render(
        <SearchActionBar
          selectedCount={1}
          searchType="epitope"
          guideUrl="https://example.test/guide"
          enabledActions={["copyRows", "services"]}
        />,
      );

      const expectedActions = [
        { name: /guide/i, enabled: true },
        { name: /dwnld/i, enabled: true },
        { name: /^copy$/i, enabled: true },
        { name: /services/i, enabled: true },
        { name: /^eepitope$/i, enabled: true },
      ];

      expectActionButtons(expectedActions);
    });

    it("hides the single-row Epitope action for multiple selections", () => {
      render(
        <SearchActionBar
          selectedCount={2}
          searchType="epitope"
          enabledActions={["copyRows", "services"]}
        />,
      );

      expect(
        screen.queryByRole("button", { name: /^eepitope$/i }),
      ).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: /dwnld/i })).toBeEnabled();
    });
  });

  describe("interactions", () => {
    it("matches the taxon-view interaction actions, their order and availability", () => {
      render(
        <SearchActionBar
          selectedCount={2}
          searchType="ppi"
          guideUrl="https://example.test/guide"
          enabledActions={["copyRows", "services", "ppiFeatures", "group"]}
        />,
      );

      const expectedActions = [
        { name: /guide/i, enabled: true },
        { name: /dwnld/i, enabled: true },
        { name: /^copy$/i, enabled: true },
        { name: /services/i, enabled: true },
        { name: /^ffeatures$/i, enabled: true },
        // FASTA waits on a later PR.
        { name: /fasta/i, enabled: false },
        { name: /group/i, enabled: true },
      ];

      expectActionButtons(expectedActions);
    });

    it("does not fire onAction for the disabled interaction FASTA button", async () => {
      const onAction = vi.fn();
      render(
        <SearchActionBar
          selectedCount={2}
          searchType="ppi"
          enabledActions={["copyRows", "services", "ppiFeatures", "group"]}
          onAction={onAction}
        />,
      );

      await userEvent.click(screen.getByRole("button", { name: /fasta/i }));
      expect(onAction).not.toHaveBeenCalled();
    });
  });

  describe("serology", () => {
    it("matches the taxon-view serology actions, their order and availability", () => {
      render(
        <SearchActionBar
          selectedCount={1}
          searchType="serology"
          guideUrl="https://example.test/guide"
          enabledActions={["copyRows", "services"]}
        />,
      );

      const expectedActions = [
        { name: /guide/i, enabled: true },
        { name: /dwnld/i, enabled: true },
        { name: /^copy$/i, enabled: true },
        { name: /services/i, enabled: true },
        { name: /^sserology$/i, enabled: true },
      ];

      expectActionButtons(expectedActions);
    });
  });

  describe("surveillance", () => {
    it("matches the taxon-view surveillance actions, their order and availability", () => {
      render(
        <SearchActionBar
          selectedCount={1}
          searchType="surveillance"
          guideUrl="https://example.test/guide"
          enabledActions={["copyRows", "services"]}
        />,
      );

      const expectedActions = [
        { name: /guide/i, enabled: true },
        { name: /dwnld/i, enabled: true },
        { name: /^copy$/i, enabled: true },
        { name: /services/i, enabled: true },
        { name: /^ssrvlnce$/i, enabled: true },
        // MAP waits on a later PR.
        { name: /^map$/i, enabled: false },
      ];

      expectActionButtons(expectedActions);
    });

    it("does not fire onAction for the disabled MAP button", async () => {
      const onAction = vi.fn();
      render(
        <SearchActionBar
          selectedCount={1}
          searchType="surveillance"
          enabledActions={["copyRows", "services"]}
          onAction={onAction}
        />,
      );

      await userEvent.click(screen.getByRole("button", { name: /^map$/i }));
      expect(onAction).not.toHaveBeenCalled();
    });
  });

  describe("experiments", () => {
    it("matches the taxon-view experiment actions, their order and availability", () => {
      render(
        <SearchActionBar
          selectedCount={1}
          searchType="experiment"
          guideUrl="https://example.test/guide"
          enabledActions={["services"]}
        />,
      );

      // Legacy leaves COPY ROWS out of the experiment container.
      const expectedActions = [
        { name: /guide/i, enabled: true },
        { name: /dwnld/i, enabled: true },
        { name: /services/i, enabled: true },
        { name: /^eexprmnt$/i, enabled: true },
        // BIOSETS waits on a later PR.
        { name: /biosets/i, enabled: false },
      ];

      expectActionButtons(expectedActions);
    });

    it("matches the taxon-view bioset actions, their order and availability", () => {
      render(
        <SearchActionBar
          selectedCount={1}
          searchType="bioset"
          guideUrl="https://example.test/guide"
          enabledActions={["services", "biosets"]}
        />,
      );

      const expectedActions = [
        { name: /guide/i, enabled: true },
        { name: /dwnld/i, enabled: true },
        { name: /services/i, enabled: true },
        { name: /biosets/i, enabled: true },
      ];

      expectActionButtons(expectedActions);
    });

    it("does not fire onAction for the disabled experiment BIOSETS button", async () => {
      const onAction = vi.fn();
      render(
        <SearchActionBar
          selectedCount={1}
          searchType="experiment"
          enabledActions={["services"]}
          onAction={onAction}
        />,
      );

      await userEvent.click(screen.getByRole("button", { name: /biosets/i }));
      expect(onAction).not.toHaveBeenCalled();
    });
  });

  describe("protein structures", () => {
    it("matches the taxon-view structure actions and availability", () => {
      render(
        <SearchActionBar
          selectedCount={1}
          searchType="protein_structure"
          guideUrl="https://example.test/guide"
          enabledActions={["copyRows", "services"]}
        />,
      );

      const expectedActions = [
        { name: /guide/i, enabled: true },
        { name: /dwnld/i, enabled: true },
        { name: /^copy$/i, enabled: true },
        { name: /services/i, enabled: true },
        { name: /^ggenome$/i, enabled: true },
        { name: /^ffeature$/i, enabled: true },
        { name: /^sstructure$/i, enabled: true },
      ];

      for (const action of expectedActions) {
        expect(
          screen.getByRole("button", { name: action.name }),
        ).toHaveProperty("disabled", !action.enabled);
      }
    });
  });

  describe("ppi (interactions)", () => {
    it("shows COPY, SERVICES, FEATURES, FASTA, and GROUP disabled with the not-ready tooltip", () => {
      render(<SearchActionBar selectedCount={2} searchType="ppi" />);
      for (const name of [
        /copy/i,
        /services/i,
        /features/i,
        /fasta/i,
        /group/i,
      ]) {
        expect(screen.getByRole("button", { name })).toBeDisabled();
      }
    });

    it("does not fire onAction when clicking a disabled ppi action", async () => {
      const onAction = vi.fn();
      render(
        <SearchActionBar
          selectedCount={1}
          searchType="ppi"
          onAction={onAction}
        />,
      );
      await userEvent.click(screen.getByRole("button", { name: /fasta/i }));
      expect(onAction).not.toHaveBeenCalled();
    });

    it("shows the not-ready tooltip text on hover for the new ppi actions", async () => {
      const user = userEvent.setup();
      render(<SearchActionBar selectedCount={1} searchType="ppi" />);
      await user.hover(screen.getByRole("button", { name: /fasta/i }));
      expect(await screen.findAllByText(notReady)).not.toHaveLength(0);
    });

    it("does not leak ppi-only actions (FASTA, GROUP, ppiFeatures) into unrelated search types", () => {
      render(<SearchActionBar selectedCount={1} searchType="epitope" />);
      expect(
        screen.queryByRole("button", { name: /fasta/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /group/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /^features$/i }),
      ).not.toBeInTheDocument();
    });
  });

  describe("callbacks", () => {
    afterEach(() => vi.restoreAllMocks());

    it("opens the guide URL without retaining an opener", async () => {
      const guideWindow = { opener: window };
      const openSpy = vi
        .spyOn(window, "open")
        .mockReturnValue(guideWindow as Window);
      render(
        <SearchActionBar
          selectedCount={1}
          searchType="taxonomy"
          guideUrl="https://example.test/guide"
        />,
      );
      await userEvent.click(screen.getByRole("button", { name: /guide/i }));
      expect(openSpy).toHaveBeenCalledWith("https://example.test/guide", "_blank");
      expect(guideWindow.opener).toBeNull();
    });

    it("reports a blocked guide pop-up", async () => {
      const onError = vi.fn();
      vi.spyOn(window, "open").mockReturnValue(null);
      render(
        <SearchActionBar
          selectedCount={1}
          searchType="taxonomy"
          guideUrl="https://example.test/guide"
          onError={onError}
        />,
      );
      await userEvent.click(screen.getByRole("button", { name: /guide/i }));
      expect(onError).toHaveBeenCalledWith(
        "Allow pop-ups to open the user guide.",
      );
    });

    it("fires onAction with the action id for an enabled action", async () => {
      const onAction = vi.fn();
      render(
        <SearchActionBar
          selectedCount={1}
          searchType="taxonomy"
          onAction={onAction}
        />,
      );
      await userEvent.click(
        screen.getByRole("button", { name: /taxon\s*overview/i }),
      );
      expect(onAction).toHaveBeenCalledWith("taxonOverview");
    });

    it("enables the Genomes action when a consumer implements it", async () => {
      const onAction = vi.fn();
      render(
        <SearchActionBar
          selectedCount={1}
          searchType="strain"
          enabledActions={["genomes"]}
          onAction={onAction}
        />,
      );

      const button = screen.getByRole("button", { name: /^ggenomes$/i });
      expect(button).not.toBeDisabled();
      await userEvent.click(button);
      expect(onAction).toHaveBeenCalledWith("genomes");
    });

    it("enables the Strain actions for multiple selections", () => {
      render(
        <SearchActionBar
          selectedCount={2}
          searchType="strain"
          enabledActions={["copyRows", "services", "genomes", "group"]}
        />,
      );

      expect(
        screen.getByRole("button", { name: /^copy$/i }),
      ).not.toBeDisabled();
      expect(
        screen.getByRole("button", { name: /^services$/i }),
      ).not.toBeDisabled();
      expect(
        screen.getByRole("button", { name: /^ggenomes$/i }),
      ).not.toBeDisabled();
      expect(
        screen.getByRole("button", { name: /^group$/i }),
      ).not.toBeDisabled();
    });

    it("opens action-specific popover content without firing the action", async () => {
      const onAction = vi.fn();
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);

      try {
        render(
          <SearchActionBar
            selectedCount={1}
            searchType="strain"
            enabledActions={["group"]}
            actionPopovers={{ group: <p>Sign in required</p> }}
            onAction={onAction}
          />,
        );

        await userEvent.click(screen.getByRole("button", { name: /group/i }));

        expect(screen.getByText("Sign in required")).toBeInTheDocument();
        expect(onAction).not.toHaveBeenCalled();
        expect(
          consoleError.mock.calls.some(([message]) =>
            String(message).includes(
              "Base UI: A component that acts as a button",
            ),
          ),
        ).toBe(false);
      } finally {
        consoleError.mockRestore();
      }
    });

    it("honors an explicit disable when an enabled action has no target", () => {
      render(
        <SearchActionBar
          selectedCount={1}
          searchType="strain"
          enabledActions={["genomes"]}
          disabledActions={{
            genomes: "No genomes are associated with this strain",
          }}
        />,
      );

      expect(
        screen.getByRole("button", { name: /^ggenomes$/i }),
      ).toBeDisabled();
    });

    it("enables the Genome action for one selected genome", async () => {
      const onAction = vi.fn();
      render(
        <SearchActionBar
          selectedCount={1}
          searchType="genome"
          onAction={onAction}
        />,
      );

      const button = screen.getByRole("button", { name: /^ggenome$/i });
      expect(button).not.toBeDisabled();
      await userEvent.click(button);
      expect(onAction).toHaveBeenCalledWith("genome");
    });

    it("hides the single-row Genome action for multiple selections", () => {
      render(<SearchActionBar selectedCount={2} searchType="genome" />);
      expect(
        screen.queryByRole("button", { name: /^ggenome$/i }),
      ).not.toBeInTheDocument();
    });

    it("enables the Feature action for one selected feature", async () => {
      const onAction = vi.fn();
      render(
        <SearchActionBar
          selectedCount={1}
          searchType="genome_feature"
          onAction={onAction}
        />,
      );

      const button = screen.getByRole("button", { name: /^ffeature$/i });
      expect(button).not.toBeDisabled();
      await userEvent.click(button);
      expect(onAction).toHaveBeenCalledWith("feature");
    });

    it("hides the single-row Feature action for multiple selections", () => {
      render(<SearchActionBar selectedCount={2} searchType="genome_feature" />);
      expect(
        screen.queryByRole("button", { name: /^ffeature$/i }),
      ).not.toBeInTheDocument();
    });

    it("enables the Surveillance action for one selected record", async () => {
      const onAction = vi.fn();
      render(
        <SearchActionBar
          selectedCount={1}
          searchType="surveillance"
          onAction={onAction}
        />,
      );

      const button = screen.getByRole("button", { name: /^ssrvlnce$/i });
      expect(button).not.toBeDisabled();
      await userEvent.click(button);
      expect(onAction).toHaveBeenCalledWith("surveillance");
    });

    it("hides the single-row Surveillance action for multiple selections", () => {
      render(<SearchActionBar selectedCount={2} searchType="surveillance" />);
      expect(
        screen.queryByRole("button", { name: /^ssrvlnce$/i }),
      ).not.toBeInTheDocument();
    });

    it("enables the Experiment action for one selected record", async () => {
      const onAction = vi.fn();
      render(
        <SearchActionBar
          selectedCount={1}
          searchType="experiment"
          onAction={onAction}
        />,
      );

      const button = screen.getByRole("button", { name: /^eexprmnt$/i });
      expect(button).not.toBeDisabled();
      await userEvent.click(button);
      expect(onAction).toHaveBeenCalledWith("experiment");
    });

    it("hides the Experiment action for multiple selections", () => {
      render(<SearchActionBar selectedCount={2} searchType="experiment" />);
      expect(
        screen.queryByRole("button", { name: /^eexprmnt$/i }),
      ).not.toBeInTheDocument();
    });

    it("enables the Serology action for one selected record", async () => {
      const onAction = vi.fn();
      render(
        <SearchActionBar
          selectedCount={1}
          searchType="serology"
          onAction={onAction}
        />,
      );

      const button = screen.getByRole("button", { name: /^sserology$/i });
      expect(button).not.toBeDisabled();
      await userEvent.click(button);
      expect(onAction).toHaveBeenCalledWith("serology");
    });
  });
});
