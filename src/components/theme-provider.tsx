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
 * Rewrites a stored retired theme to the default in the same mode, since no
 * stylesheet matches it. Serialized into an inline script, so it must not
 * reference anything outside its own body.
 */
function resetRetiredTheme(storageKey: string, themes: string[], base: string) {
  try {
    const stored = localStorage.getItem(storageKey)
    if (stored && !themes.includes(stored)) {
      const mode = stored.endsWith("-dark") ? "dark" : "light"
      localStorage.setItem(storageKey, `${base}-${mode}`)
    }
  } catch {
    // storage unavailable
  }
}

/**
 * Runs before first paint, ahead of NextThemesProvider's own inline script, so
 * that script sees the rewritten value.
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
 * The same reset for a retired theme written by a tab running the previous
 * build (next-themes follows the storage event).
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
