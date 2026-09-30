/**
 * The legacy Search filter bar's facet chooser. It used to be a bare `<div>`
 * that looked like a menu: no menu role, no keyboard handling, no Escape, no
 * focus return, an outside-click dismissal hand-rolled on a document
 * `mousedown` listener, and hard-coded `gray-*` colours that ignored the
 * light/dark themes. It is now built on the shared `DropdownMenuCheckboxItem`
 * primitive, the same one `resource-filter-bar.tsx` uses.
 *
 * So these tests split two ways. Menu role, keyboard open, Escape and focus
 * return are behaviour the primitive *adds*. Outside-click dismissal is
 * behaviour the base already had and the primitive *takes over* — its test is
 * therefore a regression guard, not a new-feature check: it fails if the
 * rebuilt chooser dropped a dismissal the hand-rolled one provided.
 */
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";

import { server } from "@/test-helpers/msw-server";
import {
  createQueryClientWrapper,
  createUiPreferencesWrapper,
} from "@/test-helpers/react";
import { jsdomLocalStorage } from "@/test-helpers/storage";
import { FilterBar } from "../filter-bar";

const facetFields = [
  {
    id: "sequence_type",
    label: "Sequence Type",
    visible: true,
    facet: true,
    facet_hidden: false,
  },
  {
    id: "mol_type",
    label: "Mol Type",
    visible: true,
    facet: true,
    facet_hidden: true,
  },
];

const layoutStorageKey = "dxkb-table-layout:v1:search:genome_sequence";

beforeEach(() => {
  vi.stubGlobal("localStorage", jsdomLocalStorage());
  localStorage.clear();
});

function stubFacets() {
  server.use(
    http.get("/api/data/genome_sequence", () =>
      HttpResponse.json({
        rows: [],
        total: 0,
        facets: {
          sequence_type: [{ value: "plasmid", count: 3 }],
          mol_type: [{ value: "DNA", count: 7 }],
        },
        page: 1,
        pageSize: 1,
      }),
    ),
  );
}

function renderFilterBar(
  onFilterChange = vi.fn(),
  fields = facetFields,
) {
  stubFacets();
  const Wrapper = createQueryClientWrapper();
  const view = render(
    <Wrapper>
      <FilterBar
        facetFields={fields}
        resource="genome_sequence"
        query="keyword(influenza*)"
        onFilterChange={onFilterChange}
      />
    </Wrapper>,
  );
  return { onFilterChange, view, Wrapper };
}

async function openChooser(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Show Filters" }));
  const trigger = screen.getByRole("button", { name: "Facets" });
  await user.click(trigger);
  // Base UI opens on the next animation frame after a pointer click, so poll
  // for the menu item rather than asserting synchronously.
  await screen.findByRole("menuitemcheckbox", { name: "Sequence Type" });
  return trigger;
}

