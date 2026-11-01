import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { CURRENCIES } from '../lib/constants'
import { fmtMoney } from '../lib/utils'

const PrefsCtx = createContext(null)
export const usePrefs = () => useContext(PrefsCtx)

const LS = 'danyhub:prefs'
const RATE_CACHE_PREFIX = 'danyhub:exchange-rates:'
const RATE_CACHE_TTL = 6 * 60 * 60 * 1000
const read = () => {
  try { return { theme: 'dark', currency: 'HTG', display_name: '', ...JSON.parse(localStorage.getItem(LS) || '{}') } }
  catch { return { theme: 'dark', currency: 'HTG', display_name: '' } }
}

export function PrefsProvider({ children }) {
  const { user } = useAuth()
  const [prefs, setPrefs] = useState(read)
  const [fx, setFx] = useState({ rates: null, updatedAt: null, loading: false, error: null })

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

  useEffect(() => {
    let active = true
    const cacheKey = `${RATE_CACHE_PREFIX}${prefs.currency}`
    let cached = null
    try {
      cached = JSON.parse(localStorage.getItem(cacheKey) || 'null')
    } catch (error) {
      console.warn('Impossible de lire les taux de change en cache', error)
    }

    const hasCachedRates = Number.isFinite(cached?.updatedAt) && cached?.rates && CURRENCIES.every((code) => Number.isFinite(cached.rates[code]))
    if (hasCachedRates) {
      setFx({
        rates: cached.rates,
        updatedAt: cached.updatedAt,
        loading: Date.now() - cached.updatedAt >= RATE_CACHE_TTL,
        error: null,
      })
      if (Date.now() - cached.updatedAt < RATE_CACHE_TTL) return () => { active = false }
    } else {
      setFx({ rates: null, updatedAt: null, loading: true, error: null })
    }

    fetch(`https://open.er-api.com/v6/latest/${prefs.currency}`)
      .then(async (response) => {
        if (!response.ok) throw new Error(`Taux de change indisponibles (${response.status})`)
        const data = await response.json()
        if (data.result !== 'success' || !data.rates) throw new Error('La source de taux de change a retourné une réponse invalide')
        const rates = Object.fromEntries(CURRENCIES.map((code) => [code, Number(data.rates[code])]))
        if (rates[prefs.currency] !== 1 || CURRENCIES.some((code) => !Number.isFinite(rates[code]) || rates[code] <= 0)) {
          throw new Error('Les taux de change reçus sont incomplets')
        }
        const next = { rates, updatedAt: Date.now() }
        try {
          localStorage.setItem(cacheKey, JSON.stringify(next))
        } catch (error) {
          console.warn('Impossible de mettre les taux de change en cache', error)
        }
        if (active) setFx({ ...next, loading: false, error: null })
      })
      .catch((error) => {
        if (active) setFx((current) => ({ ...current, loading: false, error: error.message }))
      })
    return () => { active = false }
  }, [prefs.currency])

  const convertAmount = useCallback((amount, sourceCurrency = prefs.currency) => {
    if (amount === null || amount === undefined || amount === '') return null
    const value = Number(amount)
    if (!Number.isFinite(value)) return null
    if (sourceCurrency === prefs.currency) return value
    const rate = fx.rates?.[sourceCurrency]
    return Number.isFinite(rate) && rate > 0 ? value / rate : null
  }, [fx.rates, prefs.currency])

  const convertBetween = useCallback((amount, sourceCurrency, targetCurrency) => {
    if (amount === null || amount === undefined || amount === '') return null
    const value = Number(amount)
    if (!Number.isFinite(value)) return null
    if (sourceCurrency === targetCurrency) return value
    const sourceRate = fx.rates?.[sourceCurrency]
    const targetRate = fx.rates?.[targetCurrency]
    return Number.isFinite(sourceRate) && sourceRate > 0 && Number.isFinite(targetRate) && targetRate > 0
      ? value / sourceRate * targetRate
      : null
  }, [fx.rates])

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
    ratesUpdatedAt: fx.updatedAt,
    rateLoading: fx.loading,
    rateError: fx.error,
    ratesAvailable: Boolean(fx.rates),
  }}>{children}</PrefsCtx.Provider>
}
