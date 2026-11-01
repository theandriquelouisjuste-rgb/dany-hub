import { LogOut, Moon, Sun } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { usePrefs } from '../context/PrefsContext'
import { useToast } from '../components/Toast'
import { Button, Card, Field, Input, PageHeader, Select } from '../components/ui'
import { CURRENCIES } from '../lib/constants'
import { useState } from 'react'

export default function SettingsPage() {
  const { user, signOut } = useAuth()
  const prefs = usePrefs()
  const toast = useToast()
  const nav = useNavigate()
  const [name, setName] = useState(prefs.display_name || '')

  return (
    <div className="max-w-2xl">
      <PageHeader title="Réglages" subtitle="Tes préférences sont sauvegardées sur ton compte." />
      <div className="space-y-4">
        <Card>
          <h3 className="font-semibold mb-4">Profil</h3>
          <Field label="Email"><Input value={user?.email || ''} disabled /></Field>
          <div className="flex gap-2 items-end mt-4">
            <Field label="Nom affiché" className="flex-1"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Button onClick={async () => { await prefs.update({ display_name: name }); toast('Profil mis à jour') }}>Enregistrer</Button>
          </div>
        </Card>
        <Card>
          <h3 className="font-semibold mb-4">Apparence</h3>
          <div className="grid grid-cols-2 gap-3">
            {[['dark', 'Sombre', Moon], ['light', 'Clair', Sun]].map(([id, label, Icon]) => (
              <button key={id} onClick={() => prefs.update({ theme: id })}
                className={`flex items-center gap-3 rounded-xl border p-4 transition ${prefs.theme === id ? 'border-accent bg-accent/10 text-accent' : 'border-line text-muted hover:text-ink'}`}>
                <Icon size={20} />{label}
              </button>
            ))}
          </div>
        </Card>
        <Card>
          <h3 className="font-semibold mb-4">Devise principale</h3>
          <Select value={prefs.currency} onChange={(e) => { prefs.update({ currency: e.target.value }); toast('Devise mise à jour') }}>
            {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
          </Select>
          <p className="text-xs text-muted mt-2">Utilisée pour l'affichage des montants dans tout DANY HUB.</p>
        </Card>
        <Card>
          <h3 className="font-semibold mb-1">Sécurité</h3>
          <p className="text-xs text-muted mb-4">Tes données sont isolées par compte (Row Level Security). DANY HUB ne stocke jamais de numéro de carte, CVV ou PIN.</p>
          <Button variant="danger" onClick={async () => { await signOut(); nav('/login') }}><LogOut size={16} />Se déconnecter</Button>
        </Card>
      </div>
    </div>
  )
}
