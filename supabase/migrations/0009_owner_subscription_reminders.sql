-- Owner subscription-expiry reminders (Stage 6).
--
-- The ENQUEUER for the 7 / 3 / 0-day renewal
-- reminders. Purely additive: one new SQL
-- function, built on the 0005 enqueue_message
-- helper (which is idempotent on the
-- idempotency key).
--
-- The reminder offsets MUST stay in sync with
-- _shared/whatsapp/reminders.ts (the TS
-- contract module).

begin;

-- Enqueues the owner subscription-expiry
-- reminders that are due:
--
--   * gyms whose subscription ends within the
--     7-day horizon,
--   * whose owner has a verified number with
--     service reminders switched on,
--   * for each offset (7, 3, 0 days) whose
--     send time has arrived or falls within
--     the lookahead window (the scheduler runs
--     every 15 minutes, so a 60-minute
--     lookahead never misses a slot)
--
-- Each reminder sends on the local calendar
-- day `offset` days before the end date, at
-- the owner's preferred time. The idempotency
-- key embeds the end date, so a renewed
-- subscription produces fresh keys (stale
-- reminders are cancelled by the gyms-update
-- trigger from migration 0005).
--
-- Returns the number of NEWLY queued messages.

create or replace function public.enqueue_owner_subscription_reminders(
  p_lookahead_minutes integer default 60
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  v_id uuid;
  v_gym record;
  v_offset integer;
  v_send_day date;
  v_scheduled_for timestamptz;
  v_key text;
begin
  for v_gym in
    select
      g.id as gym_id,
      g.name as gym_name,
      g.subscription_end_date,
      o.id as owner_user_id,
      ow.whatsapp_number,
      coalesce(ow.timezone, 'Asia/Kolkata') as timezone,
      coalesce(ow.preferred_time, '09:00:00') as preferred_time
    from public.gyms g
    join public.profiles o
      on o.gym_id = g.id and o.role = 'gym-owner'
    join public.gym_owner_whatsapp ow
      on ow.user_id = o.id
    where g.subscription_end_date is not null
      and g.subscription_end_date > now()
      and g.subscription_end_date <= now() + interval '7 days'
      and ow.is_verified
      and ow.service_reminders
      and ow.whatsapp_number <> ''
  loop
    -- Offsets: keep in sync with
    -- OWNER_REMINDER_OFFSETS in
    -- _shared/whatsapp/reminders.ts.
    foreach v_offset in array array[7, 3, 0]
    loop
      -- The local calendar day `offset` days
      -- before the end date…
      v_send_day := (
        date_trunc(
          'day',
          v_gym.subscription_end_date at time zone v_gym.timezone
        )
        - v_offset * interval '1 day'
      )::date

      -- …at the owner's preferred time.
      v_scheduled_for := (
        v_send_day::text || ' ' || v_gym.preferred_time
      )::timestamp at time zone v_gym.timezone

      -- Skip send times beyond the lookahead —
      -- a later scheduler run will pick them up.
      continue when v_scheduled_for >
        now() + (p_lookahead_minutes || ' minutes')::interval

      v_key := format(
        'owner-reminder:%s:%s:%s',
        v_gym.gym_id,
        v_offset,
        to_char(v_gym.subscription_end_date, 'YYYY-MM-DD')
      )

      v_id := public.enqueue_message(
        p_idempotency_key := v_key,
        p_gym_id := v_gym.gym_id,
        p_owner_user_id := v_gym.owner_user_id,
        p_recipient_phone := v_gym.whatsapp_number,
        p_category := 'owner_subscription_expiry',
        p_template_name := 'gym_sos_subscription_expiry',
        p_template_params := jsonb_build_object(
          '1', v_gym.gym_name,
          '2', to_char(
            v_gym.subscription_end_date at time zone v_gym.timezone,
            'DD Mon YYYY'
          ),
          '3', case v_offset
                 when 0 then 'today'
                 else format('%s days', v_offset)
               end
        ),
        p_scheduled_for := v_scheduled_for
      )

      if v_id is not null then
        v_count := v_count + 1
      end if
    end loop
  end loop

  return v_count
end;
$$;

commit;
