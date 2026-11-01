import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { LayoutDashboard, CheckSquare, Wallet, CreditCard, Calculator, PiggyBank, Settings, LogOut, Sun, Moon, CalendarDays, Bell, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { usePrefs } from '../context/PrefsContext'
import { useTable } from '../hooks/useTable'
import { useToast } from './Toast'
import { addDays, cn, monthKey, thisMonth, toDateStr, sum } from '../lib/utils'

export const NAV = [
  { to: '/', label: 'Dashboard', short: 'Accueil', icon: LayoutDashboard },
  { to: '/tasks', label: 'Tâches', short: 'Tâches', icon: CheckSquare },
  { to: '/finance', label: 'Finances', short: 'Finances', icon: Wallet },
  { to: '/payments', label: 'Paiements', short: 'Paiements', icon: CreditCard },
  { to: '/calculators', label: 'Calculatrices', short: 'Calculs', icon: Calculator },
  { to: '/savings', label: 'Épargne', short: 'Épargne', icon: PiggyBank },
  { to: '/calendar', label: 'Calendrier', short: 'Agenda', icon: CalendarDays },
  { to: '/notifications', label: 'Notifications', short: 'Alertes', icon: Bell },
]

/** Rappels de tâches : notification + toast quand reminder_at est atteint */
function useReminders() {
  const { rows } = useTable('tasks')
  const notifications = useTable('notifications')
  const toast = useToast()
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission()
  }, [])
  useEffect(() => {
    const check = () => {
      const seen = JSON.parse(localStorage.getItem('danyhub:reminded') || '[]')
      const now = Date.now()
      rows.forEach((t) => {
        if (t.status === 'done' || !t.reminder_at) return
        const key = `${t.id}:${t.reminder_at}`
        if (new Date(t.reminder_at).getTime() <= now && !seen.includes(key)) {
          seen.push(key)
          toast(`⏰ Rappel : ${t.title}`, 'info')
          notifications.insert({
            source_key: `task-reminder:${key}`,
            type: 'task',
            title: 'Rappel de tâche',
            message: t.title,
            href: '/tasks',
          }).catch((error) => toast(error.message, 'error'))
          if ('Notification' in window && Notification.permission === 'granted') new Notification('DANY HUB — Rappel', { body: t.title })
        }
      })
      localStorage.setItem('danyhub:reminded', JSON.stringify(seen.slice(-200)))
    }
    check()
    const i = setInterval(check, 30000)
    return () => clearInterval(i)
  }, [rows, toast])
}

