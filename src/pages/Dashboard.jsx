import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDownCircle, ArrowUpCircle, Wallet, ListTodo, CalendarClock, PiggyBank } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useTable } from '../hooks/useTable'
import { useAuth } from '../context/AuthContext'
import { usePrefs } from '../context/PrefsContext'
import { Badge, Card, Empty, Progress, StatCard, chartTooltip } from '../components/ui'
import { CHART_COLORS, COLORS, priorityOf } from '../lib/constants'
import { fmtDate, fmtMoney, groupSum, monthKey, monthLabel, sum, thisMonth, toDateStr } from '../lib/utils'

export default function Dashboard() {
  const { user } = useAuth()
  const { currency, display_name } = usePrefs()
  const tx = useTable('transactions', { orderBy: 'date' })
  const tasks = useTable('tasks')
  const goals = useTable('savings_goals')
  const contribs = useTable('savings_contributions')
  const money = (n) => fmtMoney(n, currency)

  const d = useMemo(() => {
    const income = sum(tx.rows.filter((t) => t.type === 'income'), (t) => t.amount)
    const expense = sum(tx.rows.filter((t) => t.type === 'expense'), (t) => t.amount)
    const today = toDateStr()
    const pending = tasks.rows.filter((t) => t.status !== 'done')
    const upcoming = pending.filter((t) => t.due_date).sort((a, b) => a.due_date.localeCompare(b.due_date)).slice(0, 5)

    // 6 derniers mois
    const months = []
    const now = new Date()
    for (let i = 5; i >= 0; i--) {
      const x = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push(toDateStr(x).slice(0, 7))
    }
    const inc = groupSum(tx.rows.filter((t) => t.type === 'income'), (t) => monthKey(t.date), (t) => t.amount)
    const exp = groupSum(tx.rows.filter((t) => t.type === 'expense'), (t) => monthKey(t.date), (t) => t.amount)
    const monthly = months.map((m) => ({ name: monthLabel(m), Revenus: inc[m] || 0, Dépenses: exp[m] || 0 }))

    const byCat = groupSum(tx.rows.filter((t) => t.type === 'expense' && monthKey(t.date) === thisMonth()), (t) => t.category, (t) => t.amount)
    const cats = Object.entries(byCat).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
    const saved = sum(contribs.rows, (c) => c.amount)
    const target = sum(goals.rows, (g) => g.target_amount)
    return { income, expense, balance: income - expense, pending, upcoming, monthly, cats, today, saved, target }
  }, [tx.rows, tasks.rows, goals.rows, contribs.rows])

  const name = display_name || user?.email?.split('@')[0]
  const hour = new Date().getHours()
  const greet = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{greet}, {name} 👋</h1>
        <p className="text-sm text-muted">Voici un aperçu de ta situation aujourd'hui.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={ArrowUpCircle} label="Revenus totaux" value={money(d.income)} color={COLORS.green} />
        <StatCard icon={ArrowDownCircle} label="Dépenses totales" value={money(d.expense)} color={COLORS.red} />
        <StatCard icon={Wallet} label="Solde suivi" value={money(d.balance)} color={d.balance >= 0 ? COLORS.accent : COLORS.red} />
        <StatCard icon={ListTodo} label="Tâches en attente" value={d.pending.length} color={COLORS.violet}
          sub={`${d.pending.filter((t) => t.due_date && t.due_date < d.today).length} en retard`} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="xl:col-span-2">
          <h3 className="font-semibold mb-4">Revenus vs Dépenses (6 mois)</h3>
          <div className="h-72">
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
          </div>
        </Card>

        <Card>
          <h3 className="font-semibold mb-2">Dépenses du mois</h3>
          {d.cats.length === 0 ? <Empty text="Aucune dépense ce mois-ci" /> : (
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
                    {t.type === 'income' ? '+' : '-'}{money(t.amount)}
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
                  const s = sum(contribs.rows.filter((c) => c.goal_id === g.id), (c) => c.amount)
                  return (
                    <li key={g.id}>
                      <div className="flex justify-between text-xs mb-1"><span>{g.name}</span><span className="text-muted">{Math.round((s / g.target_amount) * 100)}%</span></div>
                      <Progress value={(s / g.target_amount) * 100} color={g.color} />
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
