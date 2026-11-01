import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeftRight, Calculator as CalcIcon, Percent, PiggyBank, RefreshCw, Tag, TrendingUp, Delete } from 'lucide-react'
import { usePrefs } from '../context/PrefsContext'
import { Button, Card, Field, Input, PageHeader, Select, Tabs } from '../components/ui'
import { CURRENCIES } from '../lib/constants'
import { cn, fmtMoney, fmtNum } from '../lib/utils'

/* ---------- Évaluateur sûr (sans eval) ---------- */
function evaluate(src) {
  const t = src.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').match(/\d+\.?\d*|\.\d+|[+\-*/()%]/g)
  if (!t) return 0
  let i = 0
  const peek = () => t[i]
  const expr = () => { let v = term(); while (peek() === '+' || peek() === '-') { const o = t[i++]; const r = term(); v = o === '+' ? v + r : v - r } return v }
  const term = () => { let v = factor(); while (peek() === '*' || peek() === '/') { const o = t[i++]; const r = factor(); if (o === '/' && r === 0) throw new Error('div0'); v = o === '*' ? v * r : v / r } return v }
  const factor = () => {
    const x = t[i++]
    if (x === undefined) throw new Error('syntax')
    if (x === '-') return -factor()
    if (x === '+') return factor()
    if (x === '(') { const v = expr(); if (t[i++] !== ')') throw new Error('paren'); return v }
    let v = parseFloat(x)
    if (isNaN(v)) throw new Error('syntax')
    while (peek() === '%') { i++; v /= 100 }
    return v
  }
  const r = expr()
  if (i < t.length) throw new Error('syntax')
  return r
}

function Standard() {
  const [expr, setExpr] = useState('')
  const [result, setResult] = useState('')
  const [history, setHistory] = useState([])
  const press = (k) => {
    if (k === 'C') { setExpr(''); setResult(''); return }
    if (k === '⌫') { setExpr((e) => e.slice(0, -1)); return }
    if (k === '=') {
      try {
        const v = evaluate(expr); const r = String(+v.toFixed(10))
        setResult(r); setHistory((h) => [{ e: expr, r }, ...h].slice(0, 8)); setExpr(r)
      } catch (e) { setResult(e.message === 'div0' ? 'Division par 0' : 'Erreur') }
      return
    }
    setExpr((e) => e + k)
  }
  useEffect(() => {
    const h = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return
      if (/[0-9.+\-*/()%]/.test(e.key)) press(e.key === '*' ? '×' : e.key === '/' ? '÷' : e.key)
      else if (e.key === 'Enter') press('=')
      else if (e.key === 'Backspace') press('⌫')
      else if (e.key === 'Escape') press('C')
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  })
  const keys = ['C', '(', ')', '÷', '7', '8', '9', '×', '4', '5', '6', '−', '1', '2', '3', '+', '0', '.', '%', '=']
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Card>
        <div className="rounded-2xl bg-field border border-line p-4 mb-4 text-right min-h-[92px] flex flex-col justify-end">
          <p className="text-sm text-muted break-all min-h-[20px]">{result && expr !== result ? expr : ''}</p>
          <p className="text-3xl font-semibold break-all">{expr || '0'}</p>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {keys.map((k) => (
            <button key={k} onClick={() => press(k)}
              className={cn('rounded-xl py-3.5 text-lg font-medium transition active:scale-95',
                k === '=' ? 'bg-accent text-[rgb(11_14_26)]' : ['÷', '×', '−', '+'].includes(k) ? 'bg-accent/15 text-accent' : k === 'C' ? 'bg-red-500/15 text-red-400' : 'bg-card2 hover:bg-line')}>{k}</button>
          ))}
          <button onClick={() => press('⌫')} className="col-span-4 rounded-xl py-2.5 bg-card2 text-muted hover:bg-line flex items-center justify-center gap-2 text-sm"><Delete size={16} />Effacer</button>
        </div>
        {result === 'Erreur' || result === 'Division par 0' ? <p className="text-red-400 text-sm mt-3">{result}</p> : null}
      </Card>
      <Card>
        <h3 className="font-semibold mb-3">Historique</h3>
        {history.length === 0 ? <p className="text-sm text-muted">Aucun calcul pour l'instant.</p> : (
          <ul className="space-y-2">{history.map((h, i) => (
            <li key={i} className="rounded-xl bg-card2 px-3 py-2 text-sm flex justify-between gap-3 cursor-pointer hover:bg-line" onClick={() => setExpr(h.r)}>
              <span className="text-muted truncate">{h.e}</span><b>= {h.r}</b>
            </li>))}</ul>
        )}
      </Card>
    </div>
  )
}

