import { useMemo } from 'react'
import { useTable } from './useTable'
import { DEFAULT_EXPENSE_CATS, DEFAULT_INCOME_CATS, DEFAULT_TASK_CATS } from '../lib/constants'

const DEFAULTS = { expense: DEFAULT_EXPENSE_CATS, income: DEFAULT_INCOME_CATS, task: DEFAULT_TASK_CATS }

/** Catégories par défaut + catégories personnalisées de l'utilisateur */
export function useCategories(type) {
  const t = useTable('categories', { orderBy: 'name', ascending: true })
  const custom = useMemo(() => t.rows.filter((c) => c.type === type), [t.rows, type])
  const all = useMemo(() => [...new Set([...DEFAULTS[type], ...custom.map((c) => c.name)])], [custom, type])
  return { all, custom, add: (name) => t.insert({ name, type }), remove: t.remove }
}
