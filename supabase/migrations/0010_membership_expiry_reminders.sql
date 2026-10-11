-- Member membership-expiry reminders (Stage 7).
--
-- The ENQUEUER for member expiry
-- reminders. Purely additive: one new
-- SQL function, built on the 0005
-- enqueue_message helper (idempotent on
-- the idempotency key).
--
-- The reminder offsets MUST stay in sync
-- with _shared/whatsapp/reminders.ts.
--
-- The eligibility engine re-checks ALL of
-- these conditions immediately before
-- delivery — this query is only a
-- pre-filter that decides what MAY be
-- queued.

begin;

-- Enqueues membership-expiry reminders
-- that are due:
--
--   * members whose membership ends
--     within the 7-day window (still
--     valid — an already-expired
--     membership gets no reminder),
--   * whose gym is active and whose
--     owner's GymSOS subscription is
--     active (an expired owner
--     subscription blocks every member
--     message),
--   * whose owner enabled membership
--     expiry reminders for the gym and
--     has not paused messaging,
--   * who opted in to membership expiry
--     reminders with a WhatsApp number
--     on file and no unsubscribe,
--   * for each offset (7, 3, 0 days)
--     whose send time has arrived or
--     falls within the lookahead window
--
-- Each reminder sends on the local
-- calendar day `offset` days before the
-- membership end date, at the member's
-- preferred time. The idempotency key
-- embeds the end date, so a renewed
-- membership produces fresh keys, and
-- repeated enqueuer runs never duplicate
-- a reminder.
--
-- Returns the number of NEWLY queued
-- messages.

create or replace function public.enqueue_membership_expiry_reminders(
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
  v_member record;
  v_offset integer;
  v_send_day date;
  v_scheduled_for timestamptz;
  v_key text;
begin
  for v_member in
    select
      m.id as member_id,
      m.gym_id,
      m.name as member_name,
      m.end_date,
      opt.whatsapp_number,
      coalesce(opt.timezone, 'Asia/Kolkata') as timezone,
      coalesce(opt.preferred_time, '09:00:00') as preferred_time
    from public.members m
    join public.member_whatsapp_optins opt
      on opt.member_id = m.id
    join public.gyms g
      on g.id = m.gym_id
    join public.gym_messaging_settings ms
      on ms.gym_id = m.gym_id
    where m.end_date is not null
      and m.end_date > now()
      and m.end_date <= now() + interval '7 days'
      and g.status = 'active'
      and g.subscription_end_date > now()
      and ms.membership_expiry_reminders
      and not ms.paused
      and opt.opted_in
      and opt.membership_expiry
      and opt.opted_out_at is null
      and opt.whatsapp_number <> ''
  loop
    -- Offsets: keep in sync with
    -- MEMBER_REMINDER_OFFSETS in
    -- _shared/whatsapp/reminders.ts.
    foreach v_offset in array array[7, 3, 0]
    loop
      -- The local calendar day `offset`
      -- days before the end date…
      v_send_day := (
        date_trunc(
          'day',
          v_member.end_date at time zone v_member.timezone
        )
        - v_offset * interval '1 day'
      )::date

      -- …at the member's preferred time.
      v_scheduled_for := (
        v_send_day::text || ' ' || v_member.preferred_time
      )::timestamp at time zone v_member.timezone

      -- Skip send times beyond the
      -- lookahead — a later scheduler run
      -- will pick them up.
      continue when v_scheduled_for >
        now() + (p_lookahead_minutes || ' minutes')::interval

      v_key := format(
        'membership-reminder:%s:%s:%s',
        v_member.member_id,
        v_offset,
        to_char(v_member.end_date, 'YYYY-MM-DD')
      )

      v_id := public.enqueue_message(
        p_idempotency_key := v_key,
        p_gym_id := v_member.gym_id,
        p_member_id := v_member.member_id,
        p_recipient_phone := v_member.whatsapp_number,
        p_category := 'membership_expiry',
        p_template_name := 'gym_sos_membership_expiry',
        p_template_params := jsonb_build_object(
          '1', v_member.member_name,
          '2', to_char(
            v_member.end_date at time zone v_member.timezone,
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
