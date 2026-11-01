import { useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTable } from '../hooks/useTable'
import { useToast } from '../components/Toast'
import { Badge, Button, Card, Empty, Field, Input, Modal, PageHeader, Textarea } from '../components/ui'
import { fmtDate, fmtDateTime, toDateStr, toLocalInput } from '../lib/utils'

const localInputForDay = (date) => `${date}T09:00`

export default function CalendarPage() {
  const events = useTable('calendar_events', { orderBy: 'starts_at' })
  const tasks = useTable('tasks', { orderBy: 'due_date', ascending: true })
  const payments = useTable('payments', { orderBy: 'next_due', ascending: true })
  const toast = useToast()
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [selectedDay, setSelectedDay] = useState(toDateStr())
  const [form, setForm] = useState(null)
  const today = toDateStr()

  const days = useMemo(() => {
    const year = month.getFullYear()
    const monthIndex = month.getMonth()
    const offset = (new Date(year, monthIndex, 1).getDay() + 6) % 7
    const count = new Date(year, monthIndex + 1, 0).getDate()
    const cells = Array.from({ length: offset }, () => null)
    for (let day = 1; day <= count; day += 1) cells.push(toDateStr(new Date(year, monthIndex, day)))
    while (cells.length % 7) cells.push(null)
    return cells
  }, [month])

  const monthPrefix = toDateStr(month).slice(0, 7)
  const monthEvents = events.rows.filter((event) => toDateStr(new Date(event.starts_at)).slice(0, 7) === monthPrefix)
  const monthTasks = tasks.rows.filter((task) => task.due_date?.slice(0, 7) === monthPrefix && task.status !== 'done')
  const monthPayments = payments.rows.filter((payment) => payment.is_recurring && payment.next_due?.slice(0, 7) === monthPrefix)
  const loadError = events.error || tasks.error || payments.error

  const selectedItems = useMemo(() => {
    const eventItems = events.rows
      .filter((event) => toDateStr(new Date(event.starts_at)) === selectedDay)
      .map((event) => ({ id: event.id, title: event.title, time: fmtDateTime(event.starts_at), sortAt: event.starts_at, color: event.color, kind: 'Événement', event }))
    const taskItems = tasks.rows
      .filter((task) => task.due_date === selectedDay && task.status !== 'done')
      .map((task) => ({ id: task.id, title: task.title, time: 'Échéance', sortAt: `${selectedDay}T00:00:00`, color: '#8b5cf6', kind: 'Tâche' }))
    const paymentItems = payments.rows
      .filter((payment) => payment.is_recurring && payment.next_due === selectedDay)
      .map((payment) => ({ id: payment.id, title: payment.merchant, time: 'Paiement prévu', sortAt: `${selectedDay}T00:00:00`, color: '#fbbf24', kind: 'Paiement' }))
    return [...eventItems, ...taskItems, ...paymentItems].sort((a, b) => new Date(a.sortAt) - new Date(b.sortAt))
  }, [events.rows, tasks.rows, payments.rows, selectedDay])

  const openNewEvent = () => setForm({
    title: '',
    description: '',
    starts_at: localInputForDay(selectedDay),
    ends_at: '',
    color: '#22d3ee',
  })

  const saveEvent = async (e) => {
    e.preventDefault()
    if (!form.title.trim() || !form.starts_at) return toast('Ajoute un titre et une date', 'error')
    if (form.ends_at && new Date(form.ends_at) < new Date(form.starts_at)) return toast('La fin doit être après le début', 'error')
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      starts_at: new Date(form.starts_at).toISOString(),
      ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
      color: form.color,
    }
    try {
      if (form.id) await events.update(form.id, payload)
      else await events.insert(payload)
      const startDate = new Date(payload.starts_at)
      setSelectedDay(toDateStr(startDate))
      setMonth(new Date(startDate.getFullYear(), startDate.getMonth(), 1))
      setForm(null)
      toast(form.id ? 'Événement modifié' : 'Événement ajouté')
    } catch (error) { toast(error.message, 'error') }
  }

  const removeEvent = async (event) => {
    if (!confirm(`Supprimer « ${event.title} » ?`)) return
    try { await events.remove(event.id); toast('Événement supprimé') }
    catch (error) { toast(error.message, 'error') }
  }

  const shiftMonth = (amount) => {
    const next = new Date(month.getFullYear(), month.getMonth() + amount, 1)
    setMonth(next)
    setSelectedDay(toDateStr(next))
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Calendrier & agenda" subtitle="Événements, échéances de tâches et paiements à venir"
        actions={<Button onClick={openNewEvent}><Plus size={16} />Nouvel événement</Button>} />
      {loadError && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">Impossible de charger toutes les données du calendrier : {loadError}</p>}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(280px,.8fr)]">
        <Card className="min-w-0">
          <div className="flex items-center justify-between gap-3 mb-5">
            <div>
              <p className="text-xs uppercase tracking-[.16em] text-muted">Agenda mensuel</p>
              <h2 className="text-xl font-semibold capitalize mt-1">{month.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</h2>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" aria-label="Mois précédent" onClick={() => shiftMonth(-1)}><ChevronLeft size={18} /></Button>
              <Button variant="ghost" size="sm" onClick={() => { setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1)); setSelectedDay(today) }}>Aujourd'hui</Button>
              <Button variant="ghost" size="icon" aria-label="Mois suivant" onClick={() => shiftMonth(1)}><ChevronRight size={18} /></Button>
            </div>
          </div>
          <div className="grid grid-cols-7 border-b border-line pb-2 text-center text-[10px] uppercase tracking-wider text-muted sm:text-xs">
            {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((day) => <span key={day}>{day}</span>)}
          </div>
          <div className="grid grid-cols-7">
            {days.map((day, index) => {
              const eventCount = day ? monthEvents.filter((event) => toDateStr(new Date(event.starts_at)) === day).length : 0
              const taskCount = day ? monthTasks.filter((task) => task.due_date === day).length : 0
              const paymentCount = day ? monthPayments.filter((payment) => payment.next_due === day).length : 0
              const hasItems = eventCount + taskCount + paymentCount > 0
              return (
                <button key={`${day || 'empty'}-${index}`} disabled={!day} onClick={() => setSelectedDay(day)}
                  className={`relative min-h-[58px] border-b border-line/60 p-1.5 text-left transition sm:min-h-[82px] sm:p-2 ${!day ? 'cursor-default' : 'hover:bg-card2/70'} ${day === selectedDay ? 'bg-accent/10 ring-1 ring-inset ring-accent/50' : ''}`}>
                  {day && <>
                    <span className={`grid h-7 w-7 place-items-center rounded-full text-xs ${day === today ? 'bg-accent font-semibold text-[rgb(11_14_26)]' : day === selectedDay ? 'text-accent' : 'text-ink'}`}>{Number(day.slice(-2))}</span>
                    {hasItems && <span className="mt-1 flex gap-1">
                      {eventCount > 0 && <i className="h-1.5 w-1.5 rounded-full bg-accent" />}
                      {taskCount > 0 && <i className="h-1.5 w-1.5 rounded-full bg-violet-400" />}
                      {paymentCount > 0 && <i className="h-1.5 w-1.5 rounded-full bg-amber-400" />}
                    </span>}
                    <span className="hidden sm:block text-[10px] text-muted mt-1">{eventCount + taskCount + paymentCount ? `${eventCount + taskCount + paymentCount} élément(s)` : ''}</span>
                  </>}
                </button>
              )
            })}
          </div>
          <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted">
            <span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-accent" />Événements</span>
            <span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-violet-400" />Tâches</span>
            <span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-amber-400" />Paiements</span>
          </div>
        </Card>

        <Card>
          <div className="flex items-start justify-between gap-3 mb-4">
            <div><p className="text-xs uppercase tracking-[.16em] text-muted">Programme du jour</p><h2 className="text-lg font-semibold mt-1">{fmtDate(selectedDay)}</h2></div>
            <Button variant="ghost" size="icon" title="Ajouter un événement" onClick={openNewEvent}><Plus size={17} /></Button>
          </div>
          {selectedItems.length === 0 ? <Empty icon={CalendarDays} text="Rien de prévu pour cette date" /> : (
            <div className="space-y-2.5">
              {selectedItems.map((item) => (
                <div key={`${item.kind}-${item.id}`} className="flex items-start gap-3 rounded-xl border border-line bg-card2/40 p-3">
                  <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: item.color }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-muted mt-1">{item.time} · {item.kind}</p>
                  </div>
                  {item.event ? <div className="flex gap-1">
                    <button aria-label="Modifier l'événement" onClick={() => setForm({ ...item.event, starts_at: toLocalInput(item.event.starts_at), ends_at: toLocalInput(item.event.ends_at) })} className="p-1 text-muted hover:text-accent"><Pencil size={14} /></button>
                    <button aria-label="Supprimer l'événement" onClick={() => removeEvent(item.event)} className="p-1 text-muted hover:text-red-400"><Trash2 size={14} /></button>
                  </div> : <Badge color={item.color}>{item.kind}</Badge>}
                </div>
              ))}
            </div>
          )}
          <div className="mt-5 grid grid-cols-2 gap-2">
            <Link to="/tasks" className="rounded-xl border border-line p-3 text-xs text-muted hover:border-accent/50 hover:text-ink">Gérer les tâches</Link>
            <Link to="/payments" className="rounded-xl border border-line p-3 text-xs text-muted hover:border-accent/50 hover:text-ink">Gérer les paiements</Link>
          </div>
        </Card>
      </div>

      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? 'Modifier l’événement' : 'Nouvel événement'}>
        {form && <form onSubmit={saveEvent} className="space-y-4">
          <Field label="Titre"><Input required autoFocus value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Début"><Input required type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} /></Field>
            <Field label="Fin (facultative)"><Input type="datetime-local" min={form.starts_at} value={form.ends_at || ''} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} /></Field>
          </div>
          <Field label="Description"><Textarea value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <Field label="Couleur"><Input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="h-11 p-1" /></Field>
          <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setForm(null)}>Annuler</Button><Button type="submit">Enregistrer</Button></div>
        </form>}
      </Modal>
    </div>
  )
}
