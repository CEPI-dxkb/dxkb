import type { KeyboardEvent } from "react";

/**
 * ↑/↓ move between the result links inside the handler's element, past the
 * rows "Show more" has yet to show. From anything else focused there (a fold
 * button, a type's heading link), they go to the nearest result link in that
 * direction.
 */
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
