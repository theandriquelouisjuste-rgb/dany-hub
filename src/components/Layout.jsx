import { useEffect } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { LayoutDashboard, CheckSquare, Wallet, CreditCard, Calculator, PiggyBank, Settings, LogOut, Sun, Moon } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { usePrefs } from '../context/PrefsContext'
import { useTable } from '../hooks/useTable'
import { useToast } from './Toast'
import { cn } from '../lib/utils'

export const NAV = [
  { to: '/', label: 'Dashboard', short: 'Accueil', icon: LayoutDashboard },
  { to: '/tasks', label: 'Tâches', short: 'Tâches', icon: CheckSquare },
  { to: '/finance', label: 'Finances', short: 'Finances', icon: Wallet },
  { to: '/payments', label: 'Paiements', short: 'Paiements', icon: CreditCard },
  { to: '/calculators', label: 'Calculatrices', short: 'Calculs', icon: Calculator },
  { to: '/savings', label: 'Épargne', short: 'Épargne', icon: PiggyBank },
]

/** Rappels de tâches : notification + toast quand reminder_at est atteint */
function useReminders() {
  const { rows } = useTable('tasks')
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

export default function Layout() {
  const { user, signOut } = useAuth()
  const { theme, update, display_name } = usePrefs()
  const nav = useNavigate()
  useReminders()
  const name = display_name || user?.email?.split('@')[0] || 'DH'
  const initials = name.slice(0, 2).toUpperCase()

  const link = ({ isActive }) =>
    cn('flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm transition',
      isActive ? 'bg-accent/15 text-accent font-medium' : 'text-muted hover:text-ink hover:bg-card2')

  return (
    <div className="min-h-screen lg:flex">
      {/* Sidebar desktop */}
      <aside className="hidden lg:flex flex-col w-64 shrink-0 h-screen sticky top-0 border-r border-line bg-card p-4">
        <div className="flex items-center gap-3 px-2 py-3 mb-4">
          <div className="h-10 w-10 rounded-2xl bg-accent text-[rgb(11_14_26)] grid place-items-center font-bold">DH</div>
          <div>
            <p className="font-bold tracking-wide leading-none">DANY HUB</p>
            <p className="text-[11px] text-muted mt-1">Life management</p>
          </div>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'} className={link}>
              <n.icon size={18} />{n.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-1">
          <NavLink to="/settings" className={link}><Settings size={18} />Réglages</NavLink>
          <button onClick={() => update({ theme: theme === 'dark' ? 'light' : 'dark' })} className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm text-muted hover:text-ink hover:bg-card2">
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}{theme === 'dark' ? 'Thème clair' : 'Thème sombre'}
          </button>
          <div className="flex items-center gap-3 rounded-xl bg-card2 p-3 mt-2">
            <div className="h-9 w-9 rounded-full bg-accent/20 text-accent grid place-items-center text-sm font-semibold">{initials}</div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{name}</p>
              <p className="text-[11px] text-muted truncate">{user?.email}</p>
            </div>
            <button title="Déconnexion" onClick={async () => { await signOut(); nav('/login') }} className="text-muted hover:text-red-400"><LogOut size={16} /></button>
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        {/* Top bar mobile */}
        <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-bg/90 backdrop-blur border-b border-line">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-accent text-[rgb(11_14_26)] grid place-items-center text-xs font-bold">DH</div>
            <span className="font-bold tracking-wide">DANY HUB</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => update({ theme: theme === 'dark' ? 'light' : 'dark' })} className="p-2 rounded-lg hover:bg-card2">
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <NavLink to="/settings" className="p-2 rounded-lg hover:bg-card2"><Settings size={18} /></NavLink>
          </div>
        </header>

        <main className="p-4 sm:p-6 lg:p-8 pb-28 lg:pb-8 max-w-[1400px] mx-auto">
          <Outlet />
        </main>
      </div>

      {/* Bottom nav mobile */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-card/95 backdrop-blur border-t border-line safe-bottom">
        <div className="grid grid-cols-6">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'}
              className={({ isActive }) => cn('flex flex-col items-center gap-1 py-2.5 text-[10px] transition', isActive ? 'text-accent' : 'text-muted')}>
              <n.icon size={20} />{n.short}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
