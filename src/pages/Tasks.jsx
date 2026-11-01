import { useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Columns3, Filter, List, Pencil, Plus, Trash2, Check, Bell, Tags } from 'lucide-react'
import { useTable } from '../hooks/useTable'
import { useCategories } from '../hooks/useCategories'
import { useToast } from '../components/Toast'
import { Badge, Button, Card, Empty, Field, Input, Modal, PageHeader, Select, Tabs, Textarea } from '../components/ui'
import { PRIORITIES, STATUSES, priorityOf } from '../lib/constants'
import { cn, fmtDate, fmtDateTime, fromLocalInput, toDateStr, toLocalInput } from '../lib/utils'

const empty = { title: '', description: '', priority: 'medium', status: 'todo', category: 'Personnel', due_date: '', reminder_at: '' }

export default function Tasks() {
  const { rows, insert, update, remove } = useTable('tasks', { orderBy: 'created_at' })
  const cats = useCategories('task')
  const toast = useToast()
  const [view, setView] = useState('list')
  const [form, setForm] = useState(null)
  const [catModal, setCatModal] = useState(false)
  const [newCat, setNewCat] = useState('')
  const [fp, setFp] = useState('')
  const [fs, setFs] = useState('')
  const [fc, setFc] = useState('')
  const [q, setQ] = useState('')
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const today = toDateStr()

  const filtered = useMemo(() => rows.filter((t) =>
    (!fp || t.priority === fp) && (!fs || t.status === fs) && (!fc || t.category === fc) &&
    (!q || t.title.toLowerCase().includes(q.toLowerCase()))
  ).sort((a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999')), [rows, fp, fs, fc, q])

  const save = async (e) => {
    e.preventDefault()
    const payload = {
      title: form.title.trim(), description: form.description || null, priority: form.priority, status: form.status,
      category: form.category || null, due_date: form.due_date || null, reminder_at: fromLocalInput(form.reminder_at),
      completed_at: form.status === 'done' ? (form.completed_at || new Date().toISOString()) : null,
    }
    try {
      if (form.id) await update(form.id, payload); else await insert(payload)
      toast(form.id ? 'Tâche modifiée' : 'Tâche créée'); setForm(null)
    } catch (err) { toast(err.message, 'error') }
  }
  const del = async (t) => { if (confirm(`Supprimer « ${t.title} » ?`)) { try { await remove(t.id); toast('Tâche supprimée') } catch (e) { toast(e.message, 'error') } } }
  const setStatus = async (t, status) => {
    try { await update(t.id, { status, completed_at: status === 'done' ? new Date().toISOString() : null }) } catch (e) { toast(e.message, 'error') }
  }
  const openEdit = (t) => setForm({ ...empty, ...t, description: t.description || '', due_date: t.due_date || '', reminder_at: toLocalInput(t.reminder_at) })

  const Item = ({ t }) => {
    const late = t.status !== 'done' && t.due_date && t.due_date < today
    return (
      <div className="flex items-start gap-3 rounded-xl border border-line bg-card2/50 p-3.5 hover:border-accent/40 transition">
        <button onClick={() => setStatus(t, t.status === 'done' ? 'todo' : 'done')}
          className={cn('mt-0.5 h-5 w-5 rounded-md border grid place-items-center shrink-0 transition', t.status === 'done' ? 'bg-accent border-accent text-[rgb(11_14_26)]' : 'border-muted')}>
          {t.status === 'done' && <Check size={13} strokeWidth={3} />}
        </button>
        <div className="min-w-0 flex-1">
          <p className={cn('text-sm font-medium', t.status === 'done' && 'line-through text-muted')}>{t.title}</p>
          {t.description && <p className="text-xs text-muted mt-0.5 line-clamp-2">{t.description}</p>}
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <Badge color={priorityOf(t.priority).color}>{priorityOf(t.priority).label}</Badge>
            {t.category && <Badge color="#8b5cf6">{t.category}</Badge>}
            {t.due_date && <span className={cn('text-[11px]', late ? 'text-red-400' : 'text-muted')}>📅 {fmtDate(t.due_date)}{late && ' · en retard'}</span>}
            {t.reminder_at && <span className="text-[11px] text-muted flex items-center gap-1"><Bell size={11} />{fmtDateTime(t.reminder_at)}</span>}
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          <button onClick={() => openEdit(t)} className="p-1.5 rounded-lg text-muted hover:text-accent hover:bg-card2"><Pencil size={15} /></button>
          <button onClick={() => del(t)} className="p-1.5 rounded-lg text-muted hover:text-red-400 hover:bg-card2"><Trash2 size={15} /></button>
        </div>
      </div>
    )
  }

  // Calendrier
  const calendar = useMemo(() => {
    const y = month.getFullYear(), m = month.getMonth()
    const first = (new Date(y, m, 1).getDay() + 6) % 7
    const days = new Date(y, m + 1, 0).getDate()
    const cells = []
    for (let i = 0; i < first; i++) cells.push(null)
    for (let d = 1; d <= days; d++) cells.push(toDateStr(new Date(y, m, d)))
    return cells
  }, [month])

  const onDrop = (e, status) => {
    const id = e.dataTransfer.getData('id')
    const t = rows.find((r) => r.id === id)
    if (t && t.status !== status) setStatus(t, status)
  }

  const done = rows.filter((t) => t.status === 'done').length

  return (
    <div>
      <PageHeader title="Tâches" subtitle={`${rows.length - done} en attente · ${done} terminées`}
        actions={<>
          <Button variant="ghost" onClick={() => setCatModal(true)}><Tags size={16} />Catégories</Button>
          <Button onClick={() => setForm({ ...empty })}><Plus size={16} />Nouvelle tâche</Button>
        </>} />

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <Tabs value={view} onChange={setView} tabs={[
          { id: 'list', label: 'Liste', icon: List }, { id: 'kanban', label: 'Kanban', icon: Columns3 }, { id: 'calendar', label: 'Calendrier', icon: CalendarDays }]} />
        <div className="flex flex-wrap gap-2 items-center flex-1 min-w-[260px]">
          <Filter size={16} className="text-muted" />
          <Input placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} className="!w-40" />
          <Select value={fp} onChange={(e) => setFp(e.target.value)} className="!w-auto"><option value="">Priorité</option>{PRIORITIES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</Select>
          <Select value={fs} onChange={(e) => setFs(e.target.value)} className="!w-auto"><option value="">Statut</option>{STATUSES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</Select>
          <Select value={fc} onChange={(e) => setFc(e.target.value)} className="!w-auto"><option value="">Catégorie</option>{cats.all.map((c) => <option key={c}>{c}</option>)}</Select>
        </div>
      </div>

      {view === 'list' && (
        <div className="grid lg:grid-cols-2 gap-5">
          {[['En attente', filtered.filter((t) => t.status !== 'done')], ['Terminées', filtered.filter((t) => t.status === 'done')]].map(([label, list]) => (
            <Card key={label}>
              <h3 className="font-semibold mb-3">{label} <span className="text-muted text-sm">({list.length})</span></h3>
              {list.length === 0 ? <Empty text="Rien ici" /> : <div className="space-y-2.5">{list.map((t) => <Item key={t.id} t={t} />)}</div>}
            </Card>
          ))}
        </div>
      )}

      {view === 'kanban' && (
        <div className="grid md:grid-cols-3 gap-4">
          {STATUSES.map((s) => {
            const list = filtered.filter((t) => t.status === s.id)
            return (
              <div key={s.id} onDragOver={(e) => e.preventDefault()} onDrop={(e) => onDrop(e, s.id)}
                className="rounded-2xl bg-card border border-line p-4 min-h-[220px]">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold">{s.label}</h3><Badge>{list.length}</Badge>
                </div>
                <div className="space-y-2.5">
                  {list.map((t) => (
                    <div key={t.id} draggable onDragStart={(e) => e.dataTransfer.setData('id', t.id)} className="cursor-grab active:cursor-grabbing">
                      <Item t={t} />
                    </div>
                  ))}
                </div>
                <button onClick={() => setForm({ ...empty, status: s.id })} className="w-full mt-3 text-xs text-muted hover:text-accent py-2 rounded-lg border border-dashed border-line">+ Ajouter</button>
              </div>
            )
          })}
        </div>
      )}

      {view === 'calendar' && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold capitalize">{month.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</h3>
            <div className="flex gap-1">
              <Button size="icon" variant="ghost" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft size={16} /></Button>
              <Button size="sm" variant="ghost" onClick={() => { const d = new Date(); setMonth(new Date(d.getFullYear(), d.getMonth(), 1)) }}>Aujourd'hui</Button>
              <Button size="icon" variant="ghost" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight size={16} /></Button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted mb-1">
            {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => <div key={i} className="py-1">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {calendar.map((date, i) => {
              if (!date) return <div key={i} />
              const list = filtered.filter((t) => t.due_date === date)
              return (
                <button key={date} onClick={() => setForm({ ...empty, due_date: date })}
                  className={cn('min-h-[64px] sm:min-h-[92px] rounded-xl border p-1.5 text-left transition hover:border-accent/60', date === today ? 'border-accent bg-accent/10' : 'border-line bg-card2/40')}>
                  <span className={cn('text-xs', date === today ? 'text-accent font-semibold' : 'text-muted')}>{+date.slice(8)}</span>
                  <div className="mt-1 space-y-0.5">
                    {list.slice(0, 2).map((t) => (
                      <div key={t.id} onClick={(e) => { e.stopPropagation(); openEdit(t) }}
                        className="truncate rounded px-1 py-0.5 text-[10px] sm:text-[11px]" style={{ background: priorityOf(t.priority).color + '30', color: priorityOf(t.priority).color }}>
                        {t.title}
                      </div>
                    ))}
                    {list.length > 2 && <div className="text-[10px] text-muted">+{list.length - 2}</div>}
                  </div>
                </button>
              )
            })}
          </div>
        </Card>
      )}

      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? 'Modifier la tâche' : 'Nouvelle tâche'}>
        {form && (
          <form onSubmit={save} className="space-y-4">
            <Field label="Titre"><Input required autoFocus value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
            <Field label="Description"><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Priorité"><Select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>{PRIORITIES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</Select></Field>
              <Field label="Statut"><Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{STATUSES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</Select></Field>
              <Field label="Catégorie"><Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{cats.all.map((c) => <option key={c}>{c}</option>)}</Select></Field>
              <Field label="Échéance"><Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></Field>
            </div>
            <Field label="Rappel (notification)"><Input type="datetime-local" value={form.reminder_at} onChange={(e) => setForm({ ...form, reminder_at: e.target.value })} /></Field>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setForm(null)}>Annuler</Button>
              <Button type="submit">{form.id ? 'Enregistrer' : 'Créer'}</Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={catModal} onClose={() => setCatModal(false)} title="Catégories de tâches">
        <form className="flex gap-2 mb-4" onSubmit={async (e) => { e.preventDefault(); if (!newCat.trim()) return; try { await cats.add(newCat.trim()); setNewCat('') } catch (err) { toast(err.message, 'error') } }}>
          <Input placeholder="Nouvelle catégorie" value={newCat} onChange={(e) => setNewCat(e.target.value)} />
          <Button type="submit">Ajouter</Button>
        </form>
        <div className="flex flex-wrap gap-2">
          {cats.all.map((c) => {
            const custom = cats.custom.find((x) => x.name === c)
            return <Badge key={c} color={custom ? '#22d3ee' : '#8b5cf6'}>{c}{custom && <button onClick={() => cats.remove(custom.id)} className="ml-1 opacity-70 hover:opacity-100">×</button>}</Badge>
          })}
        </div>
      </Modal>
    </div>
  )
}
