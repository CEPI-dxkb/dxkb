import { useState, useEffect } from 'react'
import { useTheme } from 'next-themes'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

  return (
    <Select value={theme} onValueChange={(value) => {
      setTheme(value);
    }}>
      <SelectTrigger>
        <SelectValue placeholder="Theme" />
      </SelectTrigger>
      <SelectContent>
        {themeList.map((theme) => (
          <SelectItem key={theme} value={theme}>
            {theme}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export default ThemeSwitch