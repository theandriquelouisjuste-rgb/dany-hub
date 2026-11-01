import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

const PrefsCtx = createContext(null)
export const usePrefs = () => useContext(PrefsCtx)

const LS = 'danyhub:prefs'
const read = () => {
  try { return { theme: 'dark', currency: 'HTG', display_name: '', ...JSON.parse(localStorage.getItem(LS) || '{}') } }
  catch { return { theme: 'dark', currency: 'HTG', display_name: '' } }
}

export function PrefsProvider({ children }) {
  const { user } = useAuth()
  const [prefs, setPrefs] = useState(read)

  // Appliquer le thème
  useEffect(() => {
    document.documentElement.classList.toggle('light', prefs.theme === 'light')
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', prefs.theme === 'light' ? '#f2f5fa' : '#0b0e1a')
  }, [prefs.theme])

  // Charger les préférences depuis Supabase
  useEffect(() => {
    if (!user) return
    supabase.from('user_preferences').select('*').eq('user_id', user.id).maybeSingle().then(({ data }) => {
      if (data) {
        const next = { theme: data.theme, currency: data.currency, display_name: data.display_name || user.user_metadata?.display_name || '' }
        setPrefs(next)
        localStorage.setItem(LS, JSON.stringify(next))
      } else {
        setPrefs((p) => ({ ...p, display_name: p.display_name || user.user_metadata?.display_name || '' }))
      }
    })
  }, [user])

  const update = useCallback(async (patch) => {
    const next = { ...prefs, ...patch }
    setPrefs(next)
    localStorage.setItem(LS, JSON.stringify(next))
    if (user) {
      await supabase.from('user_preferences').upsert({
        user_id: user.id, theme: next.theme, currency: next.currency, display_name: next.display_name, updated_at: new Date().toISOString(),
      })
    }
  }, [prefs, user])

  return <PrefsCtx.Provider value={{ ...prefs, update }}>{children}</PrefsCtx.Provider>
}
