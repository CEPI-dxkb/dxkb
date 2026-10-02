"use client"

import { useEffect } from "react"
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes"
import type { ThemeProviderProps } from "next-themes"
import {
  defaultTheme,
  defaultThemeBase,
  parseTheme,
  themeList,
} from "@/styles/themes"

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <>
      <RetiredThemeScript storageKey={props.storageKey ?? "theme"} />
      <NextThemesProvider
        attribute="data-theme"
        themes={themeList}
        defaultTheme={defaultTheme}
        disableTransitionOnChange
        enableColorScheme={false}
        {...props}
      >
        <RetiredThemeReset />
        {children}
      </NextThemesProvider>
    </>
  )
}

/**
 * Rewrites a stored theme that is no longer offered (zinc and orange were
 * retired) to the default theme in the same light/dark mode. next-themes
 * applies whatever theme is stored, and no stylesheet matches a retired one,
 * so left alone the page would paint without theme colors.
 *
 * Serialized into an inline script, so it must not reference anything outside
 * its own body.
 */
function resetRetiredTheme(storageKey: string, themes: string[], base: string) {
  try {
    const stored = localStorage.getItem(storageKey)
    if (stored && !themes.includes(stored)) {
      const mode = stored.endsWith("-dark") ? "dark" : "light"
      localStorage.setItem(storageKey, `${base}-${mode}`)
    }
  } catch {
    // Storage is unavailable, so next-themes has no stored theme to apply.
  }
}

/**
 * Runs resetRetiredTheme before first paint. It renders ahead of
 * NextThemesProvider, whose own inline script (the one that reads the stored
 * theme and sets data-theme) comes later in the document, so it sees the
 * rewritten value.
 */
function RetiredThemeScript({ storageKey }: { storageKey: string }) {
  const args = JSON.stringify([storageKey, themeList, defaultThemeBase])
  return (
    <script
      suppressHydrationWarning
      dangerouslySetInnerHTML={{
        __html: `(${resetRetiredTheme.toString()})(${args.slice(1, -1)})`,
      }}
    />
  )
}

/**
 * The same reset for a retired theme that arrives after load: next-themes
 * follows the storage event, so a tab still running the previous build can
 * write one into this tab.
 */
function RetiredThemeReset() {
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    if (theme && !themeList.includes(theme)) {
      setTheme(`${defaultThemeBase}-${parseTheme(theme).mode}`)
    }
  }, [theme, setTheme])

  return null
}
