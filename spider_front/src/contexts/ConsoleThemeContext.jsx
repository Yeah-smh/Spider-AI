import { createContext, useContext, useState } from 'react'
import { useAuth } from './AuthContext'

const ConsoleThemeContext = createContext()

export function ConsoleThemeProvider({ children }) {
  const { user } = useAuth()
  const themeKey = `spider_console_theme_${user?.username || 'default'}`
  
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem(themeKey) || 'light' } catch { return 'light' }
  })
  
  const toggleTheme = (newTheme) => {
    const t = newTheme || (theme === 'light' ? 'dark' : 'light')
    setTheme(t)
    try { localStorage.setItem(themeKey, t) } catch {}
  }
  
  const isDark = theme === 'dark'
  
  return (
    <ConsoleThemeContext.Provider value={{ theme, isDark, toggleTheme }}>
      {children}
    </ConsoleThemeContext.Provider>
  )
}

export const useConsoleTheme = () => useContext(ConsoleThemeContext)
