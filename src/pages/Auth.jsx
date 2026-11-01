import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { isConfigured } from '../lib/supabase'
import { Button, Field, Input } from '../components/ui'

export default function Auth() {
  const { user, signIn, signUp } = useAuth()
  const [mode, setMode] = useState('login')
  const [f, setF] = useState({ email: '', password: '', name: '' })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  if (user) return <Navigate to="/" replace />

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setMsg(null)
    const { data, error } = mode === 'login'
      ? await signIn(f.email, f.password)
      : await signUp(f.email, f.password, f.name)
    setBusy(false)
    if (error) setMsg({ t: 'error', m: error.message })
    else if (mode === 'signup' && !data.session) setMsg({ t: 'ok', m: 'Compte créé. Vérifie ta boîte mail pour confirmer ton adresse, puis connecte-toi.' })
  }

  return (
    <div className="min-h-screen grid place-items-center p-4 relative overflow-hidden">
      <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-accent/20 blur-3xl" />
      <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-violet-500/20 blur-3xl" />
      <form onSubmit={submit} className="relative w-full max-w-md rounded-3xl bg-card border border-line p-8 animate-fade-up">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-12 w-12 rounded-2xl bg-accent text-[rgb(11_14_26)] grid place-items-center font-bold text-lg">DH</div>
          <div>
            <h1 className="text-xl font-bold tracking-wide">DANY HUB</h1>
            <p className="text-xs text-muted">Ta vie, centralisée.</p>
          </div>
        </div>
        {!isConfigured && (
          <div className="mb-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs p-3">
            Supabase n'est pas configuré. Copie <code>.env.example</code> vers <code>.env</code> et renseigne ton URL et ta clé.
          </div>
        )}
        <div className="space-y-4">
          {mode === 'signup' && (
            <Field label="Nom"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Dany" /></Field>
          )}
          <Field label="Email"><Input type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
          <Field label="Mot de passe"><Input type="password" required minLength={6} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
        </div>
        {msg && <p className={`mt-4 text-sm ${msg.t === 'error' ? 'text-red-400' : 'text-emerald-400'}`}>{msg.m}</p>}
        <Button type="submit" disabled={busy} className="w-full mt-6">{busy ? '…' : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}</Button>
        <button type="button" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setMsg(null) }} className="w-full mt-4 text-sm text-muted hover:text-accent">
          {mode === 'login' ? "Pas de compte ? S'inscrire" : 'Déjà un compte ? Se connecter'}
        </button>
      </form>
    </div>
  )
}
