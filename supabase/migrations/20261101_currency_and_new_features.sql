-- Existing DANY HUB databases: run this once in Supabase SQL Editor.
-- It preserves existing rows and backfills missing currency values from each user's preference.

begin;

create extension if not exists "pgcrypto";

alter table public.transactions add column if not exists currency text;
update public.transactions t
set currency = coalesce(p.currency, 'HTG')
from public.user_preferences p
where t.user_id = p.user_id and t.currency is null;
update public.transactions set currency = 'HTG' where currency is null;
alter table public.transactions alter column currency set default 'HTG';
alter table public.transactions alter column currency set not null;

alter table public.budgets add column if not exists currency text;
update public.budgets b
set currency = coalesce(p.currency, 'HTG')
from public.user_preferences p
where b.user_id = p.user_id and b.currency is null;
update public.budgets set currency = 'HTG' where currency is null;
alter table public.budgets alter column currency set default 'HTG';
alter table public.budgets alter column currency set not null;

alter table public.payments add column if not exists currency text;
update public.payments p
set currency = coalesce(prefs.currency, 'HTG')
from public.user_preferences prefs
where p.user_id = prefs.user_id and p.currency is null;
update public.payments set currency = 'HTG' where currency is null;
alter table public.payments alter column currency set default 'HTG';
alter table public.payments alter column currency set not null;

alter table public.savings_goals add column if not exists currency text;
update public.savings_goals g
set currency = coalesce(p.currency, 'HTG')
from public.user_preferences p
where g.user_id = p.user_id and g.currency is null;
update public.savings_goals set currency = 'HTG' where currency is null;
alter table public.savings_goals alter column currency set default 'HTG';
alter table public.savings_goals alter column currency set not null;

alter table public.savings_contributions add column if not exists currency text;
update public.savings_contributions c
set currency = coalesce(g.currency, p.currency, 'HTG')
from public.savings_goals g
left join public.user_preferences p on p.user_id = g.user_id
where c.goal_id = g.id and c.currency is null;
update public.savings_contributions set currency = 'HTG' where currency is null;
alter table public.savings_contributions alter column currency set default 'HTG';
alter table public.savings_contributions alter column currency set not null;

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

do $$
declare t text;
begin
  foreach t in array array['debts','debt_payments','calendar_events','notifications']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format('create policy "own rows" on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
  end loop;
end $$;

do $$
declare t text;
begin
  foreach t in array array['debts','debt_payments','calendar_events','notifications']
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

notify pgrst, 'reload schema';
commit;
