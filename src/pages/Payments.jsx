import { useMemo, useState } from 'react'
import { CreditCard, Download, FileText, Paperclip, Pencil, Plus, Repeat, Search, ShieldCheck, Trash2, CheckCircle2 } from 'lucide-react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, Bar, BarChart, XAxis, YAxis, CartesianGrid } from 'recharts'
import { useTable } from '../hooks/useTable'
import { useCategories } from '../hooks/useCategories'
import { useAuth } from '../context/AuthContext'
import { usePrefs } from '../context/PrefsContext'
import { useToast } from '../components/Toast'
import { supabase } from '../lib/supabase'
import { Badge, Button, Card, Empty, Field, Input, Modal, PageHeader, Select, StatCard, Tabs, Textarea, chartTooltip } from '../components/ui'
import { COLORS, CURRENCIES, FREQUENCIES, PAYMENT_METHODS, methodOf } from '../lib/constants'
import { exportCSV, exportPDF, plain } from '../lib/export'
import { addFrequency, fmtDate, groupSumConverted, monthKey, monthLabel, sumConverted, thisMonth, toDateStr } from '../lib/utils'

const empty = (currency) => ({ merchant: '', amount: '', currency, date: toDateStr(), method: 'cash', category: 'Shopping', notes: '', is_recurring: false, frequency: 'monthly', next_due: '', also_expense: true, file: null })

