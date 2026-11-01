import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { isConfigured } from '../lib/supabase'
import { Button, Field, Input } from '../components/ui'

export default function Auth() {
  const { user, signIn, signInWithGoogle, signUp } = useAuth()
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

  const googleSignIn = async () => {
    setBusy(true)
    setMsg(null)
    try {
      const { error } = await signInWithGoogle()
      if (error) {
        setMsg({ t: 'error', m: error.message })
      }
    } catch (error) {
      setMsg({ t: 'error', m: error instanceof Error ? error.message : 'Connexion avec Google impossible.' })
    } finally {
      setBusy(false)
    }
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
        <div className="my-4 flex items-center gap-3 text-xs text-muted">
          <span className="h-px flex-1 bg-line" /><span>ou continuer avec</span><span className="h-px flex-1 bg-line" />
        </div>
        <Button type="button" variant="ghost" disabled={busy || !isConfigured} onClick={googleSignIn} className="w-full">
          <svg aria-hidden="true" viewBox="0 0 48 48" className="h-4 w-4">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" transform="translate(0 5)" />
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.27 5.48-4.78 7.18l7.73 6C44.4 37.94 46.98 31.7 46.98 24.55Z" />
            <path fill="#FBBC05" d="M10.53 28.59a14.4 14.4 0 0 1-.75-4.59c0-1.59.27-3.13.75-4.59l-7.98-6.19A23.9 23.9 0 0 0 0 24c0 3.87.93 7.54 2.56 10.78l7.97-6.19Z" transform="translate(0 0)" />
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.9-5.8l-7.73-6c-2.14 1.44-4.89 2.3-8.17 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z" transform="translate(0 -5)" />
          </svg>
          {busy ? 'Connexion…' : 'Continuer avec Google'}
        </Button>
        <button type="button" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setMsg(null) }} className="w-full mt-4 text-sm text-muted hover:text-accent">
          {mode === 'login' ? "Pas de compte ? S'inscrire" : 'Déjà un compte ? Se connecter'}
        </button>
      </form>
    </div>
  )
}
