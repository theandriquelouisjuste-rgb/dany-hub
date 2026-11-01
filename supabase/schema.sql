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
  currency text not null default 'HTG',
  created_at timestamptz not null default now()
);
alter table public.transactions add column if not exists currency text;
update public.transactions t
set currency = coalesce(p.currency, 'HTG')
from public.user_preferences p
where t.user_id = p.user_id and t.currency is null;
update public.transactions set currency = 'HTG' where currency is null;
alter table public.transactions alter column currency set default 'HTG';
alter table public.transactions alter column currency set not null;
create index if not exists tx_user_date on public.transactions (user_id, date desc);

-- Budgets mensuels par catégorie --------------------------------------
create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  category text not null,
  amount numeric(14,2) not null check (amount > 0),
  currency text not null default 'HTG',
  created_at timestamptz not null default now(),
  unique (user_id, category)
);
alter table public.budgets add column if not exists currency text;
update public.budgets b
set currency = coalesce(p.currency, 'HTG')
from public.user_preferences p
where b.user_id = p.user_id and b.currency is null;
update public.budgets set currency = 'HTG' where currency is null;
alter table public.budgets alter column currency set default 'HTG';
alter table public.budgets alter column currency set not null;

-- Dettes et remboursements ---------------------------------------------
create table if not exists public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null,
  direction text not null check (direction in ('owe','owed')),
  initial_amount numeric(14,2) not null check (initial_amount > 0),
  currency text not null default 'HTG',
  due_date date,
  notes text,
  created_at timestamptz not null default now(),
  unique (id, user_id)
);
create index if not exists debts_user_due on public.debts (user_id, due_date);

create table if not exists public.debt_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  debt_id uuid not null,
  amount numeric(14,2) not null check (amount > 0),
  date date not null default current_date,
  notes text,
  created_at timestamptz not null default now(),
  foreign key (debt_id, user_id) references public.debts(id, user_id) on delete cascade
);
create index if not exists debt_payments_user_debt on public.debt_payments (user_id, debt_id, date desc);

-- Événements de calendrier ---------------------------------------------
create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  title text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  color text not null default '#22d3ee',
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at)
);
create index if not exists calendar_events_user_start on public.calendar_events (user_id, starts_at);

-- Centre de notifications ----------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  source_key text not null,
  type text not null check (type in ('task','payment','budget','debt','system')),
  title text not null,
  message text not null,
  href text,
  is_read boolean not null default false,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, source_key)
);
alter table public.notifications add column if not exists is_deleted boolean not null default false;
create index if not exists notifications_user_created on public.notifications (user_id, created_at desc);

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
alter table public.payments add column if not exists currency text;
update public.payments p
set currency = coalesce(prefs.currency, 'HTG')
from public.user_preferences prefs
where p.user_id = prefs.user_id and p.currency is null;
update public.payments set currency = 'HTG' where currency is null;
alter table public.payments alter column currency set default 'HTG';
alter table public.payments alter column currency set not null;

-- Objectifs d'épargne ---------------------------------------------------
create table if not exists public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null,
  target_amount numeric(14,2) not null check (target_amount > 0),
  currency text not null default 'HTG',
  deadline date,
  color text not null default '#22d3ee',
  created_at timestamptz not null default now()
);
alter table public.savings_goals add column if not exists currency text;
update public.savings_goals g
set currency = coalesce(p.currency, 'HTG')
from public.user_preferences p
where g.user_id = p.user_id and g.currency is null;
update public.savings_goals set currency = 'HTG' where currency is null;
alter table public.savings_goals alter column currency set default 'HTG';
alter table public.savings_goals alter column currency set not null;

create table if not exists public.savings_contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  goal_id uuid not null references public.savings_goals(id) on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  currency text not null default 'HTG',
  date date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);
alter table public.savings_contributions add column if not exists currency text;
update public.savings_contributions c
set currency = coalesce(g.currency, p.currency, 'HTG')
from public.savings_goals g
left join public.user_preferences p on p.user_id = g.user_id
where c.goal_id = g.id and c.currency is null;
update public.savings_contributions set currency = 'HTG' where currency is null;
alter table public.savings_contributions alter column currency set default 'HTG';
alter table public.savings_contributions alter column currency set not null;

-- Row Level Security ----------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['categories','tasks','transactions','budgets','payments','savings_goals','savings_contributions','debts','debt_payments','calendar_events','notifications']
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
  foreach t in array array['tasks','transactions','budgets','payments','savings_goals','savings_contributions','categories','debts','debt_payments','calendar_events','notifications']
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