const Result = ({ label, value, tone }) => (
  <div className="rounded-xl bg-card2 p-4">
    <p className="text-xs text-muted">{label}</p>
    <p className={cn('text-xl font-semibold mt-1', tone === 'good' && 'text-emerald-400', tone === 'bad' && 'text-red-400')}>{value}</p>
  </div>
)
const num = (v) => (v === '' || isNaN(Number(v)) ? null : Number(v))

function Percentage() {
  const [mode, setMode] = useState('of')
  const [a, setA] = useState(''); const [b, setB] = useState('')
  const A = num(a), B = num(b)
  const out = A === null || B === null ? null :
    mode === 'of' ? { l: `${fmtNum(A)}% de ${fmtNum(B)}`, v: fmtNum((A / 100) * B) } :
    mode === 'is' ? { l: `${fmtNum(A)} représente (% de ${fmtNum(B)})`, v: B === 0 ? '—' : fmtNum((A / B) * 100) + ' %' } :
    { l: `Variation de ${fmtNum(A)} à ${fmtNum(B)}`, v: A === 0 ? '—' : fmtNum(((B - A) / Math.abs(A)) * 100) + ' %' }
  const labels = { of: ['Pourcentage (%)', 'Valeur'], is: ['Partie', 'Total'], change: ['Valeur de départ', "Valeur d'arrivée"] }[mode]
  return (
    <Card className="max-w-xl">
      <Tabs value={mode} onChange={setMode} tabs={[{ id: 'of', label: 'X % de Y' }, { id: 'is', label: 'X est quel % de Y' }, { id: 'change', label: 'Variation' }]} />
      <div className="grid grid-cols-2 gap-3 mt-5">
        <Field label={labels[0]}><Input type="number" value={a} onChange={(e) => setA(e.target.value)} /></Field>
        <Field label={labels[1]}><Input type="number" value={b} onChange={(e) => setB(e.target.value)} /></Field>
      </div>
      {out && <div className="mt-5"><Result label={out.l} value={out.v} /></div>}
    </Card>
  )
}

