// Moves focus into a chat surface's composer. The composer can be missing (the panel chunk is still
// loading) or disabled (the chat is still being read) when the surface opens, so this waits for an
// enabled textarea. It gives up if the user has meanwhile focused something else on the page.

// Only the composer: a plan step being edited has a textarea of its own, higher up in the chat.
function enabledTextarea(container: HTMLElement): HTMLTextAreaElement | null {
  return container.querySelector<HTMLTextAreaElement>(
    "textarea[data-copilot-composer]:not(:disabled)",
  );
}

/** Focuses the composer in `container` once it can take focus; returns a cleanup that stops waiting. */
export function focusComposerWhenReady(container: HTMLElement): () => void {
  const startedOn = document.activeElement;
  const userMovedOn = () => {
    const active = document.activeElement;
    return (
      active !== null &&
      active !== startedOn &&
      active !== document.body &&
      !container.contains(active)
    );
  };

  const ready = enabledTextarea(container);
  if (ready) {
    ready.focus();
    return () => undefined;
  }

  const observer = new MutationObserver(() => {
    if (userMovedOn()) {
      observer.disconnect();
      return;
    }
    const textarea = enabledTextarea(container);
    if (!textarea) return;
    observer.disconnect();
    textarea.focus();
  });
  observer.observe(container, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["disabled"],
  });
  return () => {
    observer.disconnect();
  };
}