function useGeneratedNotifications() {
  const { convertBetween } = usePrefs()
  const tasks = useTable('tasks')
  const payments = useTable('payments')
  const debts = useTable('debts')
  const debtPayments = useTable('debt_payments')
  const budgets = useTable('budgets')
  const transactions = useTable('transactions')
  const notifications = useTable('notifications')
  const toast = useToast()
  const pending = useRef(new Set())

  useEffect(() => {
    if ([tasks, payments, debts, debtPayments, budgets, transactions, notifications].some((table) => table.loading)) return

    const today = toDateStr()
    const soon = addDays(today, 7)
    const candidates = [
      ...tasks.rows.filter((task) => task.status !== 'done' && task.due_date && task.due_date <= soon).map((task) => ({
        source_key: `task-due:${task.id}:${task.due_date}`,
        type: 'task',
        title: task.due_date < today ? 'Tâche en retard' : 'Tâche à venir',
        message: `${task.title} · ${task.due_date < today ? 'en retard' : `échéance le ${task.due_date}`}`,
        href: '/tasks',
      })),
      ...payments.rows.filter((payment) => payment.is_recurring && payment.next_due && payment.next_due <= soon).map((payment) => ({
        source_key: `payment-due:${payment.id}:${payment.next_due}`,
        type: 'payment',
        title: 'Paiement récurrent à venir',
        message: `${payment.merchant} · échéance le ${payment.next_due}`,
        href: '/payments',
      })),
      ...debts.rows.filter((debt) => debt.due_date && debt.due_date <= soon &&
        Number(debt.initial_amount) > sum(debtPayments.rows.filter((payment) => payment.debt_id === debt.id), (payment) => payment.amount)
      ).map((debt) => ({
        source_key: `debt-due:${debt.id}:${debt.due_date}`,
        type: 'debt',
        title: 'Échéance de dette',
        message: `${debt.name} · échéance le ${debt.due_date}`,
        href: '/finance',
      })),
      ...budgets.rows.flatMap((budget) => {
        const categoryTransactions = transactions.rows.filter((transaction) =>
          transaction.type === 'expense' && transaction.category === budget.category && monthKey(transaction.date) === thisMonth()
        )
        const amounts = categoryTransactions.map((transaction) => convertBetween(transaction.amount, transaction.currency || budget.currency, budget.currency))
        if (amounts.some((amount) => amount === null)) return []
        const spent = sum(amounts)
        const ratio = spent / Number(budget.amount)
        if (ratio < 0.8) return []
        const limitReached = ratio >= 1
        return [{
          source_key: `budget:${thisMonth()}:${budget.id}:${limitReached ? 'limit' : 'warning'}`,
          type: 'budget',
          title: limitReached ? 'Budget dépassé' : 'Budget bientôt atteint',
          message: `${budget.category} · ${Math.round(ratio * 100)} % utilisé`,
          href: '/finance',
        }]
      }),
    ]

    const known = new Set(notifications.rows.map((notification) => notification.source_key))
    candidates.forEach((notification) => {
      if (known.has(notification.source_key) || pending.current.has(notification.source_key)) return
      pending.current.add(notification.source_key)
      notifications.insert(notification)
        .catch((error) => toast(error.message, 'error'))
        .finally(() => pending.current.delete(notification.source_key))
    })
  }, [tasks.rows, tasks.loading, payments.rows, payments.loading, debts.rows, debts.loading, debtPayments.rows, debtPayments.loading, budgets.rows, budgets.loading, transactions.rows, transactions.loading, notifications.rows, notifications.loading, toast, convertBetween])
}

