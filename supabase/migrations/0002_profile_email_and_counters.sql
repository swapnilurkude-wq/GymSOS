-- Phase 2 additions: profile email syncing + atomic receipt counters.

begin;

-- Profiles carry a denormalized email so the app can look accounts up
-- by email (auth.users is not exposed through the REST API).
alter table public.profiles add column if not exists email text;

create unique index if not exists profiles_email_idx
  on public.profiles (email);

-- Auto-provisions a profile row when a user signs up and keeps the
-- email in sync when it changes. Runs as the table owner (security
-- definer) so it bypasses RLS — a brand-new user has no profile row
-- yet, so no policy could otherwise permit the insert.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, role)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      ''
    ),
    'gym-owner'
  )
  on conflict (id) do update
    set email = excluded.email,
        name = coalesce(nullif(excluded.name, ''), public.profiles.name);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
  after update on auth.users
  for each row execute function public.handle_new_user();

-- Atomic receipt-number counters. The upsert takes a row lock on the
-- gym's counter, so two members/receipts created at the same moment
-- can never be issued the same number.
create or replace function public.bump_receipt_counter(p_gym_id uuid)
returns integer
language plpgsql
as $$
declare
  v_last integer;
begin
  insert into public.receipt_counters (gym_id, last_number)
  values (p_gym_id, 1)
  on conflict (gym_id) do update
    set last_number = receipt_counters.last_number + 1
  returning last_number into v_last;
  return v_last;
end;
$$;

create or replace function public.bump_receipt_ledger_counter(p_gym_id uuid)
returns integer
language plpgsql
as $$
declare
  v_last integer;
begin
  insert into public.receipt_ledger_counters (gym_id, last_number)
  values (p_gym_id, 1)
  on conflict (gym_id) do update
    set last_number = receipt_ledger_counters.last_number + 1
  returning last_number into v_last;
  return v_last;
end;
$$;

commit;
