-- 10-day free trial support.
--
-- A trial is modelled entirely with the existing gyms
-- columns — no new columns, no new tables:
--   plan                = 'trial'
--   subscription_end_date = trial end (server now() + 10 days)
--   created_at          = signup time
--
-- This migration adds the database-level pieces the
-- public signup flow needs:
--   * create_trial_gym() — creates the gym and links the
--     owner profile, computing the trial end with SQL
--     now() so no client clock is ever trusted.
--   * gym_access_ok()    — the authoritative trial gate
--     used by the RLS policies below.
--   * a partial unique index on owner_contact so one
--     mobile number can only belong to one gym.

begin;

-- A mobile number may only belong to one gym, so a
-- public signup can never register an already-used
-- owner mobile. Rows without a contact ('') are
-- excluded so seeded data is unaffected.
create unique index if not exists gyms_owner_contact_uidx
  on public.gyms (owner_contact)
  where owner_contact <> '';

-- Authoritative, server-side trial gate. Returns false
-- only for a trial gym whose trial end has passed.
-- Paid plans and live trials always return true, so
-- existing behaviour is unchanged — no existing gym,
-- user or demo account is affected.
create or replace function public.gym_access_ok(p_gym_id uuid)
returns boolean
language sql
stable
security invoker
as $$
  select not exists (
    select 1
    from public.gyms g
    where g.id = p_gym_id
      and g.plan = 'trial'
      and g.subscription_end_date <= now()
  )
$$;

-- Creates a new gym on a 10-day free trial and links
-- the owner's profile to it. Called by the
-- gym-owner-signup Edge Function (service role). The
-- trial end is computed here, in SQL, from the server
-- clock — never from the browser.
create or replace function public.create_trial_gym(
  p_name text,
  p_owner_name text,
  p_owner_email text,
  p_owner_contact text,
  p_owner_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gym_id uuid;
begin
  insert into public.gyms (
    name, plan, status, owner_name, owner_email,
    owner_contact, member_count, subscription_end_date
  )
  values (
    p_name, 'trial', 'active', p_owner_name, p_owner_email,
    p_owner_contact, 0, now() + interval '10 days'
  )
  returning id into v_gym_id;

  update public.profiles
  set gym_id = v_gym_id,
      gym_name = p_name,
      name = p_owner_name,
      email = p_owner_email
  where id = p_owner_id;

  return v_gym_id;
end;
$$;

-- Re-issue the gym-owner policies with the trial gate.
-- The gyms table itself stays readable (the owner
-- needs their gym row to see the upgrade screen);
-- the operational tables are gated so an expired
-- trial loses data access at the database level.

drop policy if exists "gym_owners manage own members" on public.members;
create policy "gym_owners manage own members"
  on public.members for all to authenticated
  using (gym_id = public.auth_gym_id() and public.gym_access_ok(public.auth_gym_id()))
  with check (gym_id = public.auth_gym_id() and public.gym_access_ok(public.auth_gym_id()));

drop policy if exists "gym_owners manage own receipts" on public.receipts;
create policy "gym_owners manage own receipts"
  on public.receipts for all to authenticated
  using (gym_id = public.auth_gym_id() and public.gym_access_ok(public.auth_gym_id()))
  with check (gym_id = public.auth_gym_id() and public.gym_access_ok(public.auth_gym_id()));

drop policy if exists "gym_owners manage own receipt template" on public.receipt_templates;
create policy "gym_owners manage own receipt template"
  on public.receipt_templates for all to authenticated
  using (gym_id = public.auth_gym_id() and public.gym_access_ok(public.auth_gym_id()))
  with check (gym_id = public.auth_gym_id() and public.gym_access_ok(public.auth_gym_id()));

drop policy if exists "gym_owners manage own counter" on public.receipt_counters;
create policy "gym_owners manage own counter"
  on public.receipt_counters for all to authenticated
  using (gym_id = public.auth_gym_id() and public.gym_access_ok(public.auth_gym_id()))
  with check (gym_id = public.auth_gym_id() and public.gym_access_ok(public.auth_gym_id()));

drop policy if exists "gym_owners manage own ledger counter" on public.receipt_ledger_counters;
create policy "gym_owners manage own ledger counter"
  on public.receipt_ledger_counters for all to authenticated
  using (gym_id = public.auth_gym_id() and public.gym_access_ok(public.auth_gym_id()))
  with check (gym_id = public.auth_gym_id() and public.gym_access_ok(public.auth_gym_id()));

commit;
