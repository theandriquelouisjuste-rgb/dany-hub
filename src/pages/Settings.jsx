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

  const savePreference = async (patch, message) => {
    try {
      await prefs.update(patch)
      toast(message)
    } catch (error) {
      toast(error.message, 'error')
    }
  }

  return (
    <div className="max-w-2xl">
      <PageHeader title="Réglages" subtitle="Tes préférences sont sauvegardées sur ton compte." />
      <div className="space-y-4">
        <Card>
          <h3 className="font-semibold mb-4">Profil</h3>
          <Field label="Email"><Input value={user?.email || ''} disabled /></Field>
          <div className="flex gap-2 items-end mt-4">
            <Field label="Nom affiché" className="flex-1"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Button onClick={() => savePreference({ display_name: name }, 'Profil mis à jour')}>Enregistrer</Button>
          </div>
        </Card>
        <Card>
          <h3 className="font-semibold mb-4">Apparence</h3>
          <div className="grid grid-cols-2 gap-3">
            {[['dark', 'Sombre', Moon], ['light', 'Clair', Sun]].map(([id, label, Icon]) => (
              <button key={id} onClick={() => savePreference({ theme: id }, 'Apparence mise à jour')}
                className={`flex items-center gap-3 rounded-xl border p-4 transition ${prefs.theme === id ? 'border-accent bg-accent/10 text-accent' : 'border-line text-muted hover:text-ink'}`}>
                <Icon size={20} />{label}
              </button>
            ))}
          </div>
        </Card>
        <Card>
          <h3 className="font-semibold mb-4">Devise principale</h3>
          <Select value={prefs.currency} onChange={(e) => savePreference({ currency: e.target.value }, 'Devise mise à jour')}>
            {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
          </Select>
          <p className="text-xs text-muted mt-2">Les montants enregistrés gardent leur devise d'origine. Changer cette devise convertit leur affichage dans toute l'application; cela ne modifie pas les données sauvegardées.</p>
          <p className="text-xs text-muted mt-2">Taux appliqué pour la conversion gourde/dollar : 1 USD = {prefs.usdHtgRate.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} HTG. Les autres devises utilisent le taux de référence en ligne.</p>
          <p className="text-xs text-muted mt-2">
            {prefs.rateLoading ? 'Mise à jour des taux de change…' :
              prefs.ratesUpdatedAt ? `Taux récupérés le ${new Date(prefs.ratesUpdatedAt).toLocaleString('fr-FR')}${prefs.rateError ? ' · dernière mise à jour impossible, taux en cache utilisés' : ''}` :
                prefs.rateError ? `Conversion indisponible : ${prefs.rateError}` : 'Chargement des taux de change…'}
          </p>
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
