-- WhatsApp dispatch primitives (Stage 3).
--
-- PURELY ADDITIVE: new functions only, built on the
-- 0005 tables. Nothing existing is modified.
--
-- These give the scheduler (and the manual retry)
-- atomic, race-free control over the message
-- outbox:
--   * claim_due_message()  — atomically claims ONE
--     due message (FOR UPDATE SKIP LOCKED), so
--     overlapping scheduler runs can never
--     double-dispatch the same row
--   * claim_message_by_id()— the same claim for a
--     specific row (used by the immediate retry)
--   * count_messages_sent_today() — the daily-cap
--     counter, computed in the platform timezone
--   * retry_message()      — Super Admin manual
--     retry of a FAILED row (same row, so no
--     duplicate message; eligibility is re-checked
--     at dispatch time)
--   * cancel_stale_messages() — sweeps rows that
--     stayed pending for over 7 days (e.g. the
--     daily cap was always reached) so the queue
--     can never back up indefinitely

begin;

-- Claims the next dispatchable message:
--   * scheduled/pending rows whose time has come, or
--   * failed rows within the retry budget (3
--     attempts) after a 15-minute backoff
-- Ordered by scheduled_for (oldest first).
-- Returns NULL when nothing is claimable.

create or replace function public.claim_due_message(
  p_max_attempts integer default 3
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  with due as (
    select o.id
    from public.message_outbox o
    where
      (o.status in ('scheduled', 'pending')
       and o.scheduled_for <= now())
      or
      (o.status = 'failed'
       and o.attempts < p_max_attempts
       and o.last_attempt_at <= now() - interval '15 minutes')
    order by o.scheduled_for
    for update skip locked
    limit 1
  )
  update public.message_outbox o
  set status = 'sending',
      last_attempt_at = now(),
      attempts = o.attempts + 1,
      updated_at = now()
  from due
  where o.id = due.id
  returning o.id into v_id;

  return v_id;
end;
$$;

-- Claims one specific message by id. Returns true
-- only when the row was claimable (scheduled or
-- pending) — a row another worker already claimed
-- (status = 'sending') returns false.

create or replace function public.claim_message_by_id(
  p_message_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows integer;
begin
  update public.message_outbox
  set status = 'sending',
      last_attempt_at = now(),
      attempts = attempts + 1,
      updated_at = now()
  where id = p_message_id
    and status in ('scheduled', 'pending');

  get diagnostics v_rows = row_count;
  return v_rows > 0;
end;
$$;

-- Messages delivered today, in the platform
-- timezone (the day boundary follows the gym's
-- business hours, not UTC).

create or replace function public.count_messages_sent_today(
  p_timezone text
)
returns integer
language sql
stable
security invoker
as $$
  select count(*)::integer
  from public.message_outbox o
  where o.sent_at is not null
    and o.status in ('sent', 'delivered')
    and o.sent_at >= (
      date_trunc('day', (now() at time zone p_timezone))
        at time zone p_timezone
    )
$$;

-- Super Admin manual retry of a FAILED message.
-- Re-queues the SAME row (same idempotency key,
-- same content) — a retry can never create a
-- duplicate message. Only 'failed' rows qualify;
-- suppressed rows stay suppressed with their
-- recorded reason.

create or replace function public.retry_message(
  p_message_id uuid,
  p_retried_by uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  select status into v_status
  from public.message_outbox
  where id = p_message_id;

  if v_status is distinct from 'failed' then
    return false;
  end if;

  update public.message_outbox
  set status = 'pending',
      status_reason = '',
      attempts = 0,
      updated_at = now()
  where id = p_message_id;

  insert into public.message_events (message_id, event_type, detail)
  values (
    p_message_id,
    'retried',
    jsonb_build_object('retried_by', p_retried_by)
  );

  return true;
end;
$$;

-- Cancels rows that have been pending for more
-- than 7 days (e.g. the daily send cap was
-- permanently reached). Prevents an unbounded
-- backlog of deferrals.

create or replace function public.cancel_stale_messages()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  with stale as (
    update public.message_outbox
    set status = 'cancelled',
        status_reason = 'stale',
        updated_at = now()
    where status in ('scheduled', 'pending')
      and scheduled_for <= now() - interval '7 days'
    returning id
  )
  insert into public.message_events (message_id, event_type, detail)
  select id, 'cancelled', jsonb_build_object('reason', 'stale')
  from stale;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

commit;
