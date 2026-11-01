import { createContext, useCallback, useContext, useState } from 'react'
import { CheckCircle2, AlertCircle, Bell } from 'lucide-react'

const ToastCtx = createContext(null)
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }) {
  const [items, setItems] = useState([])
  const push = useCallback((message, type = 'success') => {
    const id = Math.random().toString(36).slice(2)
    setItems((s) => [...s, { id, message, type }])
    setTimeout(() => setItems((s) => s.filter((i) => i.id !== id)), 4000)
  }, [])
  const icons = { success: CheckCircle2, error: AlertCircle, info: Bell }
  const colors = { success: 'text-emerald-400', error: 'text-red-400', info: 'text-accent' }
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-[min(92vw,360px)]">
        {items.map((t) => {
          const Icon = icons[t.type]
          return (
            <div key={t.id} className="animate-pop flex items-start gap-3 rounded-xl border border-line bg-card2 px-4 py-3 shadow-2xl">
              <Icon size={18} className={`mt-0.5 shrink-0 ${colors[t.type]}`} />
              <p className="text-sm">{t.message}</p>
            </div>
          )
        })}
      </div>
    </ToastCtx.Provider>
  )
}
