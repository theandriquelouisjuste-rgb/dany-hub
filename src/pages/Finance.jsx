import { useMemo, useState } from 'react'
import { ArrowDownCircle, ArrowUpCircle, BarChart3, Download, FileText, Pencil, Plus, Search, Target, Trash2, Wallet, Tags } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useTable } from '../hooks/useTable'
import { useCategories } from '../hooks/useCategories'
import { usePrefs } from '../context/PrefsContext'
import { useToast } from '../components/Toast'
import { Badge, Button, Card, Empty, Field, Input, Modal, PageHeader, Progress, Select, StatCard, Tabs, chartTooltip } from '../components/ui'
import { COLORS } from '../lib/constants'
import { exportCSV, exportPDF, plain } from '../lib/export'
import { fmtDate, fmtMoney, groupSum, monthKey, sum, thisMonth, toDateStr, weekStart } from '../lib/utils'

const emptyTx = () => ({ type: 'expense', amount: '', category: 'Alimentation', description: '', date: toDateStr() })

export default function Finance() {
  const { currency } = usePrefs()
  const money = (n) => fmtMoney(n, currency)
  const tx = useTable('transactions', { orderBy: 'date' })
  const budgets = useTable('budgets', { orderBy: 'category', ascending: true })
  const expCats = useCategories('expense')
  const incCats = useCategories('income')
  const toast = useToast()
  const [tab, setTab] = useState('transactions')
  const [form, setForm] = useState(null)
  const [bform, setBform] = useState(null)
  const [catModal, setCatModal] = useState(false)
  const [newCat, setNewCat] = useState({ name: '', type: 'expense' })
  const [q, setQ] = useState('')
  const [ft, setFt] = useState('')
  const [fc, setFc] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [period, setPeriod] = useState('month')

  const allCats = [...new Set([...expCats.all, ...incCats.all])]
  const filtered = useMemo(() => tx.rows.filter((t) =>
    (!ft || t.type === ft) && (!fc || t.category === fc) && (!from || t.date >= from) && (!to || t.date <= to) &&
    (!q || `${t.description || ''} ${t.category}`.toLowerCase().includes(q.toLowerCase()))
  ), [tx.rows, ft, fc, from, to, q])

  const income = sum(tx.rows.filter((t) => t.type === 'income'), (t) => t.amount)
  const expense = sum(tx.rows.filter((t) => t.type === 'expense'), (t) => t.amount)
  const fIncome = sum(filtered.filter((t) => t.type === 'income'), (t) => t.amount)
  const fExpense = sum(filtered.filter((t) => t.type === 'expense'), (t) => t.amount)

  const saveTx = async (e) => {
    e.preventDefault()
    const p = { type: form.type, amount: Number(form.amount), category: form.category, description: form.description || null, date: form.date }
    if (!(p.amount > 0)) return toast('Montant invalide', 'error')
    try {
      if (form.id) await tx.update(form.id, p); else await tx.insert(p)
      toast(form.id ? 'Transaction modifiée' : 'Transaction ajoutée'); setForm(null)
    } catch (err) { toast(err.message, 'error') }
  }
  const delTx = async (t) => { if (confirm('Supprimer cette transaction ?')) { try { await tx.remove(t.id); toast('Supprimée') } catch (e) { toast(e.message, 'error') } } }

  const rowsForExport = () => filtered.map((t) => [t.date, t.type === 'income' ? 'Revenu' : 'Dépense', t.category, t.description || '', t.type === 'income' ? plain(t.amount) : '-' + plain(t.amount)])
  const cols = ['Date', 'Type', 'Catégorie', 'Description', `Montant (${currency})`]

  // Rapports
  const report = useMemo(() => {
    const key = (t) => period === 'day' ? t.date : period === 'week' ? weekStart(t.date) : monthKey(t.date)
    const inc = groupSum(tx.rows.filter((t) => t.type === 'income'), key, (t) => t.amount)
    const exp = groupSum(tx.rows.filter((t) => t.type === 'expense'), key, (t) => t.amount)
    const keys = [...new Set([...Object.keys(inc), ...Object.keys(exp)])].sort().slice(-12)
    return keys.map((k) => ({ key: k, name: period === 'month' ? k : k.slice(5), Revenus: inc[k] || 0, Dépenses: exp[k] || 0, Net: (inc[k] || 0) - (exp[k] || 0) }))
  }, [tx.rows, period])

  // Budgets
  const spentByCat = useMemo(() => groupSum(tx.rows.filter((t) => t.type === 'expense' && monthKey(t.date) === thisMonth()), (t) => t.category, (t) => t.amount), [tx.rows])
  const saveBudget = async (e) => {
    e.preventDefault()
    const amount = Number(bform.amount)
    if (!(amount > 0)) return toast('Montant invalide', 'error')
    try {
      const existing = budgets.rows.find((b) => b.category === bform.category)
      if (existing) await budgets.update(existing.id, { amount }); else await budgets.insert({ category: bform.category, amount })
      toast('Budget enregistré'); setBform(null)
    } catch (err) { toast(err.message, 'error') }
  }
  const totalBudget = sum(budgets.rows, (b) => b.amount)
  const totalSpentBudgeted = sum(budgets.rows, (b) => spentByCat[b.category] || 0)

  return (
    <div>
      <PageHeader title="Finances" subtitle="Revenus, dépenses, budgets et rapports"
        actions={<>
          <Button variant="ghost" onClick={() => setCatModal(true)}><Tags size={16} />Catégories</Button>
          <Button onClick={() => setForm(emptyTx())}><Plus size={16} />Transaction</Button>
        </>} />

      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <StatCard icon={ArrowUpCircle} label="Revenus" value={money(income)} color={COLORS.green} />
        <StatCard icon={ArrowDownCircle} label="Dépenses" value={money(expense)} color={COLORS.red} />
        <StatCard icon={Wallet} label="Solde (calcul automatique)" value={money(income - expense)} color={COLORS.accent} />
      </div>

      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'transactions', label: 'Transactions', icon: Wallet }, { id: 'reports', label: 'Rapports', icon: BarChart3 }, { id: 'budgets', label: 'Budgets', icon: Target }]} />

      {tab === 'transactions' && (
        <Card className="mt-5">
          <div className="flex flex-wrap gap-2 mb-4 items-center">
            <div className="relative flex-1 min-w-[160px]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <Input className="!pl-9" placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <Select value={ft} onChange={(e) => setFt(e.target.value)} className="!w-auto"><option value="">Tous types</option><option value="income">Revenus</option><option value="expense">Dépenses</option></Select>
            <Select value={fc} onChange={(e) => setFc(e.target.value)} className="!w-auto"><option value="">Catégories</option>{allCats.map((c) => <option key={c}>{c}</option>)}</Select>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="!w-auto" title="Du" />
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="!w-auto" title="Au" />
            <Button variant="ghost" size="sm" onClick={() => exportCSV('transactions.csv', cols, rowsForExport())}><Download size={14} />CSV</Button>
            <Button variant="ghost" size="sm" onClick={() => exportPDF('transactions.pdf', 'Transactions', cols, rowsForExport(), `Revenus ${plain(fIncome)} · Dépenses ${plain(fExpense)} · Solde ${plain(fIncome - fExpense)} ${currency}`)}><FileText size={14} />PDF</Button>
          </div>
          {filtered.length === 0 ? <Empty icon={Wallet} text="Aucune transaction trouvée" /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-muted border-b border-line"><th className="py-2 pr-3">Date</th><th className="pr-3">Description</th><th className="pr-3">Catégorie</th><th className="pr-3 text-right">Montant</th><th /></tr></thead>
                <tbody>
                  {filtered.map((t) => (
                    <tr key={t.id} className="border-b border-line/60 hover:bg-card2/50">
                      <td className="py-3 pr-3 whitespace-nowrap text-muted">{fmtDate(t.date)}</td>
                      <td className="pr-3">{t.description || '—'}</td>
                      <td className="pr-3"><Badge color={t.type === 'income' ? COLORS.green : COLORS.violet}>{t.category}</Badge></td>
                      <td className={`pr-3 text-right font-semibold whitespace-nowrap ${t.type === 'income' ? 'text-emerald-400' : 'text-red-400'}`}>{t.type === 'income' ? '+' : '-'}{money(t.amount)}</td>
                      <td className="text-right whitespace-nowrap">
                        <button onClick={() => setForm({ ...t, amount: String(t.amount), description: t.description || '' })} className="p-1.5 text-muted hover:text-accent"><Pencil size={15} /></button>
                        <button onClick={() => delTx(t)} className="p-1.5 text-muted hover:text-red-400"><Trash2 size={15} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-muted mt-3 text-right">{filtered.length} résultat(s) · Revenus {money(fIncome)} · Dépenses {money(fExpense)}</p>
            </div>
          )}
        </Card>
      )}

      {tab === 'reports' && (
        <div className="mt-5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <Tabs value={period} onChange={setPeriod} tabs={[{ id: 'day', label: 'Journalier' }, { id: 'week', label: 'Hebdomadaire' }, { id: 'month', label: 'Mensuel' }]} />
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => exportCSV(`rapport-${period}.csv`, ['Période', 'Revenus', 'Dépenses', 'Net'], report.map((r) => [r.key, plain(r.Revenus), plain(r.Dépenses), plain(r.Net)]))}><Download size={14} />CSV</Button>
              <Button variant="ghost" size="sm" onClick={() => exportPDF(`rapport-${period}.pdf`, `Rapport ${period === 'day' ? 'journalier' : period === 'week' ? 'hebdomadaire' : 'mensuel'}`, ['Période', 'Revenus', 'Dépenses', 'Net'], report.map((r) => [r.key, plain(r.Revenus), plain(r.Dépenses), plain(r.Net)]), `Devise : ${currency}`)}><FileText size={14} />PDF</Button>
            </div>
          </div>
          <Card>
            {report.length === 0 ? <Empty text="Pas encore de données" /> : (
              <div className="h-72">
                <ResponsiveContainer>
                  <BarChart data={report}>
                    <CartesianGrid stroke="rgb(var(--line))" vertical={false} />
                    <XAxis dataKey="name" stroke="rgb(var(--muted))" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="rgb(var(--muted))" fontSize={11} tickLine={false} axisLine={false} width={50} />
                    <Tooltip {...chartTooltip} formatter={(v) => money(v)} cursor={{ fill: 'rgb(var(--card2))' }} />
                    <Legend />
                    <Bar dataKey="Revenus" fill={COLORS.green} radius={[6, 6, 0, 0]} />
                    <Bar dataKey="Dépenses" fill={COLORS.red} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-muted border-b border-line"><th className="py-2">Période</th><th className="text-right">Revenus</th><th className="text-right">Dépenses</th><th className="text-right">Net</th></tr></thead>
              <tbody>
                {[...report].reverse().map((r) => (
                  <tr key={r.key} className="border-b border-line/60">
                    <td className="py-2.5">{r.key}</td>
                    <td className="text-right text-emerald-400">{money(r.Revenus)}</td>
                    <td className="text-right text-red-400">{money(r.Dépenses)}</td>
                    <td className={`text-right font-semibold ${r.Net >= 0 ? '' : 'text-red-400'}`}>{money(r.Net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {tab === 'budgets' && (
        <div className="mt-5 space-y-4">
          <Card className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs text-muted">Budget mensuel total</p>
              <p className="text-xl font-semibold">{money(totalSpentBudgeted)} <span className="text-muted text-sm font-normal">/ {money(totalBudget)}</span></p>
              <Progress className="mt-2 w-64 max-w-full" value={totalBudget ? (totalSpentBudgeted / totalBudget) * 100 : 0} color={totalSpentBudgeted > totalBudget ? COLORS.red : COLORS.accent} />
            </div>
            <Button onClick={() => setBform({ category: expCats.all[0], amount: '' })}><Plus size={16} />Définir un budget</Button>
          </Card>
          {budgets.rows.length === 0 ? <Card><Empty icon={Target} text="Aucun budget. Définis un plafond mensuel par catégorie." /></Card> : (
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              {budgets.rows.map((b) => {
                const spent = spentByCat[b.category] || 0
                const pct = (spent / b.amount) * 100
                const color = pct >= 100 ? COLORS.red : pct >= 80 ? COLORS.amber : COLORS.green
                return (
                  <Card key={b.id}>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium">{b.category}</h4>
                      <div className="flex gap-1">
                        <button onClick={() => setBform({ category: b.category, amount: String(b.amount) })} className="p-1 text-muted hover:text-accent"><Pencil size={14} /></button>
                        <button onClick={async () => { if (confirm('Supprimer ce budget ?')) await budgets.remove(b.id) }} className="p-1 text-muted hover:text-red-400"><Trash2 size={14} /></button>
                      </div>
                    </div>
                    <Progress value={pct} color={color} />
                    <div className="flex justify-between text-xs mt-2">
                      <span style={{ color }}>{Math.round(pct)}% utilisé</span>
                      <span className="text-muted">{money(spent)} / {money(b.amount)}</span>
                    </div>
                    <p className="text-xs text-muted mt-1">{b.amount - spent >= 0 ? `Reste ${money(b.amount - spent)}` : `Dépassé de ${money(spent - b.amount)}`}</p>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}

      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? 'Modifier la transaction' : 'Nouvelle transaction'}>
        {form && (
          <form onSubmit={saveTx} className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {[['expense', 'Dépense', 'border-red-400 bg-red-500/15 text-red-400'], ['income', 'Revenu', 'border-emerald-400 bg-emerald-500/15 text-emerald-400']].map(([id, label, active]) => (
                <button type="button" key={id} onClick={() => setForm({ ...form, type: id, category: (id === 'income' ? incCats : expCats).all[0] })}
                  className={`rounded-xl border py-2.5 text-sm font-medium transition ${form.type === id ? active : 'border-line text-muted'}`}>{label}</button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label={`Montant (${currency})`}><Input required type="number" step="0.01" min="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
              <Field label="Date"><Input required type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
            </div>
            <Field label="Catégorie"><Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{(form.type === 'income' ? incCats : expCats).all.map((c) => <option key={c}>{c}</option>)}</Select></Field>
            <Field label="Description"><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Ex : Courses du samedi" /></Field>
            <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setForm(null)}>Annuler</Button><Button type="submit">Enregistrer</Button></div>
          </form>
        )}
      </Modal>

      <Modal open={!!bform} onClose={() => setBform(null)} title="Budget mensuel">
        {bform && (
          <form onSubmit={saveBudget} className="space-y-4">
            <Field label="Catégorie de dépense"><Select value={bform.category} onChange={(e) => setBform({ ...bform, category: e.target.value })}>{expCats.all.map((c) => <option key={c}>{c}</option>)}</Select></Field>
            <Field label={`Plafond mensuel (${currency})`}><Input required type="number" min="1" step="0.01" value={bform.amount} onChange={(e) => setBform({ ...bform, amount: e.target.value })} /></Field>
            <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setBform(null)}>Annuler</Button><Button type="submit">Enregistrer</Button></div>
          </form>
        )}
      </Modal>

      <Modal open={catModal} onClose={() => setCatModal(false)} title="Catégories personnalisées">
        <form className="flex gap-2 mb-4" onSubmit={async (e) => {
          e.preventDefault(); if (!newCat.name.trim()) return
          try { await (newCat.type === 'income' ? incCats : expCats).add(newCat.name.trim()); setNewCat({ ...newCat, name: '' }); toast('Catégorie ajoutée') } catch (err) { toast(err.message, 'error') }
        }}>
          <Select value={newCat.type} onChange={(e) => setNewCat({ ...newCat, type: e.target.value })} className="!w-32"><option value="expense">Dépense</option><option value="income">Revenu</option></Select>
          <Input placeholder="Nom" value={newCat.name} onChange={(e) => setNewCat({ ...newCat, name: e.target.value })} />
          <Button type="submit">Ajouter</Button>
        </form>
        {[['Dépenses', expCats], ['Revenus', incCats]].map(([label, c]) => (
          <div key={label} className="mb-3">
            <p className="text-xs text-muted mb-2">{label}</p>
            <div className="flex flex-wrap gap-2">
              {c.all.map((n) => { const custom = c.custom.find((x) => x.name === n); return <Badge key={n} color={custom ? '#22d3ee' : '#8b5cf6'}>{n}{custom && <button onClick={() => c.remove(custom.id)} className="ml-1 opacity-70 hover:opacity-100">×</button>}</Badge> })}
            </div>
          </div>
        ))}
      </Modal>
    </div>
  )
}