const FALLBACK_RATES = { USD: 1, HTG: 131, EUR: 0.92, DOP: 59, CAD: 1.37, GBP: 0.79 }
function Converter() {
  const { currency } = usePrefs()
  const [rates, setRates] = useState(null)
  const [updated, setUpdated] = useState('')
  const [live, setLive] = useState(true)
  const [loading, setLoading] = useState(false)
  const [amount, setAmount] = useState('100')
  const [from, setFrom] = useState('USD')
  const [to, setTo] = useState(currency === 'USD' ? 'HTG' : currency)

  const load = useCallback(async (force = false) => {
    const cache = JSON.parse(localStorage.getItem('danyhub:rates') || 'null')
    if (!force && cache && Date.now() - cache.t < 3600000) { setRates(cache.rates); setUpdated(cache.updated); setLive(true); return }
    setLoading(true)
    try {
      const r = await fetch('https://open.er-api.com/v6/latest/USD')
      const j = await r.json()
      if (j.result !== 'success') throw new Error('api')
      setRates(j.rates); setUpdated(j.time_last_update_utc); setLive(true)
      localStorage.setItem('danyhub:rates', JSON.stringify({ t: Date.now(), rates: j.rates, updated: j.time_last_update_utc }))
    } catch {
      setRates(cache?.rates || FALLBACK_RATES); setUpdated(cache?.updated || ''); setLive(Boolean(cache))
    }
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const list = useMemo(() => rates ? [...new Set([...CURRENCIES, ...Object.keys(rates).sort()])] : CURRENCIES, [rates])
  const A = num(amount)
  const converted = rates && A !== null && rates[from] && rates[to] ? (A / rates[from]) * rates[to] : null
  const unit = rates && rates[from] && rates[to] ? rates[to] / rates[from] : null

  return (
    <Card className="max-w-xl">
      <div className="space-y-4">
        <Field label="Montant"><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-end">
          <Field label="De"><Select value={from} onChange={(e) => setFrom(e.target.value)}>{list.map((c) => <option key={c}>{c}</option>)}</Select></Field>
          <Button variant="ghost" size="icon" onClick={() => { setFrom(to); setTo(from) }} className="mb-0.5"><ArrowLeftRight size={16} /></Button>
          <Field label="Vers"><Select value={to} onChange={(e) => setTo(e.target.value)}>{list.map((c) => <option key={c}>{c}</option>)}</Select></Field>
        </div>
        {converted !== null && <Result label={`${fmtNum(A)} ${from} =`} value={`${fmtNum(converted, 4)} ${to}`} />}
        {unit && <p className="text-xs text-muted">1 {from} = {fmtNum(unit, 4)} {to}</p>}
        <div className="flex items-center justify-between text-xs text-muted">
          <span>{live && updated ? `Taux mis à jour : ${new Date(updated).toLocaleString('fr-FR')}` : '⚠️ Hors ligne — taux approximatifs'}</span>
          <Button size="sm" variant="ghost" onClick={() => load(true)} disabled={loading}><RefreshCw size={13} className={loading ? 'animate-spin' : ''} />Actualiser</Button>
        </div>
      </div>
    </Card>
  )
}

function ProfitLoss() {
  const { currency } = usePrefs()
  const [cost, setCost] = useState(''); const [sell, setSell] = useState(''); const [qty, setQty] = useState('1')
  const C = num(cost), S = num(sell), Q = num(qty) || 1
  const ok = C !== null && S !== null
  const profit = ok ? (S - C) * Q : 0
  return (
    <Card className="max-w-xl">
      <div className="grid grid-cols-3 gap-3">
        <Field label="Prix d'achat (unité)"><Input type="number" value={cost} onChange={(e) => setCost(e.target.value)} /></Field>
        <Field label="Prix de vente (unité)"><Input type="number" value={sell} onChange={(e) => setSell(e.target.value)} /></Field>
        <Field label="Quantité"><Input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} /></Field>
      </div>
      {ok && (
        <div className="grid grid-cols-2 gap-3 mt-5">
          <Result label={profit >= 0 ? 'Bénéfice' : 'Perte'} value={fmtMoney(Math.abs(profit), currency)} tone={profit >= 0 ? 'good' : 'bad'} />
          <Result label="Marge sur coût" value={C ? fmtNum(((S - C) / C) * 100) + ' %' : '—'} tone={profit >= 0 ? 'good' : 'bad'} />
          <Result label="Marge sur vente" value={S ? fmtNum(((S - C) / S) * 100) + ' %' : '—'} />
          <Result label="Chiffre d'affaires" value={fmtMoney(S * Q, currency)} />
        </div>
      )}
    </Card>
  )
}

function Discount() {
  const { currency } = usePrefs()
  const [price, setPrice] = useState(''); const [pct, setPct] = useState(''); const [pct2, setPct2] = useState('')
  const P = num(price), D = num(pct), D2 = num(pct2) || 0
  const ok = P !== null && D !== null
  const afterFirst = ok ? P * (1 - D / 100) : 0
  const final = ok ? afterFirst * (1 - D2 / 100) : 0
  return (
    <Card className="max-w-xl">
      <div className="grid grid-cols-3 gap-3">
        <Field label="Prix initial"><Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} /></Field>
        <Field label="Remise (%)"><Input type="number" value={pct} onChange={(e) => setPct(e.target.value)} /></Field>
        <Field label="2e remise (%)"><Input type="number" value={pct2} onChange={(e) => setPct2(e.target.value)} placeholder="optionnel" /></Field>
      </div>
      {ok && (
        <div className="grid grid-cols-2 gap-3 mt-5">
          <Result label="Prix final" value={fmtMoney(final, currency)} tone="good" />
          <Result label="Tu économises" value={fmtMoney(P - final, currency)} />
          <Result label="Remise totale" value={P ? fmtNum(((P - final) / P) * 100) + ' %' : '—'} />
        </div>
      )}
    </Card>
  )
}

