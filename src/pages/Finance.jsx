import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDownCircle, ArrowUpCircle, BarChart3, Download, FileText, Pencil, Plus, Search, Target, Trash2, Wallet, Tags, HandCoins, Repeat, CalendarClock } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useTable } from '../hooks/useTable'
import { useCategories } from '../hooks/useCategories'
import { usePrefs } from '../context/PrefsContext'
import { useToast } from '../components/Toast'
import { Badge, Button, Card, Empty, Field, Input, Modal, PageHeader, Progress, Select, StatCard, Tabs, chartTooltip } from '../components/ui'
import { CURRENCIES, COLORS, FREQUENCIES, methodOf } from '../lib/constants'
import { exportCSV, exportPDF, plain } from '../lib/export'
import { fmtDate, groupSumConverted, monthKey, sum, sumConverted, thisMonth, toDateStr, weekStart } from '../lib/utils'

const emptyTx = (currency) => ({ type: 'expense', amount: '', category: 'Alimentation', description: '', date: toDateStr(), currency })

export default function Finance() {
  const { currency, convertAmount, formatCurrency, rateError, ratesAvailable } = usePrefs()
  const money = (n, sourceCurrency = currency) => n === null ? '—' : formatCurrency(n, sourceCurrency)
  const tx = useTable('transactions', { orderBy: 'date' })
  const budgets = useTable('budgets', { orderBy: 'category', ascending: true })
  const debts = useTable('debts', { orderBy: 'due_date', ascending: true })
  const debtPayments = useTable('debt_payments', { orderBy: 'date' })
  const payments = useTable('payments', { orderBy: 'next_due', ascending: true })
  const expCats = useCategories('expense')
  const incCats = useCategories('income')
  const toast = useToast()
  const [tab, setTab] = useState('transactions')
  const [form, setForm] = useState(null)
  const [bform, setBform] = useState(null)
  const [debtForm, setDebtForm] = useState(null)
  const [repaymentForm, setRepaymentForm] = useState(null)
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

  const income = sumConverted(tx.rows.filter((t) => t.type === 'income'), (t) => t.amount, currency, convertAmount)
  const expense = sumConverted(tx.rows.filter((t) => t.type === 'expense'), (t) => t.amount, currency, convertAmount)
  const fIncome = sumConverted(filtered.filter((t) => t.type === 'income'), (t) => t.amount, currency, convertAmount)
  const fExpense = sumConverted(filtered.filter((t) => t.type === 'expense'), (t) => t.amount, currency, convertAmount)

  const saveTx = async (e) => {
    e.preventDefault()
    const p = { type: form.type, amount: Number(form.amount), currency: form.currency || currency, category: form.category, description: form.description || null, date: form.date }
    if (!(p.amount > 0)) return toast('Montant invalide', 'error')
    try {
      if (form.id) await tx.update(form.id, p); else await tx.insert(p)
      toast(form.id ? 'Transaction modifiée' : 'Transaction ajoutée'); setForm(null)
    } catch (err) { toast(err.message, 'error') }
  }
  const delTx = async (t) => { if (confirm('Supprimer cette transaction ?')) { try { await tx.remove(t.id); toast('Supprimée') } catch (e) { toast(e.message, 'error') } } }

  const rowsForExport = () => filtered.map((t) => {
    const converted = convertAmount(t.amount, t.currency || currency)
    const amount = converted === null ? `${plain(t.amount)} ${t.currency || currency}` : plain(converted)
    return [t.date, t.type === 'income' ? 'Revenu' : 'Dépense', t.category, t.description || '', t.type === 'income' ? amount : `-${amount}`]
  })
  const cols = ['Date', 'Type', 'Catégorie', 'Description', 'Montant (devise principale si disponible)']

  // Rapports
  const report = useMemo(() => {
    const key = (t) => period === 'day' ? t.date : period === 'week' ? weekStart(t.date) : monthKey(t.date)
    const inc = groupSumConverted(tx.rows.filter((t) => t.type === 'income'), key, (t) => t.amount, currency, convertAmount)
    const exp = groupSumConverted(tx.rows.filter((t) => t.type === 'expense'), key, (t) => t.amount, currency, convertAmount)
    if (!inc || !exp) return null
    const keys = [...new Set([...Object.keys(inc), ...Object.keys(exp)])].sort().slice(-12)
    return keys.map((k) => ({ key: k, name: period === 'month' ? k : k.slice(5), Revenus: inc[k] || 0, Dépenses: exp[k] || 0, Net: (inc[k] || 0) - (exp[k] || 0) }))
  }, [tx.rows, period, currency, convertAmount])

  // Budgets
  const spentByCat = useMemo(() => groupSumConverted(tx.rows.filter((t) => t.type === 'expense' && monthKey(t.date) === thisMonth()), (t) => t.category, (t) => t.amount, currency, convertAmount), [tx.rows, currency, convertAmount])
  const saveBudget = async (e) => {
    e.preventDefault()
    const amount = Number(bform.amount)
    if (!(amount > 0)) return toast('Montant invalide', 'error')
    try {
      const existing = budgets.rows.find((b) => b.category === bform.category)
      if (existing) await budgets.update(existing.id, { amount, currency: bform.currency }); else await budgets.insert({ category: bform.category, amount, currency: bform.currency })
      toast('Budget enregistré'); setBform(null)
    } catch (err) { toast(err.message, 'error') }
  }
  const totalBudget = sumConverted(budgets.rows, (b) => b.amount, currency, convertAmount)
  const totalSpentBudgeted = spentByCat === null ? null : sum(budgets.rows, (b) => spentByCat[b.category] || 0)
  const debtBalance = (debt) => Math.max(0, Number(debt.initial_amount) - sum(debtPayments.rows.filter((p) => p.debt_id === debt.id), (p) => p.amount))
  const activeSubscriptions = payments.rows.filter((p) => p.is_recurring)
  const newDataError = tx.error || budgets.error || debts.error || debtPayments.error || payments.error
  const financialRows = [...tx.rows, ...budgets.rows, ...debts.rows, ...payments.rows]
  const conversionWarning = financialRows.some((item) => convertAmount(item.amount ?? item.initial_amount, item.currency || currency) === null)
    ? 'Connexion Internet nécessaire pour convertir des montants.'
    : rateError && ratesAvailable ? 'La dernière mise à jour a échoué; les taux enregistrés en cache restent utilisés.' : rateError
  const deleteBudget = async (budget) => {
    if (!confirm(`Supprimer le budget « ${budget.category} » ?`)) return
    try { await budgets.remove(budget.id); toast('Budget supprimé') }
    catch (error) { toast(error.message, 'error') }
  }
  const reportRows = (report || []).map((r) => [r.key, plain(r.Revenus), plain(r.Dépenses), plain(r.Net)])
  const transactionSummary = `Revenus ${fIncome === null ? 'non convertis' : plain(fIncome)} · Dépenses ${fExpense === null ? 'non converties' : plain(fExpense)} · Solde ${fIncome === null || fExpense === null ? 'non converti' : plain(fIncome - fExpense)} ${currency}`

  const saveDebt = async (e) => {
    e.preventDefault()
    const payload = {
      name: debtForm.name.trim(),
      direction: debtForm.direction,
      initial_amount: Number(debtForm.initial_amount),
      currency: debtForm.currency,
      due_date: debtForm.due_date || null,
      notes: debtForm.notes.trim() || null,
    }
    if (!payload.name || !(payload.initial_amount > 0)) return toast('Vérifie le nom et le montant de la dette', 'error')
    const alreadyRepaid = debtForm.id ? sum(debtPayments.rows.filter((payment) => payment.debt_id === debtForm.id), (payment) => payment.amount) : 0
    if (payload.initial_amount < alreadyRepaid) return toast('Le montant initial ne peut pas être inférieur aux remboursements déjà enregistrés', 'error')
    try {
      if (debtForm.id) await debts.update(debtForm.id, payload)
      else await debts.insert(payload)
      toast(debtForm.id ? 'Dette modifiée' : 'Dette ajoutée')
      setDebtForm(null)
    } catch (err) { toast(err.message, 'error') }
  }

  const saveRepayment = async (e) => {
    e.preventDefault()
    const debt = debts.rows.find((item) => item.id === repaymentForm.debt_id)
    const amount = Number(repaymentForm.amount)
    if (!debt || !(amount > 0) || amount > debtBalance(debt)) return toast('Montant de remboursement invalide', 'error')
    try {
      await debtPayments.insert({ debt_id: debt.id, amount, date: repaymentForm.date, notes: repaymentForm.notes.trim() || null })
      toast('Remboursement enregistré')
      setRepaymentForm(null)
    } catch (err) { toast(err.message, 'error') }
  }

  return (
    <div>
      <PageHeader title="Centre financier" subtitle="Transactions, budgets, dettes et paiements récurrents"
        actions={<>
          <Button variant="ghost" onClick={() => setCatModal(true)}><Tags size={16} />Catégories</Button>
          <Button onClick={() => setForm(emptyTx(currency))}><Plus size={16} />Transaction</Button>
        </>} />
      {newDataError && <p role="alert" className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">Impossible de charger certaines données financières : {newDataError}. Vérifie que le schéma Supabase est à jour.</p>}
      {conversionWarning && <p role="status" className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300">{ratesAvailable ? 'Les montants restent convertis avec les derniers taux disponibles. ' : 'Les montants des autres devises restent affichés dans leur devise d’origine tant que le taux n’est pas disponible. '}{conversionWarning}</p>}

      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <StatCard icon={ArrowUpCircle} label="Revenus" value={money(income)} color={COLORS.green} />
        <StatCard icon={ArrowDownCircle} label="Dépenses" value={money(expense)} color={COLORS.red} />
        <StatCard icon={Wallet} label="Solde (calcul automatique)" value={money(income === null || expense === null ? null : income - expense)} color={COLORS.accent} />
      </div>

      <Tabs value={tab} onChange={setTab} tabs={[
        { id: 'transactions', label: 'Transactions', icon: Wallet },
        { id: 'budgets', label: 'Budgets', icon: Target },
        { id: 'debts', label: 'Dettes', icon: HandCoins },
        { id: 'recurring', label: 'Récurrents', icon: Repeat },
        { id: 'reports', label: 'Rapports', icon: BarChart3 },
      ]} />

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
            <Button variant="ghost" size="sm" onClick={() => exportPDF('transactions.pdf', 'Transactions', cols, rowsForExport(), transactionSummary)}><FileText size={14} />PDF</Button>
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
                      <td className={`pr-3 text-right font-semibold whitespace-nowrap ${t.type === 'income' ? 'text-emerald-400' : 'text-red-400'}`}>{t.type === 'income' ? '+' : '-'}{money(t.amount, t.currency || currency)}</td>
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
              <Button variant="ghost" size="sm" disabled={report === null} onClick={() => exportCSV(`rapport-${period}.csv`, ['Période', 'Revenus', 'Dépenses', 'Net'], reportRows)}><Download size={14} />CSV</Button>
              <Button variant="ghost" size="sm" disabled={report === null} onClick={() => exportPDF(`rapport-${period}.pdf`, `Rapport ${period === 'day' ? 'journalier' : period === 'week' ? 'hebdomadaire' : 'mensuel'}`, ['Période', 'Revenus', 'Dépenses', 'Net'], reportRows, `Devise : ${currency}`)}><FileText size={14} />PDF</Button>
            </div>
          </div>
          <Card>
            {report === null ? <Empty text="Impossible de convertir ces montants. Vérifie ta connexion Internet." /> : report.length === 0 ? <Empty text="Pas encore de données" /> : (
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
                {[...(report || [])].reverse().map((r) => (
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
              <Progress className="mt-2 w-64 max-w-full" value={totalBudget && totalSpentBudgeted !== null ? (totalSpentBudgeted / totalBudget) * 100 : 0} color={totalSpentBudgeted !== null && totalBudget !== null && totalSpentBudgeted > totalBudget ? COLORS.red : COLORS.accent} />
            </div>
            <Button onClick={() => setBform({ category: expCats.all[0], amount: '', currency })}><Plus size={16} />Définir un budget</Button>
          </Card>
          {budgets.rows.length === 0 ? <Card><Empty icon={Target} text="Aucun budget. Définis un plafond mensuel par catégorie." /></Card> : (
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              {budgets.rows.map((b) => {
                const spent = spentByCat?.[b.category] ?? null
                const budgetAmount = convertAmount(b.amount, b.currency || currency)
                const pct = spent !== null && budgetAmount ? (spent / budgetAmount) * 100 : 0
                const color = pct >= 100 ? COLORS.red : pct >= 80 ? COLORS.amber : COLORS.green
                return (
                  <Card key={b.id}>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium">{b.category}</h4>
                      <div className="flex gap-1">
                        <button onClick={() => setBform({ category: b.category, amount: String(b.amount), currency: b.currency || currency })} className="p-1 text-muted hover:text-accent"><Pencil size={14} /></button>
                        <button aria-label={`Supprimer le budget ${b.category}`} onClick={() => deleteBudget(b)} className="p-1 text-muted hover:text-red-400"><Trash2 size={14} /></button>
                      </div>
                    </div>
                    <Progress value={pct} color={color} />
                    <div className="flex justify-between text-xs mt-2">
                      <span style={{ color }}>{spent === null || budgetAmount === null ? 'Taux indisponible' : `${Math.round(pct)}% utilisé`}</span>
                      <span className="text-muted">{money(spent)} / {money(b.amount, b.currency || currency)}</span>
                    </div>
                    <p className="text-xs text-muted mt-1">{spent === null || budgetAmount === null ? 'Montant non converti' : budgetAmount - spent >= 0 ? `Reste ${money(budgetAmount - spent)}` : `Dépassé de ${money(spent - budgetAmount)}`}</p>
                  </Card>
                )
              })}
            </div>
          )}

          {tab === 'debts' && (
            <div className="mt-5 space-y-4">
              <Card className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs text-muted">Suivi des dettes</p>
                  <p className="text-sm text-muted mt-1">Les montants conservent leur devise d’origine; l’affichage est converti au taux actuel.</p>
                </div>
                <Button onClick={() => setDebtForm({ name: '', direction: 'owe', initial_amount: '', currency, due_date: '', notes: '' })}><Plus size={16} />Ajouter une dette</Button>
              </Card>
              {debts.rows.length === 0 ? <Card><Empty icon={HandCoins} text="Aucune dette enregistrée" /></Card> : (
                <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {debts.rows.map((debt) => {
                    const remaining = debtBalance(debt)
                    const paid = Number(debt.initial_amount) - remaining
                    const pct = Number(debt.initial_amount) ? paid / Number(debt.initial_amount) * 100 : 0
                    return (
                      <Card key={debt.id}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="font-semibold truncate">{debt.name}</h3>
                            <p className="text-xs text-muted mt-1">{debt.direction === 'owe' ? 'Je dois' : 'On me doit'}{debt.due_date ? ` · Échéance ${fmtDate(debt.due_date)}` : ''}</p>
                          </div>
                          <div className="flex gap-1">
                            <button aria-label="Modifier la dette" onClick={() => setDebtForm({ ...debt, initial_amount: String(debt.initial_amount), notes: debt.notes || '', due_date: debt.due_date || '' })} className="p-1.5 text-muted hover:text-accent"><Pencil size={14} /></button>
                            <button aria-label="Supprimer la dette" onClick={async () => { if (!confirm(`Supprimer la dette « ${debt.name} » et son historique ?`)) return; try { await debts.remove(debt.id); toast('Dette supprimée') } catch (err) { toast(err.message, 'error') } }} className="p-1.5 text-muted hover:text-red-400"><Trash2 size={14} /></button>
                          </div>
                        </div>
                        <div className="flex items-end justify-between mt-5">
                          <div><p className="text-xs text-muted">Solde restant</p><p className="text-xl font-semibold">{money(remaining, debt.currency)}</p></div>
                          <p className="text-xs text-muted">sur {money(debt.initial_amount, debt.currency)}</p>
                        </div>
                        <Progress value={pct} className="mt-3" color={debt.direction === 'owe' ? COLORS.orange : COLORS.green} />
                        <p className="text-xs text-muted mt-2">{money(paid, debt.currency)} remboursé · {Math.round(pct)}%</p>
                        {debt.notes && <p className="text-xs text-muted mt-2 line-clamp-2">{debt.notes}</p>}
                        {debtPayments.rows.some((payment) => payment.debt_id === debt.id) && (
                          <div className="mt-3 border-t border-line pt-3">
                            <p className="text-[11px] uppercase tracking-wider text-muted mb-2">Remboursements récents</p>
                            <ul className="space-y-1.5">
                              {debtPayments.rows.filter((payment) => payment.debt_id === debt.id).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3).map((payment) => (
                                <li key={payment.id} className="flex justify-between gap-2 text-xs">
                                  <span className="text-muted">{fmtDate(payment.date)}{payment.notes ? ` · ${payment.notes}` : ''}</span>
                                  <span className="text-emerald-400 whitespace-nowrap">{money(payment.amount, debt.currency)}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {remaining > 0 && <Button size="sm" variant="ghost" className="w-full mt-4" onClick={() => setRepaymentForm({ debt_id: debt.id, amount: '', date: toDateStr(), notes: '' })}><HandCoins size={14} />Enregistrer un remboursement</Button>}
                      </Card>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {tab === 'recurring' && (
            <div className="mt-5 space-y-4">
              <Card className="flex flex-wrap items-center justify-between gap-3">
                <div><p className="font-semibold">Paiements récurrents</p><p className="text-xs text-muted mt-1">Gère les échéances et enregistre chaque paiement depuis le centre financier.</p></div>
                <Link to="/payments" className="text-sm text-accent hover:underline">Ouvrir les paiements</Link>
              </Card>
              {activeSubscriptions.length === 0 ? <Card><Empty icon={Repeat} text="Aucun abonnement actif" /></Card> : (
                <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {activeSubscriptions.map((subscription) => {
                    const due = subscription.next_due && subscription.next_due <= toDateStr()
                    const frequency = FREQUENCIES.find((item) => item.id === subscription.frequency)?.label || subscription.frequency
                    return (
                      <Card key={subscription.id}>
                        <div className="flex justify-between gap-3">
                          <div className="min-w-0"><h3 className="font-semibold truncate">{subscription.merchant}</h3><p className="text-xs text-muted mt-1">{frequency} · {methodOf(subscription.method).label}</p></div>
                          <p className="font-semibold whitespace-nowrap">{money(subscription.amount, subscription.currency)}</p>
                        </div>
                        <p className={`flex items-center gap-1 text-xs mt-4 ${due ? 'text-red-400' : 'text-muted'}`}><CalendarClock size={14} />Prochaine échéance : {fmtDate(subscription.next_due)}{due && ' · à payer'}</p>
                        <Link to="/payments" className="mt-4 flex w-full items-center justify-center rounded-xl border border-line px-3 py-2 text-xs text-muted hover:border-accent/50 hover:text-accent">Gérer l'abonnement</Link>
                      </Card>
                    )
                  })}
                </div>
              )}
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
              <Field label={`Montant (${form.currency || currency})`}><Input required type="number" step="0.01" min="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
              <Field label="Date"><Input required type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
            </div>
            <Field label="Devise de la transaction"><Select value={form.currency || currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>{CURRENCIES.map((code) => <option key={code}>{code}</option>)}</Select></Field>
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
            <Field label={`Plafond mensuel (${bform.currency || currency})`}><Input required type="number" min="1" step="0.01" value={bform.amount} onChange={(e) => setBform({ ...bform, amount: e.target.value })} /></Field>
            <Field label="Devise du budget"><Select value={bform.currency || currency} onChange={(e) => setBform({ ...bform, currency: e.target.value })}>{CURRENCIES.map((code) => <option key={code}>{code}</option>)}</Select></Field>
            <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setBform(null)}>Annuler</Button><Button type="submit">Enregistrer</Button></div>
          </form>
        )}
      </Modal>

      <Modal open={!!debtForm} onClose={() => setDebtForm(null)} title={debtForm?.id ? 'Modifier la dette' : 'Nouvelle dette'}>
        {debtForm && <form onSubmit={saveDebt} className="space-y-4">
          <Field label="Nom / personne"><Input required autoFocus value={debtForm.name} onChange={(e) => setDebtForm({ ...debtForm, name: e.target.value })} placeholder="Ex. Prêt logement" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Sens"><Select value={debtForm.direction} onChange={(e) => setDebtForm({ ...debtForm, direction: e.target.value })}><option value="owe">Je dois</option><option value="owed">On me doit</option></Select></Field>
            <Field label="Devise"><Select value={debtForm.currency} onChange={(e) => setDebtForm({ ...debtForm, currency: e.target.value })}>{CURRENCIES.map((item) => <option key={item}>{item}</option>)}</Select></Field>
          </div>
          <Field label="Montant initial"><Input required type="number" min="0.01" step="0.01" value={debtForm.initial_amount} onChange={(e) => setDebtForm({ ...debtForm, initial_amount: e.target.value })} /></Field>
          <Field label="Échéance (facultative)"><Input type="date" value={debtForm.due_date} onChange={(e) => setDebtForm({ ...debtForm, due_date: e.target.value })} /></Field>
          <Field label="Notes"><Input value={debtForm.notes} onChange={(e) => setDebtForm({ ...debtForm, notes: e.target.value })} /></Field>
          <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setDebtForm(null)}>Annuler</Button><Button type="submit">Enregistrer</Button></div>
        </form>}
      </Modal>

      <Modal open={!!repaymentForm} onClose={() => setRepaymentForm(null)} title="Enregistrer un remboursement">
        {repaymentForm && <form onSubmit={saveRepayment} className="space-y-4">
          <Field label={`Montant (${debts.rows.find((item) => item.id === repaymentForm.debt_id)?.currency || currency})`}><Input required type="number" min="0.01" step="0.01" max={debtBalance(debts.rows.find((item) => item.id === repaymentForm.debt_id) || { initial_amount: 0, id: '' })} value={repaymentForm.amount} onChange={(e) => setRepaymentForm({ ...repaymentForm, amount: e.target.value })} /></Field>
          <Field label="Date"><Input required type="date" value={repaymentForm.date} onChange={(e) => setRepaymentForm({ ...repaymentForm, date: e.target.value })} /></Field>
          <Field label="Notes (facultatives)"><Input value={repaymentForm.notes} onChange={(e) => setRepaymentForm({ ...repaymentForm, notes: e.target.value })} /></Field>
          <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setRepaymentForm(null)}>Annuler</Button><Button type="submit">Enregistrer</Button></div>
        </form>}
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