describe("FilterBar facet chooser", () => {
  it("opens via the keyboard and exposes aria-expanded", async () => {
    const user = userEvent.setup();
    renderFilterBar();

    await user.click(screen.getByRole("button", { name: "Show Filters" }));
    const trigger = screen.getByRole("button", { name: "Facets" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    trigger.focus();
    await user.keyboard("{Enter}");

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByRole("menuitemcheckbox", { name: "Sequence Type" }),
    ).toBeInTheDocument();
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    renderFilterBar();
    const trigger = await openChooser(user);

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(
        screen.queryByRole("menuitemcheckbox", { name: "Sequence Type" }),
      ).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(trigger).toHaveFocus();
    });
  });

  // Regression guard, not a new-feature check — see the file header.
  it("closes when clicking outside the menu, as the hand-rolled popup also did", async () => {
    const user = userEvent.setup();
    renderFilterBar();
    await openChooser(user);

    await user.click(document.body);

    await waitFor(() => {
      expect(
        screen.queryByRole("menuitemcheckbox", { name: "Sequence Type" }),
      ).not.toBeInTheDocument();
    });
  });

  it("seeds checked state from facet_hidden and toggles a facet column in place", async () => {
    const user = userEvent.setup();
    renderFilterBar();
    await openChooser(user);

    // `facet_hidden: false` starts shown, `facet_hidden: true` starts collapsed.
    expect(
      screen.getByRole("menuitemcheckbox", { name: "Sequence Type" }),
    ).toHaveAttribute("aria-checked", "true");
    const molType = screen.getByRole("menuitemcheckbox", {
      name: "Mol Type",
    });
    expect(molType).toHaveAttribute("aria-checked", "false");
    expect(await screen.findByRole("button", { name: "plasmid (3)" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "DNA (7)" }),
    ).not.toBeInTheDocument();

    await user.click(molType);

    // The menu stays open so a second facet can be toggled in the same session.
    expect(
      screen.getByRole("menuitemcheckbox", { name: "Mol Type" }),
    ).toHaveAttribute("aria-checked", "true");
    expect(await screen.findByRole("button", { name: "DNA (7)" })).toBeInTheDocument();
  });

  it("derives visibility from current definitions and preserves overrides when facets return", async () => {
    const user = userEvent.setup();
    const { view, Wrapper } = renderFilterBar();
    await openChooser(user);
    await user.click(
      screen.getByRole("menuitemcheckbox", { name: "Sequence Type" }),
    );
    await user.click(
      screen.getByRole("menuitemcheckbox", { name: "Mol Type" }),
    );
    await user.keyboard("{Escape}");

    const nextFields = [
      { ...facetFields[0], label: "Sequence Type Updated" },
      {
        id: "new_visible",
        label: "New Visible",
        visible: true,
        facet: true,
        facet_hidden: false,
      },
      {
        id: "new_hidden",
        label: "New Hidden",
        visible: true,
        facet: true,
        facet_hidden: true,
      },
    ];
    view.rerender(
      <Wrapper>
        <FilterBar
          facetFields={nextFields}
          resource="genome_sequence"
          query="keyword(influenza*)"
          onFilterChange={vi.fn()}
        />
      </Wrapper>,
    );
    const trigger = screen.getByRole("button", { name: "Facets" });
    trigger.focus();
    await user.keyboard("{Enter}");

    expect(
      await screen.findByRole("menuitemcheckbox", {
        name: "Sequence Type Updated",
      }),
    ).toHaveAttribute("aria-checked", "false");
    expect(
      screen.getByRole("menuitemcheckbox", { name: "New Visible" }),
    ).toHaveAttribute("aria-checked", "true");
    expect(
      screen.getByRole("menuitemcheckbox", { name: "New Hidden" }),
    ).toHaveAttribute("aria-checked", "false");
    expect(
      screen.queryByRole("menuitemcheckbox", { name: "Mol Type" }),
    ).not.toBeInTheDocument();

    await user.keyboard("{Escape}");
    view.rerender(
      <Wrapper>
        <FilterBar
          facetFields={nextFields.slice(1)}
          resource="genome_sequence"
          query="keyword(influenza*)"
          onFilterChange={vi.fn()}
        />
      </Wrapper>,
    );
    const reducedTrigger = screen.getByRole("button", { name: "Facets" });
    reducedTrigger.focus();
    await user.keyboard("{Enter}");
    expect(
      screen.queryByRole("menuitemcheckbox", {
        name: "Sequence Type Updated",
      }),
    ).not.toBeInTheDocument();

    await user.keyboard("{Escape}");
    view.rerender(
      <Wrapper>
        <FilterBar
          facetFields={facetFields}
          resource="genome_sequence"
          query="keyword(influenza*)"
          onFilterChange={vi.fn()}
        />
      </Wrapper>,
    );
    const restoredTrigger = screen.getByRole("button", { name: "Facets" });
    restoredTrigger.focus();
    await user.keyboard("{Enter}");

    expect(
      await screen.findByRole("menuitemcheckbox", { name: "Sequence Type" }),
    ).toHaveAttribute("aria-checked", "false");
    expect(
      screen.getByRole("menuitemcheckbox", { name: "Mol Type" }),
    ).toHaveAttribute("aria-checked", "true");
  });

  it("remembers the user's facet choices when the bar remounts", async () => {
    const user = userEvent.setup();
    const { view } = renderFilterBar();
    await openChooser(user);
    await user.click(
      screen.getByRole("menuitemcheckbox", { name: "Sequence Type" }),
    );

    view.unmount();
    renderFilterBar();
    await openChooser(user);

    expect(
      screen.getByRole("menuitemcheckbox", { name: "Sequence Type" }),
    ).toHaveAttribute("aria-checked", "false");
    expect(
      screen.getByRole("menuitemcheckbox", { name: "Mol Type" }),
    ).toHaveAttribute("aria-checked", "false");
  });

  it("shows the facets the user picked on an earlier visit", async () => {
    const user = userEvent.setup();
    localStorage.setItem(
      layoutStorageKey,
      JSON.stringify({ facets: { sequence_type: false, mol_type: true } }),
    );
    renderFilterBar();
    await openChooser(user);

    expect(
      screen.getByRole("menuitemcheckbox", { name: "Sequence Type" }),
    ).toHaveAttribute("aria-checked", "false");
    expect(
      screen.getByRole("menuitemcheckbox", { name: "Mol Type" }),
    ).toHaveAttribute("aria-checked", "true");
    await user.keyboard("{Escape}");
    expect(
      await screen.findByRole("button", { name: "DNA (7)" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "plasmid (3)" }),
    ).not.toBeInTheDocument();
  });

  it("stores only the difference from the defaults when a facet is toggled", async () => {
    const user = userEvent.setup();
    renderFilterBar();
    await openChooser(user);

    await user.click(screen.getByRole("menuitemcheckbox", { name: "Mol Type" }));
    expect(
      JSON.parse(localStorage.getItem(layoutStorageKey) ?? "null"),
    ).toStrictEqual({ facets: { mol_type: true } });

    await user.click(
      screen.getByRole("menuitemcheckbox", { name: "Sequence Type" }),
    );
    expect(
      JSON.parse(localStorage.getItem(layoutStorageKey) ?? "null"),
    ).toStrictEqual({ facets: { mol_type: true, sequence_type: false } });

    // Back at the defaults, so there is nothing left to remember.
    await user.click(screen.getByRole("menuitemcheckbox", { name: "Mol Type" }));
    await user.click(
      screen.getByRole("menuitemcheckbox", { name: "Sequence Type" }),
    );
    expect(localStorage.getItem(layoutStorageKey)).toBeNull();
  });

  it("keeps the table layout stored under the same key when a facet is toggled", async () => {
    const user = userEvent.setup();
    localStorage.setItem(
      layoutStorageKey,
      JSON.stringify({ visibility: { sequence_type: false } }),
    );
    renderFilterBar();
    await openChooser(user);

    await user.click(screen.getByRole("menuitemcheckbox", { name: "Mol Type" }));

    expect(
      JSON.parse(localStorage.getItem(layoutStorageKey) ?? "null"),
    ).toStrictEqual({
      visibility: { sequence_type: false },
      facets: { mol_type: true },
    });
  });

  it("uses theme tokens for the chooser and panel, not hardcoded colours", async () => {
    const user = userEvent.setup();
    renderFilterBar();
    const trigger = await openChooser(user);

    const menu = screen
      .getByRole("menuitemcheckbox", { name: "Sequence Type" })
      .closest('[role="menu"]');
    const clearAll = screen.getByRole("button", {
      name: "Clear All Filters",
    });
    const hide = screen.getByRole("button", { name: "Hide Filters" });

    // The popup used to hard-code `bg-gray-800 border-gray-600`, and the three
    // buttons `border-gray-400 hover:bg-gray-700` / `border-red-400
    // text-red-300 hover:bg-red-900`, so the whole bar ignored the light theme.
    for (const element of [trigger, clearAll, hide]) {
      expect(element.className).not.toMatch(/gray-/);
      expect(element.className).not.toMatch(/red-/);
    }
    expect(menu).not.toBeNull();
    expect(menu?.className).not.toMatch(/gray-/);
    expect(menu?.innerHTML).not.toMatch(/gray-/);
    expect(menu?.innerHTML).not.toMatch(/text-white/);
    // The primitive's own surface tokens, which resolve per theme from
    // globals.css, are what replaced them.
    expect(menu?.className).toMatch(/bg-popover/);
  });

  it("selecting a facet value reports an RQL filter for it", async () => {
    const user = userEvent.setup();
    const { onFilterChange } = renderFilterBar();
    await openChooser(user);
    await user.keyboard("{Escape}");

    await user.click(await screen.findByRole("button", { name: "plasmid (3)" }));

    expect(onFilterChange).toHaveBeenCalledWith("eq(sequence_type,plasmid)");
  });
});

