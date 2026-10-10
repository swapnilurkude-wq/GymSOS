-- WhatsApp Super Admin controls (Stage 4).
--
-- PURELY ADDITIVE: two small RPCs that back
-- the Super Admin messaging UI. Both are
-- SECURITY INVOKER, so the existing RLS
-- policies on the target tables decide who
-- may call them:
--   * set_global_messaging_paused — only
--     super-admins (the "super_admins manage
--     messaging controls" policy)
--   * set_gym_messaging_paused — super-admins
--     and the gym's owner (both policies on
--     gym_messaging_settings)
--
-- The client cannot issue an unfiltered
-- UPDATE safely, so the toggles go through
-- these functions instead.

begin;

-- Toggles the platform-wide messaging pause
-- on the singleton controls row.

create or replace function public.set_global_messaging_paused(
  p_paused boolean
)
returns void
language plpgsql
security invoker
as $$
begin
  update public.platform_messaging_controls
  set global_paused = p_paused,
      updated_at = now();
end;
$$;

-- Toggles a single gym's messaging pause.
-- Creates the gym's settings row on first
-- use (category toggles default to off);
-- an existing row keeps its toggles.

create or replace function public.set_gym_messaging_paused(
  p_gym_id uuid,
  p_paused boolean
)
returns void
language plpgsql
security invoker
as $$
begin
  insert into public.gym_messaging_settings (gym_id, paused)
  values (p_gym_id, p_paused)
  on conflict (gym_id) do update
  set paused = excluded.paused,
      updated_at = now();
end;
$$;

commit;
