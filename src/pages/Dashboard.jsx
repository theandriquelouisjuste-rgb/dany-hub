import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDownCircle, ArrowUpCircle, Wallet, ListTodo, CalendarClock, PiggyBank, HandCoins, Repeat } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useTable } from '../hooks/useTable'
import { useAuth } from '../context/AuthContext'
import { usePrefs } from '../context/PrefsContext'
import { Badge, Card, Empty, Progress, StatCard, chartTooltip } from '../components/ui'
import { CHART_COLORS, COLORS, priorityOf } from '../lib/constants'
import { addDays, fmtDate, groupSumConverted, monthKey, monthLabel, sum, sumConverted, thisMonth, toDateStr } from '../lib/utils'

export default function Dashboard() {
  const { user } = useAuth()
  const { currency, display_name, convertAmount, formatCurrency, rateError, ratesAvailable } = usePrefs()
  const tx = useTable('transactions', { orderBy: 'date' })
  const tasks = useTable('tasks')
  const goals = useTable('savings_goals')
  const contribs = useTable('savings_contributions')
  const debts = useTable('debts')
  const debtPayments = useTable('debt_payments')
  const payments = useTable('payments')
  const [range, setRange] = useState(6)
  const money = (n, sourceCurrency = currency) => n === null ? '—' : formatCurrency(n, sourceCurrency)

  const d = useMemo(() => {
    const income = sumConverted(tx.rows.filter((t) => t.type === 'income'), (t) => t.amount, currency, convertAmount)
    const expense = sumConverted(tx.rows.filter((t) => t.type === 'expense'), (t) => t.amount, currency, convertAmount)
    const today = toDateStr()
    const pending = tasks.rows.filter((t) => t.status !== 'done')
    const upcoming = pending.filter((t) => t.due_date).sort((a, b) => a.due_date.localeCompare(b.due_date)).slice(0, 5)

    // Keep comparisons within each currency; debt balances are never combined across currencies.
    const months = []
    const now = new Date()
    for (let i = range - 1; i >= 0; i--) {
      const x = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push(toDateStr(x).slice(0, 7))
    }
    const inc = groupSumConverted(tx.rows.filter((t) => t.type === 'income'), (t) => monthKey(t.date), (t) => t.amount, currency, convertAmount)
    const exp = groupSumConverted(tx.rows.filter((t) => t.type === 'expense'), (t) => monthKey(t.date), (t) => t.amount, currency, convertAmount)
    const monthly = inc && exp ? months.map((m) => ({ name: monthLabel(m), Revenus: inc[m] || 0, Dépenses: exp[m] || 0 })) : null

    const byCat = groupSumConverted(tx.rows.filter((t) => t.type === 'expense' && monthKey(t.date) === thisMonth()), (t) => t.category, (t) => t.amount, currency, convertAmount)
    const cats = byCat ? Object.entries(byCat).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value) : null
    const saved = sumConverted(contribs.rows, (c) => c.amount, currency, convertAmount)
    const target = sumConverted(goals.rows, (g) => g.target_amount, currency, convertAmount)
    const currentIncome = sumConverted(tx.rows.filter((t) => t.type === 'income' && monthKey(t.date) === thisMonth()), (t) => t.amount, currency, convertAmount)
    const currentExpense = sumConverted(tx.rows.filter((t) => t.type === 'expense' && monthKey(t.date) === thisMonth()), (t) => t.amount, currency, convertAmount)
    const overdue = pending.filter((t) => t.due_date && t.due_date < today).length
    const duePayments = payments.rows.filter((p) => p.is_recurring && p.next_due && p.next_due <= addDays(today, 30))
    const outstandingDebts = debts.rows.map((debt) => {
      const paid = sum(debtPayments.rows.filter((payment) => payment.debt_id === debt.id), (payment) => payment.amount)
      return { ...debt, remaining: Math.max(0, Number(debt.initial_amount) - paid) }
    })
    const debtByDirection = {
      owe: sumConverted(outstandingDebts.filter((debt) => debt.direction === 'owe'), (debt) => debt.remaining, currency, convertAmount),
      owed: sumConverted(outstandingDebts.filter((debt) => debt.direction === 'owed'), (debt) => debt.remaining, currency, convertAmount),
    }
    return { income, expense, balance: income === null || expense === null ? null : income - expense, pending, upcoming, monthly, cats, today, saved, target, currentIncome, currentExpense, overdue, duePayments, debtByDirection }
  }, [tx.rows, tasks.rows, goals.rows, contribs.rows, debts.rows, debtPayments.rows, payments.rows, range, currency, convertAmount])

  const name = display_name || user?.email?.split('@')[0]
  const hour = new Date().getHours()
  const greet = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir'
  const dataError = tx.error || goals.error || contribs.error || debts.error || debtPayments.error || payments.error
  const hasUnconvertedValues = [...tx.rows, ...contribs.rows, ...goals.rows, ...debts.rows, ...payments.rows]
    .some((item) => convertAmount(item.amount ?? item.target_amount ?? item.initial_amount, item.currency || currency) === null)
  const conversionError = hasUnconvertedValues
    ? 'Connexion Internet nécessaire pour convertir des montants.'
    : rateError && ratesAvailable ? 'La dernière mise à jour a échoué; les taux enregistrés en cache restent utilisés.' : rateError

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-card via-card to-accent/10 p-5 sm:p-7">
        <div className="pointer-events-none absolute -right-10 -top-20 h-56 w-56 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[.18em] text-accent">Ton espace personnel</p>
            <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">{greet}, {name} 👋</h1>
            <p className="mt-1 text-sm text-muted">Voici un aperçu de ta situation aujourd'hui.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/finance" className="inline-flex items-center gap-2 rounded-xl border border-line bg-card/70 px-3.5 py-2.5 text-sm hover:border-accent/50"><Wallet size={16} className="text-accent" />Gérer les finances</Link>
            <Link to="/tasks" className="inline-flex items-center gap-2 rounded-xl bg-accent px-3.5 py-2.5 text-sm font-semibold text-[rgb(11_14_26)] hover:brightness-110"><ListTodo size={16} />Gérer les tâches</Link>
          </div>
        </div>
      </div>
      {dataError && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">Certaines données financières ne sont pas disponibles : {dataError}. Vérifie que le schéma Supabase est à jour.</p>}
      {conversionError && <p role="status" className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300">{ratesAvailable ? 'Les montants restent convertis avec les derniers taux disponibles. ' : 'Les montants des autres devises restent affichés dans leur devise d’origine tant que le taux n’est pas disponible. '}{conversionError}</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard icon={Wallet} label="Solde cumulé" value={money(d.balance)} color={d.balance === null || d.balance >= 0 ? COLORS.accent : COLORS.red} sub="Depuis le début du suivi" />
        <StatCard icon={ArrowUpCircle} label="Revenus · ce mois" value={money(d.currentIncome)} color={COLORS.green} />
        <StatCard icon={ArrowDownCircle} label="Dépenses · ce mois" value={money(d.currentExpense)} color={COLORS.red} />
        <StatCard icon={PiggyBank} label="Épargne suivie" value={money(d.saved)} color={COLORS.violet} sub={`Objectifs : ${money(d.target)}`} />
        <Card className="flex items-start gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl" style={{ background: `${COLORS.orange}22`, color: COLORS.orange }}><HandCoins size={22} /></div>
          <div className="min-w-0">
            <p className="text-xs text-muted">Suivi des dettes</p>
            <p className="text-xs text-muted mt-2">À rembourser</p>
            <p className="text-sm font-semibold break-words">{money(d.debtByDirection.owe)}</p>
            <p className="text-xs text-muted mt-2">À recevoir</p>
            <p className="text-sm font-semibold break-words">{money(d.debtByDirection.owed)}</p>
          </div>
        </Card>
        <StatCard icon={ListTodo} label="Tâches en attente" value={d.pending.length} color={COLORS.violet} sub={`${d.overdue} en retard`} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="xl:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div><h3 className="font-semibold">Revenus vs dépenses</h3><p className="text-xs text-muted mt-1">Évolution sur la période choisie</p></div>
            <div className="flex rounded-xl border border-line bg-field p-1">
              {[3, 6, 12].map((months) => <button key={months} onClick={() => setRange(months)} className={`rounded-lg px-2.5 py-1 text-xs transition ${range === months ? 'bg-accent text-[rgb(11_14_26)] font-semibold' : 'text-muted hover:text-ink'}`}>{months} mois</button>)}
            </div>
          </div>
          {d.monthly ? <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={d.monthly} barGap={6}>
                <CartesianGrid stroke="rgb(var(--line))" vertical={false} />
                <XAxis dataKey="name" stroke="rgb(var(--muted))" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="rgb(var(--muted))" fontSize={12} tickLine={false} axisLine={false} width={50} />
                <Tooltip {...chartTooltip} formatter={(v) => money(v)} cursor={{ fill: 'rgb(var(--card2))' }} />
                <Bar dataKey="Revenus" fill={COLORS.green} radius={[6, 6, 0, 0]} animationDuration={900} />
                <Bar dataKey="Dépenses" fill={COLORS.red} radius={[6, 6, 0, 0]} animationDuration={900} />
              </BarChart>
            </ResponsiveContainer>
          </div> : <Empty text="Impossible de convertir ces montants. Vérifie ta connexion Internet." />}
        </Card>

        <Card>
          <h3 className="font-semibold mb-2">Dépenses du mois</h3>
          {d.cats === null ? <Empty text="Les taux sont nécessaires pour comparer les dépenses de plusieurs devises." /> : d.cats.length === 0 ? <Empty text="Aucune dépense ce mois-ci" /> : (
            <>
              <div className="h-48">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={d.cats} dataKey="value" innerRadius={50} outerRadius={80} paddingAngle={3} stroke="none" animationDuration={900}>
                      {d.cats.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip {...chartTooltip} formatter={(v) => money(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="space-y-1.5 text-sm">
                {d.cats.slice(0, 5).map((c, i) => (
                  <li key={c.name} className="flex items-center justify-between">
                    <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />{c.name}</span>
                    <span className="text-muted">{money(c.value)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold flex items-center gap-2"><CalendarClock size={18} className="text-accent" />Échéances proches</h3>
            <Link to="/tasks" className="text-xs text-accent">Voir tout</Link>
          </div>
          {d.upcoming.length === 0 ? <Empty text="Aucune échéance à venir" /> : (
            <ul className="space-y-3">
              {d.upcoming.map((t) => {
                const late = t.due_date < d.today
                return (
                  <li key={t.id} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{t.title}</p>
                      <p className={`text-xs ${late ? 'text-red-400' : 'text-muted'}`}>{late ? 'En retard · ' : ''}{fmtDate(t.due_date)}</p>
                    </div>
                    <Badge color={priorityOf(t.priority).color}>{priorityOf(t.priority).label}</Badge>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        <Card className="lg:col-span-1">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Transactions récentes</h3>
            <Link to="/finance" className="text-xs text-accent">Voir tout</Link>
          </div>
          {tx.rows.length === 0 ? <Empty text="Aucune transaction" /> : (
            <ul className="space-y-3">
              {tx.rows.slice(0, 6).map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{t.description || t.category}</p>
                    <p className="text-xs text-muted">{t.category} · {fmtDate(t.date)}</p>
                  </div>
                  <span className={`text-sm font-semibold whitespace-nowrap ${t.type === 'income' ? 'text-emerald-400' : 'text-red-400'}`}>
                    {t.type === 'income' ? '+' : '-'}{money(t.amount, t.currency || currency)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="lg:col-span-1">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold flex items-center gap-2"><PiggyBank size={18} className="text-accent" />Épargne</h3>
            <Link to="/savings" className="text-xs text-accent">Voir tout</Link>
          </div>
          {goals.rows.length === 0 ? <Empty text="Aucun objectif" /> : (
            <>
              <p className="text-2xl font-semibold">{money(d.saved)}</p>
              <p className="text-xs text-muted mb-3">sur {money(d.target)} visés</p>
              <Progress value={d.target ? (d.saved / d.target) * 100 : 0} />
              <ul className="mt-4 space-y-3">
                {goals.rows.slice(0, 3).map((g) => {
                  const s = sumConverted(contribs.rows.filter((c) => c.goal_id === g.id), (c) => c.amount, currency, convertAmount)
                  const targetAmount = convertAmount(g.target_amount, g.currency || currency)
                  return (
                    <li key={g.id}>
                      <div className="flex justify-between text-xs mb-1"><span>{g.name}</span><span className="text-muted">{s === null || targetAmount === null ? '—' : `${Math.round((s / targetAmount) * 100)}%`}</span></div>
                      <Progress value={s === null || targetAmount === null ? 0 : (s / targetAmount) * 100} color={g.color} />
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </Card>

        <Card className="lg:col-span-1">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold flex items-center gap-2"><Repeat size={17} className="text-amber-400" />Paiements à venir</h3>
            <Link to="/calendar" className="text-xs text-accent">Agenda</Link>
          </div>
          {d.duePayments.length === 0 ? <Empty text="Aucun paiement prévu dans les 30 jours" /> : (
            <ul className="space-y-3">
              {d.duePayments.slice(0, 4).map((payment) => (
                <li key={payment.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0"><p className="text-sm font-medium truncate">{payment.merchant}</p><p className="text-xs text-muted">{fmtDate(payment.next_due)}</p></div>
                  <span className="text-sm font-semibold whitespace-nowrap">{money(payment.amount, payment.currency)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
