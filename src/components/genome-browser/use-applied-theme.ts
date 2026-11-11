import { useSyncExternalStore } from "react";

const themeAttribute = "data-theme";

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: [themeAttribute],
  });
  return () => {
    observer.disconnect();
  };
}

function getSnapshot(): string | undefined {
  return document.documentElement.dataset.theme;
}

function getServerSnapshot(): undefined {
  return undefined;
}

/**
 * The theme on `<html>` now, not `useTheme()`: next-themes writes the attribute
 * from a passive effect that runs after its children's, so `resolvedTheme` can
 * still be the previous theme's tokens.
 */
export function useAppliedTheme(): string | undefined {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
