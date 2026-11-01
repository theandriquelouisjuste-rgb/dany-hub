import { useMemo, useState } from 'react'
import { Bell, CheckCheck, CircleDollarSign, Clock3, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTable } from '../hooks/useTable'
import { useToast } from '../components/Toast'
import { Badge, Button, Card, Empty, PageHeader, Tabs } from '../components/ui'
import { fmtDateTime } from '../lib/utils'

const typeMeta = {
  task: { label: 'Tâche', color: '#8b5cf6', icon: Clock3 },
  payment: { label: 'Paiement', color: '#fbbf24', icon: CircleDollarSign },
  budget: { label: 'Budget', color: '#f87171', icon: CircleDollarSign },
  debt: { label: 'Dette', color: '#fb923c', icon: CircleDollarSign },
  system: { label: 'Système', color: '#22d3ee', icon: Bell },
}

export default function NotificationsPage() {
  const notifications = useTable('notifications')
  const toast = useToast()
  const [filter, setFilter] = useState('all')
  const visible = useMemo(() => notifications.rows
    .filter((item) => !item.is_deleted && (filter === 'all' || (filter === 'unread' ? !item.is_read : item.type === filter)))
    .sort((a, b) => b.created_at.localeCompare(a.created_at)), [notifications.rows, filter])
  const unread = notifications.rows.filter((item) => !item.is_read && !item.is_deleted).length

  const markRead = async (item) => {
    try { await notifications.update(item.id, { is_read: true }) }
    catch (error) { toast(error.message, 'error') }
  }

  const markAllRead = async () => {
    try {
      await Promise.all(notifications.rows.filter((item) => !item.is_read && !item.is_deleted).map((item) => notifications.update(item.id, { is_read: true })))
      toast('Toutes les notifications sont marquées comme lues')
    } catch (error) { toast(error.message, 'error') }
  }

  const dismiss = async (item) => {
    try { await notifications.update(item.id, { is_deleted: true }); toast('Notification supprimée') }
    catch (error) { toast(error.message, 'error') }
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Centre de notifications" subtitle={`${unread} notification(s) non lue(s)`}
        actions={<Button variant="ghost" onClick={markAllRead} disabled={!unread}><CheckCheck size={16} />Tout marquer comme lu</Button>} />

      <Tabs value={filter} onChange={setFilter} tabs={[
        { id: 'all', label: 'Toutes' },
        { id: 'unread', label: `Non lues${unread ? ` (${unread})` : ''}` },
        { id: 'task', label: 'Tâches' },
        { id: 'payment', label: 'Paiements' },
        { id: 'budget', label: 'Budgets' },
        { id: 'debt', label: 'Dettes' },
      ]} />

      <Card>
        {notifications.error ? <p role="alert" className="py-6 text-center text-sm text-red-400">Impossible de charger les notifications : {notifications.error}</p> :
          visible.length === 0 ? <Empty icon={Bell} text="Aucune notification dans cette vue" /> : (
            <div className="divide-y divide-line/70">
              {visible.map((item) => {
                const meta = typeMeta[item.type] || typeMeta.system
                const Icon = meta.icon
                return (
                  <div key={item.id} className={`flex items-start gap-3 py-4 first:pt-1 last:pb-1 ${item.is_read ? 'opacity-70' : ''}`}>
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: `${meta.color}20`, color: meta.color }}><Icon size={18} /></div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold">{item.title}</p>
                        <Badge color={meta.color}>{meta.label}</Badge>
                        {!item.is_read && <span className="h-2 w-2 rounded-full bg-accent" title="Non lue" />}
                      </div>
                      <p className="text-sm text-muted mt-1">{item.message}</p>
                      <p className="text-[11px] text-muted mt-2">{fmtDateTime(item.created_at)}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {item.href && <Link to={item.href} onClick={() => !item.is_read && markRead(item)} className="rounded-lg px-2 py-1.5 text-xs text-accent hover:bg-accent/10">Ouvrir</Link>}
                      {!item.is_read && <button aria-label="Marquer comme lu" title="Marquer comme lu" onClick={() => markRead(item)} className="rounded-lg p-2 text-muted hover:bg-card2 hover:text-accent"><CheckCheck size={15} /></button>}
                      <button aria-label="Supprimer la notification" title="Supprimer" onClick={() => dismiss(item)} className="rounded-lg p-2 text-muted hover:bg-card2 hover:text-red-400"><Trash2 size={15} /></button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
      </Card>
    </div>
  )
}
