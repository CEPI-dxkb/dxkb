import type { KeyboardEvent } from "react";

export function moveResultFocus(event: KeyboardEvent<HTMLElement>): void {
  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
  const from = document.activeElement;
  if (!from) return;
  const links = [
    ...event.currentTarget.querySelectorAll<HTMLElement>("[data-result-link]"),
  ].filter((link) => !link.closest("[inert]"));
  const next =
    event.key === "ArrowDown"
      ? links.find(
          (link) =>
            from.compareDocumentPosition(link) &
            Node.DOCUMENT_POSITION_FOLLOWING,
        )
      : links.findLast(
          (link) =>
            from.compareDocumentPosition(link) &
            Node.DOCUMENT_POSITION_PRECEDING,
        );
  if (!next) return;
  event.preventDefault();
  next.focus();
}