export default function Layout() {
  const { user, signOut } = useAuth()
  const { theme, update, display_name } = usePrefs()
  const notifications = useTable('notifications')
  const nav = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('danyhub:sidebar-collapsed') === 'true')
  useReminders()
  useGeneratedNotifications()
  const name = display_name || user?.email?.split('@')[0] || 'DH'
  const initials = name.slice(0, 2).toUpperCase()

  const link = ({ isActive }) =>
    cn('flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm transition',
      isActive ? 'bg-accent/15 text-accent font-medium' : 'text-muted hover:text-ink hover:bg-card2')
  const activePage = NAV.find((item) => item.to === location.pathname)
  const toggleSidebar = () => setCollapsed((value) => {
    localStorage.setItem('danyhub:sidebar-collapsed', String(!value))
    return !value
  })
  const unread = notifications.rows.filter((item) => !item.is_read && !item.is_deleted).length

  return (
    <div className="min-h-screen lg:flex">
      {/* Sidebar desktop */}
      <aside className={cn('hidden lg:flex flex-col shrink-0 h-screen sticky top-0 border-r border-line bg-card/90 backdrop-blur-xl p-4 transition-[width] duration-200', collapsed ? 'w-[84px]' : 'w-64')}>
        <div className={cn('flex items-center px-2 py-3 mb-4', collapsed ? 'justify-center' : 'gap-3')}>
          <div className="h-10 w-10 rounded-2xl bg-accent text-[rgb(11_14_26)] grid place-items-center font-bold">DH</div>
          {!collapsed && <div>
            <p className="font-bold tracking-wide leading-none">DANY HUB</p>
            <p className="text-[11px] text-muted mt-1">Personal workspace</p>
          </div>}
        </div>
        <div className={cn('flex items-center mb-3', collapsed ? 'justify-center' : 'justify-between px-2')}>
          {!collapsed && <p className="text-[10px] uppercase tracking-[.18em] text-muted">Workspace</p>}
          <button onClick={toggleSidebar} title={collapsed ? 'Agrandir le menu' : 'Réduire le menu'} className="rounded-lg p-2 text-muted hover:bg-card2 hover:text-ink">
            {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          </button>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'} className={(state) => cn(link(state), collapsed && 'justify-center px-0')} title={collapsed ? n.label : undefined}>
              <n.icon size={18} />{!collapsed && n.label}
              {!collapsed && n.to === '/notifications' && unread > 0 && <span className="ml-auto rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] text-red-400">{unread}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-1">
          <NavLink to="/settings" className={(state) => cn(link(state), collapsed && 'justify-center px-0')} title={collapsed ? 'Réglages' : undefined}><Settings size={18} />{!collapsed && 'Réglages'}</NavLink>
          <button title={theme === 'dark' ? 'Thème clair' : 'Thème sombre'} onClick={() => update({ theme: theme === 'dark' ? 'light' : 'dark' })} className={cn('flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm text-muted hover:text-ink hover:bg-card2', collapsed && 'justify-center px-0')}>
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}{!collapsed && (theme === 'dark' ? 'Thème clair' : 'Thème sombre')}
          </button>
          <div className={cn('flex items-center gap-3 rounded-xl bg-card2 p-3 mt-2', collapsed && 'justify-center px-1')}>
            <div className="h-9 w-9 rounded-full bg-accent/20 text-accent grid place-items-center text-sm font-semibold">{initials}</div>
            {!collapsed && <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{name}</p>
              <p className="text-[11px] text-muted truncate">{user?.email}</p>
            </div>}
            <button title="Déconnexion" onClick={async () => { await signOut(); nav('/login') }} className={cn('text-muted hover:text-red-400', collapsed && 'hidden')}><LogOut size={16} /></button>
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        <header className="sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6 lg:px-8 py-3 bg-bg/85 backdrop-blur-xl border-b border-line">
          <div className="flex items-center gap-2">
            <div className="lg:hidden h-8 w-8 rounded-xl bg-accent text-[rgb(11_14_26)] grid place-items-center text-xs font-bold">DH</div>
            <div>
              <p className="text-[10px] uppercase tracking-[.18em] text-muted hidden sm:block">DANY HUB / Workspace</p>
              <span className="font-semibold">{activePage?.label || 'DANY HUB'}</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => update({ theme: theme === 'dark' ? 'light' : 'dark' })} className="p-2 rounded-lg hover:bg-card2">
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <NavLink to="/notifications" aria-label="Notifications" className="relative p-2 rounded-lg hover:bg-card2">
              <Bell size={18} />
              {unread > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-400 ring-2 ring-bg" />}
            </NavLink>
            <NavLink to="/settings" className="p-2 rounded-lg hover:bg-card2"><Settings size={18} /></NavLink>
            <button title="Déconnexion" onClick={async () => { await signOut(); nav('/login') }} className="hidden sm:inline-flex p-2 rounded-lg text-muted hover:text-red-400 hover:bg-card2"><LogOut size={18} /></button>
          </div>
        </header>

        <main className="p-4 sm:p-6 lg:p-8 pb-28 lg:pb-8 max-w-[1400px] mx-auto">
          <Outlet />
        </main>
      </div>

      {/* Bottom nav mobile */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-card/95 backdrop-blur-xl border-t border-line safe-bottom overflow-x-auto">
        <div className="flex min-w-max justify-around px-1">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'}
              className={({ isActive }) => cn('relative flex min-w-[68px] flex-col items-center gap-1 py-2.5 text-[10px] transition', isActive ? 'text-accent' : 'text-muted')}>
              <n.icon size={20} />{n.short}
              {n.to === '/notifications' && unread > 0 && <span className="absolute top-1 right-4 h-2 w-2 rounded-full bg-red-400" />}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
