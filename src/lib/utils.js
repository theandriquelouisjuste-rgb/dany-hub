export const cn = (...a) => a.filter(Boolean).join(' ')

export const toDateStr = (d = new Date()) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return z.toISOString().slice(0, 10)
}
export const monthKey = (s) => (s || '').slice(0, 7)
export const thisMonth = () => toDateStr().slice(0, 7)

export const fmtMoney = (n, currency = 'HTG') => {
  const v = Number(n) || 0
  try {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency, maximumFractionDigits: 2 }).format(v)
  } catch {
    return `${v.toFixed(2)} ${currency}`
  }
}
export const fmtNum = (n, d = 2) =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: d }).format(Number(n) || 0)

export const fmtDate = (s) => {
  if (!s) return '—'
  const d = new Date(s.length === 10 ? s + 'T00:00:00' : s)
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}
export const fmtDateTime = (s) =>
  s ? new Date(s).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'

export const toLocalInput = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return z.toISOString().slice(0, 16)
}
export const fromLocalInput = (v) => (v ? new Date(v).toISOString() : null)

export const addDays = (s, n) => {
  const d = new Date(s + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return toDateStr(d)
}
export const addFrequency = (s, freq) => {
  const d = new Date(s + 'T00:00:00')
  if (freq === 'weekly') d.setDate(d.getDate() + 7)
  else if (freq === 'yearly') d.setFullYear(d.getFullYear() + 1)
  else d.setMonth(d.getMonth() + 1)
  return toDateStr(d)
}
export const weekStart = (s) => {
  const d = new Date(s + 'T00:00:00')
  const day = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - day)
  return toDateStr(d)
}
export const monthLabel = (key) => {
  const [y, m] = key.split('-')
  return new Date(+y, +m - 1, 1).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
}
export const sum = (arr, f = (x) => x) => arr.reduce((a, b) => a + (Number(f(b)) || 0), 0)
export const groupSum = (arr, keyFn, valFn) => {
  const m = {}
  arr.forEach((x) => { const k = keyFn(x); m[k] = (m[k] || 0) + (Number(valFn(x)) || 0) })
  return m
}
