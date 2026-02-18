import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { themeList } from "@/styles/themes";

const ThemeSwitch = () => {
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()

  // useEffect only runs on the client, so now we can safely show the UI
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  const themeItems = themeList.map((t) => ({ value: t, label: t }));

  return (
    <Select
      items={themeItems}
      value={theme}
      onValueChange={(value) => {
        if (value != null) setTheme(value);
      }}
    >
      <SelectTrigger>
        <SelectValue placeholder="Theme" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {themeList.map((t) => (
            <SelectItem key={t} value={t}>
              {t}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

export default ThemeSwitch