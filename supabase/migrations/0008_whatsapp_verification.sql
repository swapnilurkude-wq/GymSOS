-- Gym Owner WhatsApp verification (Stage 5).
--
-- Additive changes to the 0005 tables (new
-- columns, a new constraint, one RPC) — no
-- existing column, table or policy changes.

begin;

-- Verification code state for the owner's
-- WhatsApp number. The code itself is never
-- stored — only its SHA-256 hash (computed
-- inside the whatsapp-owner-verify Edge
-- Function, which holds the WebCrypto).
-- A new number resets is_verified (handled
-- by save_owner_whatsapp_settings below).

alter table public.gym_owner_whatsapp
  add column verification_code_hash text,
  add column verification_code_sent_at timestamptz,
  add column verification_code_attempts integer not null default 0;

-- WhatsApp numbers are digits only (country
-- code included, e.g. 919820000000). Empty
-- means "not provided".

alter table public.gym_owner_whatsapp
  add constraint gym_owner_whatsapp_number_format
  check (
    whatsapp_number = ''
    or whatsapp_number ~ '^[0-9]{10,15}$'
  );

alter table public.member_whatsapp_optins
  add constraint member_whatsapp_optins_number_format
  check (
    whatsapp_number = ''
    or whatsapp_number ~ '^[0-9]{10,15}$'
  );

-- Saves the signed-in gym owner's WhatsApp
-- settings. SECURITY INVOKER + the existing
-- "users manage own whatsapp settings" RLS
-- policy keeps a owner on their own row.
--
-- Changing the number resets verification —
-- a new number must be re-verified with a
-- fresh code before messaging can target it.

create or replace function public.save_owner_whatsapp_settings(
  p_whatsapp_number text,
  p_fitness_daily boolean,
  p_membership_expiry boolean,
  p_service_reminders boolean,
  p_preferred_time time,
  p_timezone text
)
returns void
language plpgsql
security invoker
as $$
begin
  insert into public.gym_owner_whatsapp (
    user_id, whatsapp_number,
    fitness_daily, membership_expiry,
    service_reminders, preferred_time, timezone
  )
  values (
    auth.uid(), p_whatsapp_number,
    p_fitness_daily, p_membership_expiry,
    p_service_reminders, p_preferred_time, p_timezone
  )
  on conflict (user_id) do update
  set whatsapp_number = excluded.whatsapp_number,
      is_verified = case
        when gym_owner_whatsapp.whatsapp_number
             = excluded.whatsapp_number
        then gym_owner_whatsapp.is_verified
        else false
      end,
      verified_at = case
        when gym_owner_whatsapp.whatsapp_number
             = excluded.whatsapp_number
        then gym_owner_whatsapp.verified_at
        else null
      end,
      fitness_daily = excluded.fitness_daily,
      membership_expiry = excluded.membership_expiry,
      service_reminders = excluded.service_reminders,
      preferred_time = excluded.preferred_time,
      timezone = excluded.timezone,
      updated_at = now();
end;
$$;

commit;