export default function Payments() {
  const { user } = useAuth()
  const { currency, convertAmount, formatCurrency, rateError, ratesAvailable } = usePrefs()
  const money = (n, sourceCurrency = currency) => n === null ? '—' : formatCurrency(n, sourceCurrency)
  const pay = useTable('payments', { orderBy: 'date' })
  const tx = useTable('transactions')
  const cats = useCategories('expense')
  const toast = useToast()
  const [tab, setTab] = useState('history')
  const [form, setForm] = useState(null)
  const [busy, setBusy] = useState(false)
  const [q, setQ] = useState('')
  const [fm, setFm] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const history = useMemo(() => pay.rows.filter((p) => !p.is_recurring), [pay.rows])
  const subs = useMemo(() => pay.rows.filter((p) => p.is_recurring).sort((a, b) => (a.next_due || '9').localeCompare(b.next_due || '9')), [pay.rows])
  const filtered = useMemo(() => history.filter((p) =>
    (!fm || p.method === fm) && (!from || p.date >= from) && (!to || p.date <= to) &&
    (!q || `${p.merchant} ${p.category || ''}`.toLowerCase().includes(q.toLowerCase()))
  ), [history, fm, from, to, q])

  const monthTotal = sumConverted(history.filter((p) => monthKey(p.date) === thisMonth()), (p) => p.amount, currency, convertAmount)
  const monthlySubs = subs.map((s) => ({ ...s, monthlyAmount: s.frequency === 'weekly' ? s.amount * 4.33 : s.frequency === 'yearly' ? s.amount / 12 : s.amount }))
  const subsMonthly = sumConverted(monthlySubs, (s) => s.monthlyAmount, currency, convertAmount)

  const byMethod = useMemo(() => {
    const grouped = groupSumConverted(history, (p) => p.method, (p) => p.amount, currency, convertAmount)
    return grouped ? Object.entries(grouped).map(([id, value]) => ({ id, name: methodOf(id).label, value, color: methodOf(id).color })) : null
  }, [history, currency, convertAmount])
  const byMonth = useMemo(() => {
    const g = groupSumConverted(history, (p) => monthKey(p.date), (p) => p.amount, currency, convertAmount)
    if (!g) return null
    return Object.keys(g).sort().slice(-6).map((k) => ({ name: monthLabel(k), Total: g[k] }))
  }, [history, currency, convertAmount])

  const save = async (e) => {
    e.preventDefault()
    const amount = Number(form.amount)
    if (!(amount > 0)) return toast('Montant invalide', 'error')
    setBusy(true)
    try {
      let receipt_path = form.receipt_path || null
      if (form.file) {
        const safe = form.file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const path = `${user.id}/${Date.now()}-${safe}`
        const { error } = await supabase.storage.from('receipts').upload(path, form.file)
        if (error) throw error
        receipt_path = path
      }
      const payload = {
        merchant: form.merchant.trim(), amount, currency: form.currency || currency, date: form.date, method: form.method, category: form.category || null,
        notes: form.notes || null, receipt_path, is_recurring: form.is_recurring,
        frequency: form.is_recurring ? form.frequency : null,
        next_due: form.is_recurring ? (form.next_due || addFrequency(form.date, form.frequency)) : null,
      }
      if (form.id) await pay.update(form.id, payload)
      else {
        await pay.insert(payload)
        if (form.also_expense && !form.is_recurring) await tx.insert({ type: 'expense', amount, currency: form.currency || currency, category: form.category || 'Autre', description: `${form.merchant} (${methodOf(form.method).label})`, date: form.date })
      }
      toast(form.id ? 'Paiement modifié' : 'Paiement enregistré'); setForm(null)
    } catch (err) { toast(err.message, 'error') }
    setBusy(false)
  }

  const del = async (p) => {
    if (!confirm(`Supprimer le paiement « ${p.merchant} » ?`)) return
    try {
      if (p.receipt_path) await supabase.storage.from('receipts').remove([p.receipt_path])
      await pay.remove(p.id); toast('Paiement supprimé')
    } catch (e) { toast(e.message, 'error') }
  }
  const openReceipt = async (path) => {
    const { data, error } = await supabase.storage.from('receipts').createSignedUrl(path, 120)
    if (error) return toast(error.message, 'error')
    window.open(data.signedUrl, '_blank')
  }
  const markPaid = async (s) => {
    try {
      await pay.insert({ merchant: s.merchant, amount: s.amount, currency: s.currency, date: toDateStr(), method: s.method, category: s.category, notes: 'Abonnement payé', is_recurring: false })
      await tx.insert({ type: 'expense', amount: s.amount, currency: s.currency, category: s.category || 'Abonnements', description: `${s.merchant} (abonnement)`, date: toDateStr() })
      await pay.update(s.id, { next_due: addFrequency(s.next_due || toDateStr(), s.frequency) })
      toast('Paiement enregistré, prochaine échéance mise à jour')
    } catch (e) { toast(e.message, 'error') }
  }

  const cols = ['Date', 'Commerçant', 'Moyen', 'Catégorie', 'Montant (devise principale si disponible)']
  const exportRows = () => filtered.map((p) => {
    const converted = convertAmount(p.amount, p.currency)
    return [p.date, p.merchant, methodOf(p.method).label, p.category || '', converted === null ? `${plain(p.amount)} ${p.currency}` : plain(converted)]
  })
  const paymentExportTotal = sumConverted(filtered, (p) => p.amount, currency, convertAmount)
  const dataError = pay.error || tx.error
  const conversionWarning = pay.rows.some((payment) => convertAmount(payment.amount, payment.currency) === null)
    ? 'Connexion Internet nécessaire pour convertir des montants.'
    : rateError && ratesAvailable ? 'La dernière mise à jour a échoué; les taux enregistrés en cache restent utilisés.' : rateError

  return (
    <div>
      <PageHeader title="Paiements" subtitle="Historique, abonnements et reçus"
        actions={<Button onClick={() => setForm(empty(currency))}><Plus size={16} />Nouveau paiement</Button>} />
      {dataError && <p role="alert" className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">Impossible de charger les paiements ou transactions : {dataError}. Vérifie que le schéma Supabase est à jour.</p>}
      {conversionWarning && <p role="status" className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300">{ratesAvailable ? 'Les montants restent convertis avec les derniers taux disponibles. ' : 'Les montants des autres devises restent affichés dans leur devise d’origine tant que le taux n’est pas disponible. '}{conversionWarning}</p>}

      <div className="mb-5 flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
        <ShieldCheck size={16} className="shrink-0 mt-0.5" />
        <span>Sécurité : seul le <b>moyen de paiement</b> est enregistré. Ne saisis jamais de numéro de carte, CVV ou PIN — DANY HUB ne les stocke pas.</span>
      </div>

      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <StatCard icon={CreditCard} label="Payé ce mois" value={money(monthTotal)} color={COLORS.accent} />
        <StatCard icon={Repeat} label="Abonnements / mois" value={money(subsMonthly)} color={COLORS.violet} sub={`${subs.length} actif(s)`} />
        <StatCard icon={Paperclip} label="Reçus enregistrés" value={pay.rows.filter((p) => p.receipt_path).length} color={COLORS.amber} />
      </div>

      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'history', label: 'Historique', icon: CreditCard }, { id: 'subs', label: 'Abonnements', icon: Repeat }, { id: 'reports', label: 'Rapports', icon: FileText }]} />

      {tab === 'history' && (
        <Card className="mt-5">
          <div className="flex flex-wrap gap-2 mb-4 items-center">
            <div className="relative flex-1 min-w-[160px]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <Input className="!pl-9" placeholder="Commerçant, catégorie…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <Select value={fm} onChange={(e) => setFm(e.target.value)} className="!w-auto"><option value="">Tous moyens</option>{PAYMENT_METHODS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</Select>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="!w-auto" />
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="!w-auto" />
            <Button variant="ghost" size="sm" onClick={() => exportCSV('paiements.csv', cols, exportRows())}><Download size={14} />CSV</Button>
            <Button variant="ghost" size="sm" onClick={() => exportPDF('paiements.pdf', 'Historique des paiements', cols, exportRows(), paymentExportTotal === null ? 'Total indisponible : taux de change manquant' : `Total ${plain(paymentExportTotal)} ${currency}`)}><FileText size={14} />PDF</Button>
          </div>
          {filtered.length === 0 ? <Empty icon={CreditCard} text="Aucun paiement" /> : (
            <div className="space-y-2">
              {filtered.map((p) => {
                const m = methodOf(p.method)
                return (
                  <div key={p.id} className="flex items-center gap-3 rounded-xl border border-line bg-card2/40 p-3">
                    <div className="h-10 w-10 rounded-xl grid place-items-center shrink-0" style={{ background: m.color + '25', color: m.color }}><CreditCard size={18} /></div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{p.merchant}</p>
                      <p className="text-xs text-muted">{fmtDate(p.date)} · {p.category || 'Sans catégorie'}</p>
                    </div>
                    <Badge color={m.color} className="hidden sm:inline-flex">{m.label}</Badge>
                    <span className="text-sm font-semibold whitespace-nowrap">{money(p.amount, p.currency)}</span>
                    <div className="flex">
                      {p.receipt_path && <button title="Voir le reçu" onClick={() => openReceipt(p.receipt_path)} className="p-1.5 text-accent"><Paperclip size={15} /></button>}
                      <button onClick={() => setForm({ ...empty(currency), ...p, amount: String(p.amount), notes: p.notes || '', next_due: p.next_due || '', file: null })} className="p-1.5 text-muted hover:text-accent"><Pencil size={15} /></button>
                      <button onClick={() => del(p)} className="p-1.5 text-muted hover:text-red-400"><Trash2 size={15} /></button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      )}

      {tab === 'subs' && (
        <div className="mt-5 grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {subs.length === 0 && <Card className="md:col-span-2 xl:col-span-3"><Empty icon={Repeat} text="Aucun abonnement. Crée un paiement et active « Paiement récurrent »." /></Card>}
          {subs.map((s) => {
            const m = methodOf(s.method)
            const due = s.next_due && s.next_due <= toDateStr()
            return (
              <Card key={s.id}>
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-medium">{s.merchant}</h4>
                    <p className="text-xs text-muted">{FREQUENCIES.find((f) => f.id === s.frequency)?.label} · <span style={{ color: m.color }}>{m.label}</span></p>
                  </div>
                  <p className="font-semibold">{money(s.amount, s.currency)}</p>
                </div>
                <p className={`text-xs mt-3 ${due ? 'text-red-400' : 'text-muted'}`}>Prochaine échéance : {fmtDate(s.next_due)}{due && ' · à payer'}</p>
                <div className="flex gap-2 mt-4">
                  <Button size="sm" onClick={() => markPaid(s)} className="flex-1"><CheckCircle2 size={14} />Marquer payé</Button>
                  <Button size="sm" variant="ghost" onClick={() => setForm({ ...empty(currency), ...s, amount: String(s.amount), notes: s.notes || '', next_due: s.next_due || '', file: null })}><Pencil size={14} /></Button>
                  <Button size="sm" variant="danger" onClick={() => del(s)}><Trash2 size={14} /></Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {tab === 'reports' && (
        <div className="mt-5 grid lg:grid-cols-2 gap-4">
          <Card>
            <h3 className="font-semibold mb-2">Par moyen de paiement</h3>
            {byMethod === null ? <Empty text="Impossible de convertir ces montants. Vérifie ta connexion Internet." /> : byMethod.length === 0 ? <Empty text="Pas de données" /> : (
              <>
                <div className="h-56">
                  <ResponsiveContainer><PieChart><Pie data={byMethod} dataKey="value" innerRadius={55} outerRadius={85} paddingAngle={3} stroke="none">{byMethod.map((d) => <Cell key={d.id} fill={d.color} />)}</Pie><Tooltip {...chartTooltip} formatter={(v) => money(v)} /></PieChart></ResponsiveContainer>
                </div>
                <ul className="space-y-2 text-sm">{byMethod.map((d) => <li key={d.id} className="flex justify-between"><span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />{d.name}</span><span className="text-muted">{money(d.value)}</span></li>)}</ul>
              </>
            )}
          </Card>
          <Card>
            <h3 className="font-semibold mb-2">Paiements par mois</h3>
            {byMonth === null ? <Empty text="Impossible de convertir ces montants. Vérifie ta connexion Internet." /> : byMonth.length === 0 ? <Empty text="Pas de données" /> : (
              <div className="h-72"><ResponsiveContainer><BarChart data={byMonth}><CartesianGrid stroke="rgb(var(--line))" vertical={false} /><XAxis dataKey="name" stroke="rgb(var(--muted))" fontSize={12} tickLine={false} axisLine={false} /><YAxis stroke="rgb(var(--muted))" fontSize={12} tickLine={false} axisLine={false} width={50} /><Tooltip {...chartTooltip} formatter={(v) => money(v)} cursor={{ fill: 'rgb(var(--card2))' }} /><Bar dataKey="Total" fill={COLORS.accent} radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div>
            )}
          </Card>
        </div>
      )}

      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? 'Modifier le paiement' : 'Nouveau paiement'}>
        {form && (
          <form onSubmit={save} className="space-y-4">
            <Field label="Commerçant / bénéficiaire"><Input required autoFocus value={form.merchant} onChange={(e) => setForm({ ...form, merchant: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={`Montant (${form.currency || currency})`}><Input required type="number" step="0.01" min="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
              <Field label="Date"><Input required type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
            </div>
            <Field label="Devise"><Select value={form.currency || currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>{CURRENCIES.map((code) => <option key={code}>{code}</option>)}</Select></Field>
            <Field label="Moyen de paiement">
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {PAYMENT_METHODS.map((m) => (
                  <button type="button" key={m.id} onClick={() => setForm({ ...form, method: m.id })}
                    className={`rounded-xl border py-2 text-xs font-medium transition ${form.method === m.id ? '' : 'border-line text-muted'}`}
                    style={form.method === m.id ? { borderColor: m.color, background: m.color + '25', color: m.color } : {}}>{m.label}</button>
                ))}
              </div>
            </Field>
            <Field label="Catégorie"><Select value={form.category || ''} onChange={(e) => setForm({ ...form, category: e.target.value })}>{cats.all.map((c) => <option key={c}>{c}</option>)}</Select></Field>
            <Field label="Reçu (image ou PDF)"><Input type="file" accept="image/*,application/pdf" onChange={(e) => setForm({ ...form, file: e.target.files[0] || null })} /></Field>
            {form.receipt_path && !form.file && <p className="text-xs text-muted">Un reçu est déjà attaché. Choisis un fichier pour le remplacer.</p>}
            <Field label="Notes"><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_recurring} onChange={(e) => setForm({ ...form, is_recurring: e.target.checked })} />Paiement récurrent (abonnement)</label>
            {form.is_recurring && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Fréquence"><Select value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })}>{FREQUENCIES.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}</Select></Field>
                <Field label="Prochaine échéance"><Input type="date" value={form.next_due} onChange={(e) => setForm({ ...form, next_due: e.target.value })} /></Field>
              </div>
            )}
            {!form.id && !form.is_recurring && (
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.also_expense} onChange={(e) => setForm({ ...form, also_expense: e.target.checked })} />Enregistrer aussi comme dépense dans Finances</label>
            )}
            <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setForm(null)}>Annuler</Button><Button type="submit" disabled={busy}>{busy ? 'Envoi…' : 'Enregistrer'}</Button></div>
          </form>
        )}
      </Modal>
    </div>
  )
}
