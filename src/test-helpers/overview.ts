/** DOM helpers for entity-overview tests, scoped to one titled card. */

function cardTitleNodes(): Element[] {
  return Array.from(document.querySelectorAll('[data-slot="card-title"]'));
}

export function overviewSectionTitles(): string[] {
  return cardTitleNodes().map((node) => node.textContent);
}

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

export function overviewSectionLabels(title: string): string[] {
  return Array.from(overviewSection(title).querySelectorAll("dt")).map(
    (dt) => dt.textContent,
  );
}

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
  return definition.textContent;
}

export function overviewSectionHrefs(title: string): string[] {
  return Array.from(overviewSection(title).querySelectorAll("a")).map(
    (anchor) => anchor.getAttribute("href") ?? "",
  );
}

export function emptyOverviewSectionTitles(): string[] {
  return overviewSectionTitles().filter((title) =>
    overviewSection(title).textContent.includes("No data available."),
  );
}
