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
  )
}

/**
 * next-themes applies whatever theme is stored, even one no longer offered
 * (zinc and orange were retired), and no stylesheet matches it. Move such a
 * visitor onto the default theme, keeping their light/dark mode.
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
