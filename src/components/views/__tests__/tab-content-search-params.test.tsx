import { render, screen } from "@testing-library/react";

const navigation = vi.hoisted(() => ({
  searchParams: new URLSearchParams(),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => navigation.searchParams,
}));

import {
  TabContentSearchParams,
  useTabContentSearchParams,
} from "../tab-content-search-params";

function SearchProbe() {
  return <output>{useTabContentSearchParams().toString()}</output>;
}

function tabContent(tab: string | null) {
  return (
    <TabContentSearchParams tab={tab}>
      <SearchProbe />
    </TabContentSearchParams>
  );
}

function setUrl(search: string) {
  navigation.searchParams = new URLSearchParams(search);
}

beforeEach(() => {
  setUrl("");
});

it("reads the URL outside a tab shell", () => {
  setUrl("tab=genomes&collection_year=2025");
  render(<SearchProbe />);
  expect(screen.getByRole("status")).toHaveTextContent(
    "tab=genomes&collection_year=2025",
  );
});

it("follows the URL while it names the rendered tab", () => {
  setUrl("tab=genomes&collection_year=2025");
  const { rerender } = render(tabContent("genomes"));
  expect(screen.getByRole("status")).toHaveTextContent(
    "tab=genomes&collection_year=2025",
  );

  // A filter change (router.push) and a nested table's History API write.
  setUrl("tab=genomes&collection_year=2024");
  rerender(tabContent("genomes"));
  expect(screen.getByRole("status")).toHaveTextContent(
    "tab=genomes&collection_year=2024",
  );
  setUrl("tab=genomes&collection_year=2024&biosets.page=2");
  rerender(tabContent("genomes"));
  expect(screen.getByRole("status")).toHaveTextContent(
    "tab=genomes&collection_year=2024&biosets.page=2",
  );
});

it("keeps the last matching search while the URL names another tab", () => {
  setUrl("tab=genomes&collection_year=2025");
  const { rerender } = render(tabContent("genomes"));

  // Back's stale frame: the destination URL, the leaving tab's content.
  setUrl("");
  rerender(tabContent("genomes"));
  expect(screen.getByRole("status")).toHaveTextContent(
    "tab=genomes&collection_year=2025",
  );

  // The destination's content arrives and reads its own URL.
  rerender(tabContent(null));
  expect(screen.getByRole("status")).toBeEmptyDOMElement();
});

it("matches a URL without a tab param to null", () => {
  setUrl("collection_year=2025");
  const { rerender } = render(tabContent(null));
  expect(screen.getByRole("status")).toHaveTextContent("collection_year=2025");

  setUrl("tab=genomes");
  rerender(tabContent(null));
  expect(screen.getByRole("status")).toHaveTextContent("collection_year=2025");
});

it("follows a legacy ?view= URL once its content is rendered for no tab", () => {
  setUrl("tab=genomes&collection_year=2025");
  const { rerender } = render(tabContent("genomes"));

  // Back to a legacy link to the same view: the stale frame holds the leaving
  // search...
  setUrl("view=genomes");
  rerender(tabContent("genomes"));
  expect(screen.getByRole("status")).toHaveTextContent(
    "tab=genomes&collection_year=2025",
  );

  // ...and the legacy page's content, rendered for its raw (absent) `tab`,
  // reads the URL from then on, including a nested table's History API write.
  rerender(tabContent(null));
  expect(screen.getByRole("status")).toHaveTextContent("view=genomes");
  setUrl("view=genomes&collection_year=2024");
  rerender(tabContent(null));
  expect(screen.getByRole("status")).toHaveTextContent(
    "view=genomes&collection_year=2024",
  );
});

it("falls back to the URL when the content never matched it", () => {
  setUrl("tab=bogus");
  const { rerender } = render(tabContent("genomes"));
  expect(screen.getByRole("status")).toHaveTextContent("tab=bogus");

  setUrl("tab=bogus&page=2");
  rerender(tabContent("genomes"));
  expect(screen.getByRole("status")).toHaveTextContent("tab=bogus&page=2");
});
