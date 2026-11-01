import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { CURRENCIES, HTG_PER_CURRENCY } from '../lib/constants'
import { fmtMoney } from '../lib/utils'

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
  const rates = useMemo(() => {
    const baseRate = HTG_PER_CURRENCY[prefs.currency]
    return baseRate ? Object.fromEntries(CURRENCIES.map((code) => [code, baseRate / HTG_PER_CURRENCY[code]])) : {}
  }, [prefs.currency])

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

  const convertAmount = useCallback((amount, sourceCurrency = prefs.currency) => {
    if (amount === null || amount === undefined || amount === '') return null
    const value = Number(amount)
    if (!Number.isFinite(value)) return null
    if (sourceCurrency === prefs.currency) return value
    const rate = rates[sourceCurrency]
    return Number.isFinite(rate) && rate > 0 ? value / rate : null
  }, [prefs.currency, rates])

  const convertBetween = useCallback((amount, sourceCurrency, targetCurrency) => {
    if (amount === null || amount === undefined || amount === '') return null
    const value = Number(amount)
    if (!Number.isFinite(value)) return null
    if (sourceCurrency === targetCurrency) return value
    const sourceRate = rates[sourceCurrency]
    const targetRate = rates[targetCurrency]
    return Number.isFinite(sourceRate) && sourceRate > 0 && Number.isFinite(targetRate) && targetRate > 0
      ? value / sourceRate * targetRate
      : null
  }, [rates])

  const formatCurrency = useCallback((amount, sourceCurrency = prefs.currency) => {
    const converted = convertAmount(amount, sourceCurrency)
    return converted === null ? fmtMoney(amount, sourceCurrency) : fmtMoney(converted, prefs.currency)
  }, [convertAmount, prefs.currency])

  const update = useCallback(async (patch) => {
    const next = { ...prefs, ...patch }
    setPrefs(next)
    localStorage.setItem(LS, JSON.stringify(next))
    if (user) {
      const { error } = await supabase.from('user_preferences').upsert({
        user_id: user.id, theme: next.theme, currency: next.currency, display_name: next.display_name, updated_at: new Date().toISOString(),
      })
      if (error) throw error
    }
  }, [prefs, user])

  return <PrefsCtx.Provider value={{
    ...prefs,
    update,
    convertAmount,
    convertBetween,
    formatCurrency,
    currencyToHtgRate: HTG_PER_CURRENCY[prefs.currency],
  }}>{children}</PrefsCtx.Provider>
}
