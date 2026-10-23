import { useSyncExternalStore } from "react";

/** The attribute next-themes writes the theme to (`ThemeProvider`'s `attribute`). */
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
 * The theme that is on `<html>` right now (`"bvbrc-dark"`), not the one
 * next-themes' `useTheme()` reports. next-themes writes the attribute from its
 * own passive effect, which runs after those of the components below it, so a
 * component that reads theme tokens when it mounts on a `resolvedTheme` change
 * still sees the previous theme's. This value changes only after the new
 * tokens are in place. JBrowse-free, so it is testable.
 */
export function useAppliedTheme(): string | undefined {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
