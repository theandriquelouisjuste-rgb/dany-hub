# DANY HUB

Application de gestion de vie personnelle : tâches, finances, paiements, calculatrices et épargne.
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
| Dashboard | Revenus, dépenses, solde, tâches en attente, échéances, transactions récentes, graphiques mensuels, épargne |
| Tâches | CRUD, priorités, catégories (perso), échéances, rappels (notification navigateur), vues Liste / Kanban (drag & drop) / Calendrier |
| Finances | Revenus/dépenses, catégories perso, recherche + filtres, rapports jour/semaine/mois, budgets par catégorie, export CSV/PDF |
| Paiements | Visa, Mastercard, cash, MonCash, NatCash, reçus (Storage privé), abonnements récurrents, rapports, export CSV/PDF |
| Calculatrices | Standard (clavier), pourcentage, convertisseur (taux en direct open.er-api.com), profit/perte, remise, budget 50/30/20 |
| Épargne | Objectifs, contributions, barres de progression, montant restant, estimation de date et effort mensuel |
| Réglages | Thème clair/sombre, devise, nom — sauvegardés dans `user_preferences` |

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
  pages/       Dashboard, Tasks, Finance, Payments, Calculators, Savings, Settings, Auth
supabase/schema.sql
```