function BudgetCalc() {
  const { currency } = usePrefs()
  const [income, setIncome] = useState('')
  const [items, setItems] = useState([{ n: 'Loyer', v: '' }, { n: 'Transport', v: '' }])
  const I = num(income)
  const fixed = items.reduce((a, x) => a + (num(x.v) || 0), 0)
  const rest = (I || 0) - fixed
  const rule = I ? [['Besoins (50%)', I * 0.5, fixed], ['Envies (30%)', I * 0.3], ['Épargne (20%)', I * 0.2]] : []
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Card>
        <Field label={`Revenu mensuel (${currency})`}><Input type="number" value={income} onChange={(e) => setIncome(e.target.value)} /></Field>
        <p className="text-xs text-muted mt-5 mb-2">Dépenses fixes</p>
        <div className="space-y-2">
          {items.map((it, i) => (
            <div key={i} className="flex gap-2">
              <Input value={it.n} onChange={(e) => setItems(items.map((x, j) => j === i ? { ...x, n: e.target.value } : x))} />
              <Input type="number" className="!w-32" value={it.v} onChange={(e) => setItems(items.map((x, j) => j === i ? { ...x, v: e.target.value } : x))} />
              <Button variant="danger" size="icon" onClick={() => setItems(items.filter((_, j) => j !== i))}>×</Button>
            </div>
          ))}
        </div>
        <Button variant="ghost" size="sm" className="mt-3" onClick={() => setItems([...items, { n: '', v: '' }])}>+ Ajouter une ligne</Button>
      </Card>
      <Card>
        <div className="grid grid-cols-2 gap-3">
          <Result label="Total dépenses fixes" value={fmtMoney(fixed, currency)} />
          <Result label="Reste disponible" value={fmtMoney(rest, currency)} tone={rest >= 0 ? 'good' : 'bad'} />
        </div>
        {I ? (
          <>
            <p className="text-xs text-muted mt-5 mb-2">Répartition conseillée 50 / 30 / 20</p>
            <ul className="space-y-2">{rule.map(([l, v, used]) => (
              <li key={l} className="flex justify-between rounded-xl bg-card2 px-3 py-2.5 text-sm"><span>{l}</span><b>{fmtMoney(v, currency)}</b></li>
            ))}</ul>
            {fixed > I * 0.5 && <p className="text-xs text-amber-400 mt-3">⚠️ Tes dépenses fixes dépassent 50 % du revenu.</p>}
          </>
        ) : null}
      </Card>
    </div>
  )
}

export default function Calculators() {
  const [tab, setTab] = useState('standard')
  return (
    <div>
      <PageHeader title="Calculatrices" subtitle="Des outils rapides pour tes calculs du quotidien" />
      <div className="mb-5">
        <Tabs value={tab} onChange={setTab} tabs={[
          { id: 'standard', label: 'Standard', icon: CalcIcon }, { id: 'percent', label: 'Pourcentage', icon: Percent },
          { id: 'currency', label: 'Devises', icon: ArrowLeftRight }, { id: 'pl', label: 'Profit / Perte', icon: TrendingUp },
          { id: 'discount', label: 'Remise', icon: Tag }, { id: 'budget', label: 'Budget', icon: PiggyBank }]} />
      </div>
      {tab === 'standard' && <Standard />}
      {tab === 'percent' && <Percentage />}
      {tab === 'currency' && <Converter />}
      {tab === 'pl' && <ProfitLoss />}
      {tab === 'discount' && <Discount />}
      {tab === 'budget' && <BudgetCalc />}
    </div>
  )
}
