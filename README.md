# DANY HUB

Application de gestion de vie personnelle : tâches, finances, paiements, calendrier, notifications, calculatrices et épargne.
Stack : React 18 + Vite + Tailwind CSS + Supabase (auth, Postgres, storage, realtime).

## Démarrage

1. **Crée un projet Supabase** sur https://supabase.com
2. Dans **SQL Editor**, exécute le fichier `supabase/schema.sql` (tables, RLS, realtime, bucket `receipts`).
3. Dans **Authentication > Providers**, vérifie que Email est activé (désactive « Confirm email » pour tester plus vite).
4. Copie `.env.example` en `.env` et renseigne `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` (Project Settings > API).
5. Lance :

```bash
npm install
npm run dev
```

Build de production : `npm run build` (dossier `dist/`, déployable sur Vercel / Netlify, avec les 2 variables d'environnement).

### Connexion Google

Dans Supabase, active **Authentication > Providers > Google** et configure les identifiants OAuth Google. Dans Google Cloud, ajoute l'URL de rappel affichée par le fournisseur Google de Supabase comme URI de redirection autorisée. Enfin, ajoute l'URL du site courant (par exemple `https://ton-site/`) dans **Authentication > URL Configuration > Redirect URLs**. Le bouton « Continuer avec Google » utilise le chemin du site courant comme destination de retour.

### Mise à jour d'une installation existante

Exécute à nouveau la version actuelle de `supabase/schema.sql` dans le SQL Editor de Supabase pour créer les tables `debts`, `debt_payments`, `calendar_events` et `notifications`, ainsi que leurs règles RLS et leurs index. Le script ajoute également la devise aux transactions, budgets et objectifs/contributions d'épargne existants. Pour les anciennes lignes sans devise, il utilise la devise enregistrée dans les préférences au moment de la migration (ou HTG si aucune préférence n'existe). Il conserve les montants et les données déjà présentes.

## Publication sur GitHub Pages

1. Crée un dépôt GitHub public nommé `dany-hub` et envoie-y le contenu de ce projet, sans le fichier `.env`.
2. Crée un projet Supabase et exécute `supabase/schema.sql` dans son éditeur SQL.
3. Dans les paramètres du dépôt GitHub, ajoute les secrets d'actions `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` (clé `anon`/publishable uniquement).
4. Dans Supabase > Authentication > URL Configuration, définis l'URL du site et l'URL de redirection sur `https://theandriquelouisjuste-rgb.github.io/dany-hub/`.
5. Dans GitHub > Settings > Pages, choisis **GitHub Actions** comme source. L'action publie automatiquement le site à chaque envoi sur `main`.

Les URL de navigation utilisent un fragment (`#/...`) pour être compatibles avec GitHub Pages. Le workflow échoue explicitement si les secrets Supabase ne sont pas configurés.

## Modules

| Module | Fonctions |
|---|---|
| Dashboard | Revenus et dépenses du mois, solde cumulé, dettes par devise, épargne, tâches, paiements à venir et graphiques filtrables |
| Tâches | CRUD, priorités, catégories (perso), échéances, rappels (notification navigateur), vues Liste / Kanban (drag & drop) / Calendrier |
| Finances | Transactions avec devise d'origine, recherche + filtres, rapports convertis, budgets par catégorie, dettes et remboursements avec historique, paiements récurrents |
| Paiements | Visa, Mastercard, cash, MonCash, NatCash, reçus (Storage privé), abonnements récurrents, rapports convertis, export CSV/PDF |
| Calendrier | Événements personnels, échéances des tâches et abonnements récurrents dans une vue mensuelle |
| Notifications | Alertes pour tâches en retard/à venir, paiements, échéances de dettes et seuils de budget; lecture, filtres et suppression |
| Calculatrices | Standard (clavier), pourcentage, convertisseur (taux en direct open.er-api.com), profit/perte, remise, budget 50/30/20 |
| Épargne | Objectifs, contributions, barres de progression, montant restant, estimation de date et effort mensuel |
| Réglages | Thème clair/sombre, devise principale, nom — sauvegardés dans `user_preferences`; les montants gardent leur devise d'origine et leur affichage est converti avec des taux en ligne mis en cache |

## Sécurité

- Row Level Security sur toutes les tables : `auth.uid() = user_id`.
- Reçus dans un bucket **privé**, un dossier par utilisateur, accès par URL signée temporaire.
- Aucun numéro de carte, CVV ou PIN n'est stocké : seulement le moyen de paiement.
- Seule la clé `anon` est utilisée côté client (jamais la `service_role`).

## Structure

```
src/
  components/  ui.jsx (kit UI), Layout.jsx (sidebar + bottom nav), Toast.jsx
  context/     AuthContext, PrefsContext
  hooks/       useTable (CRUD + realtime générique), useCategories
  lib/         supabase, utils, constants, export (CSV/PDF)
  pages/       Dashboard, Tasks, Finance, Payments, Calendar, Notifications, Calculators, Savings, Settings, Auth
supabase/schema.sql
```
