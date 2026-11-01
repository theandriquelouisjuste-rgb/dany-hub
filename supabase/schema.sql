-- =====================================================================
-- DANY HUB — Schéma Supabase
-- À exécuter dans : Supabase Dashboard > SQL Editor > New query
-- Sécurité : RLS activé partout, chaque utilisateur ne voit que ses données.
-- AUCUN numéro de carte / CVV / PIN n'est stocké : seulement le moyen de paiement.
-- =====================================================================

create extension if not exists "pgcrypto";

-- Préférences utilisateur (thème, devise...) --------------------------
create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme text not null default 'dark' check (theme in ('dark','light')),
  currency text not null default 'HTG',
  display_name text,
  updated_at timestamptz not null default now()
);

-- Catégories personnalisées -------------------------------------------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null,
  type text not null check (type in ('expense','income','task')),
  color text not null default '#22d3ee',
  created_at timestamptz not null default now(),
  unique (user_id, type, name)
);

-- Tâches ---------------------------------------------------------------
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  title text not null,
  description text,
  priority text not null default 'medium' check (priority in ('low','medium','high')),
  status text not null default 'todo' check (status in ('todo','doing','done')),
  category text,
  due_date date,
  reminder_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists tasks_user_due on public.tasks (user_id, due_date);

-- Transactions (revenus / dépenses) -----------------------------------
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  type text not null check (type in ('income','expense')),
  amount numeric(14,2) not null check (amount > 0),
  category text not null,
  description text,
  date date not null default current_date,
  created_at timestamptz not null default now()
);
create index if not exists tx_user_date on public.transactions (user_id, date desc);

-- Budgets mensuels par catégorie --------------------------------------
create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  category text not null,
  amount numeric(14,2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  unique (user_id, category)
);

-- Paiements (Visa, Mastercard, cash, MonCash, NatCash) ----------------
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  merchant text not null,
  amount numeric(14,2) not null check (amount > 0),
  currency text not null default 'HTG',
  date date not null default current_date,
  method text not null check (method in ('visa','mastercard','cash','moncash','natcash')),
  category text,
  notes text,
  receipt_path text,
  is_recurring boolean not null default false,
  frequency text check (frequency in ('weekly','monthly','yearly')),
  next_due date,
  created_at timestamptz not null default now()
);
create index if not exists pay_user_date on public.payments (user_id, date desc);

-- Objectifs d'épargne ---------------------------------------------------
create table if not exists public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null,
  target_amount numeric(14,2) not null check (target_amount > 0),
  deadline date,
  color text not null default '#22d3ee',
  created_at timestamptz not null default now()
);

create table if not exists public.savings_contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  goal_id uuid not null references public.savings_goals(id) on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  date date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);

-- Row Level Security ----------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['categories','tasks','transactions','budgets','payments','savings_goals','savings_contributions']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format('create policy "own rows" on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
  end loop;
end $$;

alter table public.user_preferences enable row level security;
drop policy if exists "own prefs" on public.user_preferences;
create policy "own prefs" on public.user_preferences for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Temps réel -------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['tasks','transactions','budgets','payments','savings_goals','savings_contributions','categories']
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- Stockage des reçus (bucket privé, un dossier par utilisateur) --------
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

drop policy if exists "receipts read own" on storage.objects;
drop policy if exists "receipts insert own" on storage.objects;
drop policy if exists "receipts delete own" on storage.objects;

create policy "receipts read own" on storage.objects for select
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "receipts insert own" on storage.objects for insert
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "receipts delete own" on storage.objects for delete
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
