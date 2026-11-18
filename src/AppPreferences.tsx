import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { CAMPUS_LOCATION } from './campus'
import { useCurrentLocation } from './useCurrentLocation'

export type ThemePreference = 'light' | 'dark' | 'system'
const themeKey = 'group-delivery-theme'

function usePreferencesState() {
  const currentLocation = useCurrentLocation(CAMPUS_LOCATION)
  const [themePreference, setThemePreference] = useState<ThemePreference>(() => {
    try {
      const stored = window.localStorage.getItem(themeKey)
      return stored === 'light' || stored === 'dark' ? stored : 'system'
    } catch { return 'system' }
  })
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const update = () => setSystemDark(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  useEffect(() => {
    try { window.localStorage.setItem(themeKey, themePreference) } catch { /* Keep the chosen theme in memory when storage is unavailable. */ }
  }, [themePreference])
  return { currentLocation, themePreference, setThemePreference, isDark: themePreference === 'dark' || (themePreference === 'system' && systemDark) }
}

const Context = createContext<ReturnType<typeof usePreferencesState> | null>(null)
export function AppPreferencesProvider({ children }: { children: ReactNode }) {
  return <Context.Provider value={usePreferencesState()}>{children}</Context.Provider>
}
export function usePreferences() {
  const preferences = useContext(Context)
  if (!preferences) throw new Error('AppPreferencesProvider is required')
  return preferences
}