describe("FilterBar on a full page load", () => {
  it("asks for counts of the saved facet set only, not the default set first", async () => {
    localStorage.setItem(
      layoutStorageKey,
      JSON.stringify({ facets: { sequence_type: false, mol_type: true } }),
    );
    const requests: URL[] = [];
    server.use(
      http.get("/api/data/genome_sequence", ({ request }) => {
        requests.push(new URL(request.url));
        return HttpResponse.json({
          rows: [],
          total: 0,
          facets: { mol_type: [{ value: "DNA", count: 7 }] },
          page: 1,
          pageSize: 1,
        });
      }),
    );

    const QueryWrapper = createQueryClientWrapper();
    const PreferencesWrapper = createUiPreferencesWrapper({
      facetPanelOpen: true,
    });
    const tree = (
      <QueryWrapper>
        <PreferencesWrapper>
          <FilterBar
            facetFields={facetFields}
            resource="genome_sequence"
            query="keyword(influenza*)"
            onFilterChange={vi.fn()}
          />
        </PreferencesWrapper>
      </QueryWrapper>
    );

    // Server HTML first (storage reads as empty there), then hydrate it, which
    // is the render pair a full page load goes through.
    const container = document.createElement("div");
    document.body.append(container);
    container.innerHTML = renderToString(tree);
    expect(container.querySelector('[data-slot="skeleton"]')).not.toBeNull();

    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      act(() => {
        root = hydrateRoot(container, tree);
      });

      expect(await screen.findByText("DNA (7)")).toBeInTheDocument();
      // Long enough for a second, wrongly started request to reach the handler.
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(requests.map((url) => url.searchParams.getAll("facet"))).toEqual([
        ["mol_type"],
      ]);
    } finally {
      act(() => {
        root?.unmount();
      });
      container.remove();
    }
  });
});
