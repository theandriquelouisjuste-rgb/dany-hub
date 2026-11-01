import { useMemo, useState } from 'react'
import { Pencil, PiggyBank, Plus, Trash2, History } from 'lucide-react'
import { useTable } from '../hooks/useTable'
import { usePrefs } from '../context/PrefsContext'
import { useToast } from '../components/Toast'
import { Button, Card, Empty, Field, Input, Modal, PageHeader, Progress, Select, StatCard } from '../components/ui'
import { CHART_COLORS, COLORS, CURRENCIES } from '../lib/constants'
import { fmtDate, sum, sumConverted, toDateStr } from '../lib/utils'

export default function Savings() {
  const { currency, convertBetween, convertAmount, formatCurrency, rateError } = usePrefs()
  const money = (n, sourceCurrency = currency) => n === null ? '—' : formatCurrency(n, sourceCurrency)
  const goals = useTable('savings_goals')
  const contribs = useTable('savings_contributions', { orderBy: 'date' })
  const toast = useToast()
  const [gform, setGform] = useState(null)
  const [cform, setCform] = useState(null)
  const [detail, setDetail] = useState(null)

  const data = useMemo(() => goals.rows.map((g) => {
    const list = contribs.rows.filter((c) => c.goal_id === g.id)
    const goalCurrency = g.currency || currency
    const saved = sumConverted(list, (c) => c.amount, goalCurrency, (amount, sourceCurrency) => convertBetween(amount, sourceCurrency, goalCurrency))
    const remaining = saved === null ? null : Math.max(0, g.target_amount - saved)
    const pct = saved === null ? null : (saved / g.target_amount) * 100
    let estimate = null, monthlyNeeded = null
    if (remaining > 0 && g.deadline) {
      const months = Math.max(1, (new Date(g.deadline) - new Date()) / (1000 * 60 * 60 * 24 * 30.44))
      monthlyNeeded = remaining / months
    }
    if (remaining > 0 && list.length >= 1) {
      const first = new Date(list[list.length - 1].date + 'T00:00:00')
      const months = Math.max(1, (new Date() - first) / (1000 * 60 * 60 * 24 * 30.44))
      const pace = saved / months
      if (pace > 0) { const d = new Date(); d.setDate(d.getDate() + (remaining / pace) * 30.44); estimate = d }
    }
    return { ...g, list, saved, remaining, pct, estimate, monthlyNeeded }
  }), [goals.rows, contribs.rows, currency, convertBetween])

  const totalSaved = sumConverted(data, (g) => g.saved, currency, convertAmount)
  const totalTarget = sumConverted(data, (g) => g.target_amount, currency, convertAmount)
  const dataError = goals.error || contribs.error
  const conversionWarning = rateError || (data.some((goal) => goal.saved === null || convertAmount(goal.target_amount, goal.currency || currency) === null) ? 'Connexion Internet nécessaire pour convertir des montants.' : null)

  const saveGoal = async (e) => {
    e.preventDefault()
    const p = { name: gform.name.trim(), target_amount: Number(gform.target_amount), currency: gform.currency || currency, deadline: gform.deadline || null, color: gform.color }
    if (!(p.target_amount > 0)) return toast('Montant cible invalide', 'error')
    try { if (gform.id) await goals.update(gform.id, p); else await goals.insert(p); toast('Objectif enregistré'); setGform(null) } catch (err) { toast(err.message, 'error') }
  }
  const saveContrib = async (e) => {
    e.preventDefault()
    const amount = Number(cform.amount)
    if (!(amount > 0)) return toast('Montant invalide', 'error')
    try { await contribs.insert({ goal_id: cform.goal_id, amount, currency: cform.currency || currency, date: cform.date, note: cform.note || null }); toast('Contribution ajoutée'); setCform(null) } catch (err) { toast(err.message, 'error') }
  }
  const delGoal = async (g) => { if (confirm(`Supprimer l'objectif « ${g.name} » et ses contributions ?`)) { try { await goals.remove(g.id); await contribs.reload(); toast('Objectif supprimé') } catch (e) { toast(e.message, 'error') } } }
  const current = detail ? data.find((g) => g.id === detail) : null

  return (
    <div>
      <PageHeader title="Épargne" subtitle="Objectifs, contributions et progression"
        actions={<Button onClick={() => setGform({ name: '', target_amount: '', currency, deadline: '', color: CHART_COLORS[goals.rows.length % CHART_COLORS.length] })}><Plus size={16} />Nouvel objectif</Button>} />
      {dataError && <p role="alert" className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">Impossible de charger les objectifs ou contributions : {dataError}. Vérifie que le schéma Supabase est à jour.</p>}
      {conversionWarning && <p role="status" className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300">Les montants des autres devises restent affichés dans leur devise d'origine tant que le taux n'est pas disponible. {conversionWarning}</p>}

      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <StatCard icon={PiggyBank} label="Total épargné" value={money(totalSaved)} color={COLORS.green} />
        <StatCard icon={PiggyBank} label="Objectifs cumulés" value={money(totalTarget)} color={COLORS.accent} />
        <StatCard icon={PiggyBank} label="Reste à épargner" value={money(totalTarget === null || totalSaved === null ? null : Math.max(0, totalTarget - totalSaved))} color={COLORS.amber} />
      </div>

      {data.length === 0 ? <Card><Empty icon={PiggyBank} text="Crée ton premier objectif d'épargne" /></Card> : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {data.map((g) => (
            <Card key={g.id}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-2xl grid place-items-center" style={{ background: g.color + '25', color: g.color }}><PiggyBank size={20} /></div>
                  <div><h4 className="font-semibold">{g.name}</h4><p className="text-xs text-muted">{g.deadline ? `Échéance ${fmtDate(g.deadline)}` : 'Sans échéance'}</p></div>
                </div>
                <div className="flex">
                  <button onClick={() => setGform({ ...g, deadline: g.deadline || '', target_amount: String(g.target_amount) })} className="p-1.5 text-muted hover:text-accent"><Pencil size={15} /></button>
                  <button onClick={() => delGoal(g)} className="p-1.5 text-muted hover:text-red-400"><Trash2 size={15} /></button>
                </div>
              </div>
              <div className="flex items-end justify-between mb-2">
                <p className="text-xl font-semibold">{money(g.saved, g.currency || currency)}</p>
                <p className="text-xs text-muted">/ {money(g.target_amount, g.currency || currency)}</p>
              </div>
              <Progress value={g.pct || 0} color={g.color} />
              <div className="flex justify-between text-xs mt-2">
                <span style={{ color: g.color }}>{g.pct === null ? '—' : `${Math.min(100, Math.round(g.pct))}%`}</span>
                <span className="text-muted">{g.remaining === null ? 'Taux indisponible' : g.remaining > 0 ? `Reste ${money(g.remaining, g.currency || currency)}` : '🎉 Objectif atteint !'}</span>
              </div>
              {g.remaining > 0 && (g.monthlyNeeded || g.estimate) && (
                <div className="mt-3 rounded-xl bg-card2 p-3 text-xs text-muted space-y-1">
                  {g.monthlyNeeded && <p>À épargner : <b className="text-ink">{money(g.monthlyNeeded, g.currency || currency)}</b> / mois pour tenir l'échéance</p>}
                  {g.estimate && <p>Au rythme actuel : atteint vers <b className="text-ink">{g.estimate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</b></p>}
                </div>
              )}
              <div className="flex gap-2 mt-4">
                <Button size="sm" className="flex-1" onClick={() => setCform({ goal_id: g.id, amount: '', currency, date: toDateStr(), note: '' })}><Plus size={14} />Contribuer</Button>
                <Button size="sm" variant="ghost" onClick={() => setDetail(g.id)}><History size={14} />{g.list.length}</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!gform} onClose={() => setGform(null)} title={gform?.id ? "Modifier l'objectif" : 'Nouvel objectif'}>
        {gform && (
          <form onSubmit={saveGoal} className="space-y-4">
            <Field label="Nom"><Input required autoFocus value={gform.name} onChange={(e) => setGform({ ...gform, name: e.target.value })} placeholder="Ex : Nouvelle moto" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={`Montant cible (${gform.currency || currency})`}><Input required type="number" min="1" step="0.01" value={gform.target_amount} onChange={(e) => setGform({ ...gform, target_amount: e.target.value })} /></Field>
              <Field label="Échéance (optionnel)"><Input type="date" value={gform.deadline} onChange={(e) => setGform({ ...gform, deadline: e.target.value })} /></Field>
            </div>
            <Field label="Devise de l'objectif"><Select value={gform.currency || currency} onChange={(e) => setGform({ ...gform, currency: e.target.value })}>{CURRENCIES.map((code) => <option key={code}>{code}</option>)}</Select></Field>
            <Field label="Couleur">
              <div className="flex gap-2">{CHART_COLORS.map((c) => <button type="button" key={c} onClick={() => setGform({ ...gform, color: c })} className={`h-8 w-8 rounded-full border-2 ${gform.color === c ? 'border-ink' : 'border-transparent'}`} style={{ background: c }} />)}</div>
            </Field>
            <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setGform(null)}>Annuler</Button><Button type="submit">Enregistrer</Button></div>
          </form>
        )}
      </Modal>

      <Modal open={!!cform} onClose={() => setCform(null)} title="Ajouter une contribution">
        {cform && (
          <form onSubmit={saveContrib} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label={`Montant (${cform.currency || currency})`}><Input required autoFocus type="number" min="0.01" step="0.01" value={cform.amount} onChange={(e) => setCform({ ...cform, amount: e.target.value })} /></Field>
              <Field label="Date"><Input required type="date" value={cform.date} onChange={(e) => setCform({ ...cform, date: e.target.value })} /></Field>
            </div>
            <Field label="Devise de la contribution"><Select value={cform.currency || currency} onChange={(e) => setCform({ ...cform, currency: e.target.value })}>{CURRENCIES.map((code) => <option key={code}>{code}</option>)}</Select></Field>
            <Field label="Note"><Input value={cform.note} onChange={(e) => setCform({ ...cform, note: e.target.value })} /></Field>
            <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setCform(null)}>Annuler</Button><Button type="submit">Ajouter</Button></div>
          </form>
        )}
      </Modal>

      <Modal open={!!current} onClose={() => setDetail(null)} title={current ? `Contributions — ${current.name}` : ''}>
        {current && (current.list.length === 0 ? <Empty text="Aucune contribution" /> : (
          <ul className="space-y-2">
            {current.list.map((c) => (
              <li key={c.id} className="flex items-center justify-between rounded-xl bg-card2 px-3 py-2.5">
                <div><p className="text-sm font-medium">{money(c.amount, c.currency || current.currency || currency)}</p><p className="text-xs text-muted">{fmtDate(c.date)}{c.note && ` · ${c.note}`}</p></div>
                <button onClick={async () => { if (confirm('Supprimer cette contribution ?')) await contribs.remove(c.id) }} className="p-1.5 text-muted hover:text-red-400"><Trash2 size={15} /></button>
              </li>
            ))}
          </ul>
        ))}
      </Modal>
    </div>
  )
}
