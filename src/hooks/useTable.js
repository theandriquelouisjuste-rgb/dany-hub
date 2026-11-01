import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

/**
 * CRUD générique + temps réel pour une table Supabase filtrée par user_id.
 */
export function useTable(table, { orderBy = 'created_at', ascending = false } = {}) {
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!user) return
    const { data, error } = await supabase
      .from(table).select('*').eq('user_id', user.id).order(orderBy, { ascending })
    if (error) setError(error.message)
    else { setRows(data); setError(null) }
    setLoading(false)
  }, [user, table, orderBy, ascending])

  useEffect(() => {
    load()
    if (!user) return
    const ch = supabase
      .channel(`${table}-${user.id}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table, filter: `user_id=eq.${user.id}` }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load, user, table])

  const insert = async (values) => {
    const { data, error } = await supabase.from(table).insert({ ...values, user_id: user.id }).select().single()
    if (error) throw error
    await load()
    return data
  }
  const update = async (id, values) => {
    const { error } = await supabase.from(table).update(values).eq('id', id).eq('user_id', user.id)
    if (error) throw error
    await load()
  }
  const remove = async (id) => {
    const { error } = await supabase.from(table).delete().eq('id', id).eq('user_id', user.id)
    if (error) throw error
    await load()
  }
  return { rows, loading, error, insert, update, remove, reload: load }
}
