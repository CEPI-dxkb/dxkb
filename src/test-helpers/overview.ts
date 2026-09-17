/**
 * DOM helpers for entity-overview tests. An overview renders a grid of titled
 * cards, each holding a `<dl>` of `<dt>`/`<dd>` pairs, so most assertions are
 * "which fields does *this* card show, in what order" — which needs scoping to
 * one card rather than the whole document.
 */

function cardTitleNodes(): Element[] {
  return Array.from(document.querySelectorAll('[data-slot="card-title"]'));
}

/** Every overview section title on the page, in DOM order. */
export function overviewSectionTitles(): string[] {
  return cardTitleNodes().map((node) => node.textContent ?? "");
}

/** The card element for one overview section, located by its title. */
export function overviewSection(title: string): HTMLElement {
  const card = cardTitleNodes()
    .find((node) => node.textContent === title)
    ?.closest('[data-slot="card"]');
  if (!(card instanceof HTMLElement)) {
    throw new Error(
      `No overview section titled "${title}". Present: ${overviewSectionTitles().join(" | ")}`,
    );
  }
  return card;
}

/** The `<dt>` labels inside one overview section, in DOM order. */
export function overviewSectionLabels(title: string): string[] {
  return Array.from(overviewSection(title).querySelectorAll("dt")).map(
    (dt) => dt.textContent ?? "",
  );
}

/** The `<dd>` text for one labelled field inside one overview section. */
export function overviewFieldValue(title: string, label: string): string {
  const section = overviewSection(title);
  const term = Array.from(section.querySelectorAll("dt")).find(
    (dt) => dt.textContent === label,
  );
  const definition = term?.nextElementSibling;
  if (definition?.tagName !== "DD") {
    throw new Error(
      `No field labelled "${label}" in section "${title}". Present: ${overviewSectionLabels(title).join(" | ")}`,
    );
  }
  return definition.textContent ?? "";
}

/** The `<a href>` values inside one overview section, in DOM order. */
export function overviewSectionHrefs(title: string): string[] {
  return Array.from(overviewSection(title).querySelectorAll("a")).map(
    (anchor) => anchor.getAttribute("href") ?? "",
  );
}

/** Section titles whose body is the shared empty-section fallback. */
export function emptyOverviewSectionTitles(): string[] {
  return overviewSectionTitles().filter((title) =>
    overviewSection(title).textContent?.includes("No data available."),
  );
}
