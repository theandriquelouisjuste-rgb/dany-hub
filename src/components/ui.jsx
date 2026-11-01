import { X } from 'lucide-react'
import { useEffect } from 'react'
import { cn } from '../lib/utils'

export const Card = ({ className, children, ...p }) => (
  <div className={cn('rounded-2xl bg-card border border-line p-5 animate-fade-up', className)} {...p}>{children}</div>
)

export function Button({ variant = 'primary', size = 'md', className, ...p }) {
  const v = {
    primary: 'bg-accent text-[rgb(11_14_26)] hover:brightness-110 font-semibold',
    ghost: 'bg-card2 border border-line hover:border-accent/60',
    danger: 'bg-red-500/15 text-red-400 hover:bg-red-500/25',
    plain: 'hover:bg-card2',
  }[variant]
  const s = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2.5 text-sm', icon: 'p-2' }[size]
  return (
    <button
      className={cn('inline-flex items-center justify-center gap-2 rounded-xl transition active:scale-[.97] disabled:opacity-50 disabled:pointer-events-none', v, s, className)}
      {...p}
    />
  )
}

export function Modal({ open, onClose, title, children, wide }) {
  useEffect(() => {
    if (!open) return
    const h = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4" onMouseDown={onClose}>
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className={cn('animate-pop w-full bg-card border border-line rounded-t-3xl sm:rounded-2xl max-h-[92vh] overflow-y-auto', wide ? 'sm:max-w-2xl' : 'sm:max-w-lg')}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3 sticky top-0 bg-card z-10">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-card2"><X size={18} /></button>
        </div>
        <div className="px-5 pb-6">{children}</div>
      </div>
    </div>
  )
}

export const Field = ({ label, children, className }) => (
  <label className={cn('block', className)}>
    <span className="text-xs text-muted mb-1.5 block">{label}</span>
    {children}
  </label>
)
const inputCls = 'w-full rounded-xl bg-field border border-line px-3 py-2.5 text-sm outline-none focus:border-accent transition'
export const Input = ({ className, ...p }) => <input className={cn(inputCls, className)} {...p} />
export const Select = ({ className, children, ...p }) => <select className={cn(inputCls, className)} {...p}>{children}</select>
export const Textarea = ({ className, ...p }) => <textarea rows={3} className={cn(inputCls, className)} {...p} />

export const Badge = ({ color = '#22d3ee', children, className }) => (
  <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium', className)} style={{ background: color + '26', color }}>
    {children}
  </span>
)

export const Progress = ({ value, color = '#22d3ee', className }) => (
  <div className={cn('h-2 rounded-full bg-field overflow-hidden', className)}>
    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: color }} />
  </div>
)

export function StatCard({ icon: Icon, label, value, color = '#22d3ee', sub }) {
  return (
    <Card className="flex items-center gap-4">
      <div className="h-12 w-12 rounded-2xl grid place-items-center shrink-0" style={{ background: color + '22', color }}>
        <Icon size={22} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted">{label}</p>
        <p className="text-lg sm:text-xl font-semibold truncate">{value}</p>
        {sub && <p className="text-[11px] text-muted">{sub}</p>}
      </div>
    </Card>
  )
}

export const PageHeader = ({ title, subtitle, actions }) => (
  <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
    <div>
      <h1 className="text-2xl font-semibold">{title}</h1>
      {subtitle && <p className="text-sm text-muted mt-0.5">{subtitle}</p>}
    </div>
    <div className="flex flex-wrap gap-2">{actions}</div>
  </div>
)

export const Empty = ({ icon: Icon, text }) => (
  <div className="py-10 text-center text-muted">
    {Icon && <Icon className="mx-auto mb-2 opacity-60" size={28} />}
    <p className="text-sm">{text}</p>
  </div>
)

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="inline-flex rounded-xl bg-card border border-line p-1 gap-1 overflow-x-auto max-w-full">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={cn('px-3.5 py-1.5 rounded-lg text-sm whitespace-nowrap transition flex items-center gap-1.5', value === t.id ? 'bg-accent text-[rgb(11_14_26)] font-semibold' : 'text-muted hover:text-ink')}
        >
          {t.icon && <t.icon size={15} />}{t.label}
        </button>
      ))}
    </div>
  )
}

export const chartTooltip = {
  contentStyle: { background: 'rgb(var(--card2))', border: '1px solid rgb(var(--line))', borderRadius: 12, fontSize: 12 },
  labelStyle: { color: 'rgb(var(--muted))' },
  itemStyle: { color: 'rgb(var(--ink))' },
}

export const Spinner = () => (
  <div className="min-h-screen grid place-items-center">
    <div className="h-10 w-10 rounded-full border-2 border-line border-t-accent animate-spin" />
  </div>
)
