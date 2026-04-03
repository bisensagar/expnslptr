-- =============================================
-- expnspltr — Supabase Schema
-- Paste this entire file into:
-- Supabase Dashboard → SQL Editor → New Query → Run
-- =============================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ══════════════════════════════════════════════
-- 1. TABLES  (create all before any policies)
-- ══════════════════════════════════════════════

create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  name       text not null,
  email      text not null unique,
  is_admin   boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.trips (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  description text,
  created_by  uuid references public.profiles(id) on delete set null,
  settled     boolean not null default false,
  created_at  timestamptz not null default now()
);

create table if not exists public.trip_members (
  id        uuid primary key default uuid_generate_v4(),
  trip_id   uuid not null references public.trips(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (trip_id, user_id)
);

create table if not exists public.expenses (
  id          uuid primary key default uuid_generate_v4(),
  trip_id     uuid not null references public.trips(id) on delete cascade,
  paid_by     uuid not null references public.profiles(id) on delete restrict,
  description text not null,
  amount      numeric(12,2) not null check (amount > 0),
  created_at  timestamptz not null default now()
);

create table if not exists public.expense_splits (
  id         uuid primary key default uuid_generate_v4(),
  expense_id uuid not null references public.expenses(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  amount     numeric(12,2) not null check (amount > 0)
);

-- ══════════════════════════════════════════════
-- 2. ROW LEVEL SECURITY
-- ══════════════════════════════════════════════

alter table public.profiles       enable row level security;
alter table public.trips          enable row level security;
alter table public.trip_members   enable row level security;
alter table public.expenses       enable row level security;
alter table public.expense_splits enable row level security;

-- ══════════════════════════════════════════════
-- 3. HELPER: is the current user an admin?
-- ══════════════════════════════════════════════

create or replace function public.is_admin()
returns boolean language sql security definer stable as $$
  select coalesce(
    (select is_admin from public.profiles where id = auth.uid()),
    false
  )
$$;

-- ══════════════════════════════════════════════
-- 4. POLICIES
-- All tables exist now — no forward-reference errors
-- ══════════════════════════════════════════════

-- profiles: own row read/update, admin reads all, admin can insert/upsert
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id or public.is_admin());

create policy "profiles_insert_admin"
  on public.profiles for insert
  with check (public.is_admin() or auth.uid() = id);

create policy "profiles_update_own_or_admin"
  on public.profiles for update
  using (auth.uid() = id or public.is_admin());

-- trips: admin full CRUD, members read only
create policy "trips_all_admin"
  on public.trips for all
  using (public.is_admin());

create policy "trips_select_member"
  on public.trips for select
  using (
    exists (
      select 1 from public.trip_members tm
      where tm.trip_id = trips.id
        and tm.user_id = auth.uid()
    )
  );

-- trip_members: admin full CRUD, members read their own trips
create policy "trip_members_all_admin"
  on public.trip_members for all
  using (public.is_admin());

create policy "trip_members_select_member"
  on public.trip_members for select
  using (
    exists (
      select 1 from public.trip_members tm
      where tm.trip_id = trip_members.trip_id
        and tm.user_id = auth.uid()
    )
  );

-- expenses: admin full CRUD, members read
create policy "expenses_all_admin"
  on public.expenses for all
  using (public.is_admin());

create policy "expenses_select_member"
  on public.expenses for select
  using (
    exists (
      select 1 from public.trip_members tm
      where tm.trip_id = expenses.trip_id
        and tm.user_id = auth.uid()
    )
  );

-- expense_splits: admin full CRUD, members read
create policy "expense_splits_all_admin"
  on public.expense_splits for all
  using (public.is_admin());

create policy "expense_splits_select_member"
  on public.expense_splits for select
  using (
    exists (
      select 1 from public.expenses e
      join public.trip_members tm on tm.trip_id = e.trip_id
      where e.id = expense_splits.expense_id
        and tm.user_id = auth.uid()
    )
  );

-- ══════════════════════════════════════════════
-- 5. TRIGGER: auto-create profile on auth signup
-- ══════════════════════════════════════════════

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  insert into public.profiles (id, name, email, is_admin)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    coalesce((new.raw_user_meta_data->>'is_admin')::boolean, false)
  )
  on conflict (id) do update
    set name  = excluded.name,
        email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
