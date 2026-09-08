import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { SearchActionBar, notReady } from "../search-action-bar";

describe("SearchActionBar (taxonomy)", () => {
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

    it("opens the guide URL in a new tab on Guide click", async () => {
      const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
      render(
        <SearchActionBar
          selectedCount={1}
          searchType="taxonomy"
          guideUrl="https://example.test/guide"
        />,
      );
      await userEvent.click(screen.getByRole("button", { name: /guide/i }));
      expect(openSpy).toHaveBeenCalledWith(
        "https://example.test/guide",
        "_blank",
        "noopener,noreferrer",
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

    it("hides the single-strain Genomes action for multiple selections", () => {
      render(
        <SearchActionBar
          selectedCount={2}
          searchType="strain"
          enabledActions={["genomes"]}
        />,
      );

      expect(
        screen.queryByRole("button", { name: /^ggenomes$/i }),
      ).not.toBeInTheDocument();
    });

    it("honors an explicit disable when an enabled action has no target", () => {
      render(
        <SearchActionBar
          selectedCount={1}
          searchType="strain"
          enabledActions={["genomes"]}
          disabledActions={{ genomes: "No genomes are associated with this strain" }}
        />,
      );

      expect(screen.getByRole("button", { name: /^ggenomes$/i })).toBeDisabled();
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

    it("matches the legacy Bioset actions", () => {
      render(
        <SearchActionBar
          selectedCount={1}
          searchType="bioset"
          guideUrl="https://example.test/guide"
          enabledActions={["biosets"]}
        />,
      );

      expect(screen.getByRole("button", { name: /guide/i })).not.toBeDisabled();
      expect(screen.getByRole("button", { name: /dwnld/i })).not.toBeDisabled();
      expect(screen.getByRole("button", { name: /services/i })).toBeDisabled();
      expect(screen.getByRole("button", { name: /biosets/i })).not.toBeDisabled();
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

      const button = screen.getByRole("button", { name: /^eexpermnt$/i });
      expect(button).not.toBeDisabled();
      await userEvent.click(button);
      expect(onAction).toHaveBeenCalledWith("experiment");
    });

    it("hides the Experiment action for multiple selections", () => {
      render(<SearchActionBar selectedCount={2} searchType="experiment" />);
      expect(
        screen.queryByRole("button", { name: /^eexpermnt$/i }),
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
