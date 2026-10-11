-- Member fitness profiles + trainer-approved
-- workout plans (Stage 8, part 1).
--
-- PURELY ADDITIVE: new tables, a replaced
-- eligibility function (same behaviour for
-- every existing category, two new checks
-- for fitness_daily) and one new enqueuer.
-- No existing table, column, policy or
-- trigger is modified.
--
-- Daily fitness messages exist only when
-- BOTH of these are true for a member:
--   1. a fitness profile exists, and
--   2. a trainer-approved workout plan
--      exists (approved, not archived)
-- The gate is enforced at ENQUEUE time
-- (the pre-filter below) and again at
-- SEND time (message_eligibility_check,
-- mirrored in the TypeScript engine).

begin;

-- ── Member fitness profile ─────────────────────────
-- One row per member. Holds goals and level
-- only — never health data, never photos.

create table public.fitness_profiles (
  member_id uuid primary key
             references public.members (id) on delete cascade,
  goal       text not null default '',
  level      text not null default 'beginner'
             check (level in ('beginner', 'intermediate', 'advanced')),
  notes      text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Workout plans ───────────────────────────────────
-- A member may have several plans over time,
-- but at most one APPROVED, non-archived plan
-- is active (the app archives the previous
-- plan when a new one is approved). The daily
-- fitness message is gated on an active
-- approved plan.

create table public.workout_plans (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null
              references public.members (id) on delete cascade,
  name        text not null,
  description text not null default '',
  exercises   jsonb not null default '[]'::jsonb,
  trainer_name text not null default '',
  approved    boolean not null default false,
  approved_at timestamptz,
  archived    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index workout_plans_member_idx
  on public.workout_plans (member_id);

-- ── Rotating daily fitness tips ─────────────────────
-- Platform-owned, generic content (no member
-- data). The enqueuer picks the tip of the day
-- by the member's local day-of-year.

create table public.fitness_tips (
  day_index integer primary key
            check (day_index between 0 and 29),
  tip       text not null
);

insert into public.fitness_tips (day_index, tip) values
  (0,  'Warm up for 5-10 minutes before every workout to prepare your muscles.'),
  (1,  'Drink water through the day — don''t wait until you are thirsty.'),
  (2,  'Consistency beats intensity: a short daily workout you actually do wins.'),
  (3,  'Aim for 7-9 hours of sleep; recovery happens while you rest.'),
  (4,  'Stretch after your workout while your muscles are still warm.'),
  (5,  'Set one small goal this week and track it every day.'),
  (6,  'Include both strength and cardio in your weekly routine.'),
  (7,  'Take the stairs when you can — small habits add up.'),
  (8,  'Rest days are part of the program, not a break from it.'),
  (9,  'Record your workouts; progress you can see keeps you going.'),
  (10, 'Include protein in your post-workout meal.'),
  (11, 'Good form beats heavy weight every time.'),
  (12, 'A 20-minute walk counts as movement — take one today.'),
  (13, 'Plan your workout like an appointment in your day.'),
  (14, 'Breathe steadily during exercises; don''t hold your breath.'),
  (15, 'Vary your routine every few weeks to keep improving.'),
  (16, 'Warm up your joints with gentle mobility before lifting.'),
  (17, 'Cool down for 5 minutes to lower your heart rate gradually.'),
  (18, 'Set a bedtime reminder to protect your recovery window.'),
  (19, 'Find a workout partner — accountability doubles success.'),
  (20, 'Start with bodyweight exercises before adding resistance.'),
  (21, 'Track your resting heart rate as a simple fitness marker.'),
  (22, 'Fill half your plate with vegetables at lunch and dinner.'),
  (23, 'Skip sugary drinks — water is the best hydration.'),
  (24, 'Ten minutes of stretching in the morning wakes your body up.'),
  (25, 'Celebrate small wins — every completed workout matters.'),
  (26, 'Missed a day? Just resume tomorrow — no guilt needed.'),
  (27, 'Strong muscles protect your joints for years to come.'),
  (28, 'A brisk 10-minute walk after meals aids digestion.'),
  (29, 'Check in with your trainer this week about your progress.');

-- ── Central eligibility check (updated) ─────────────
-- Same body as migration 0005, plus the two
-- fitness_daily gates. The TypeScript engine
-- in _shared/whatsapp/eligibility.ts is the
-- authoritative mirror — keep the two in sync
-- (same reason codes, same order).

create or replace function public.message_eligibility_check(p_message_id uuid)
returns table (ok boolean, reason text, is_deferrable boolean)
language plpgsql
stable
security invoker
as $$
declare
  m              public.message_outbox;
  v_gym          public.gyms;
  v_provider     public.whatsapp_provider_config;
  v_controls     public.platform_messaging_controls;
  v_gym_settings public.gym_messaging_settings;
  v_owner_wa     public.gym_owner_whatsapp;
  v_optin        public.member_whatsapp_optins;
  v_owner        public.profiles;
  v_local_time   time;
  v_sent_today   integer;
  v_member_end   timestamptz;
begin
  ok := false;
  reason := '';
  is_deferrable := false;

  select * into m from public.message_outbox o where o.id = p_message_id;
  if not found then
    reason := 'message_not_found';
    return next;
    return;
  end if;

  -- Never re-send a handled message (idempotency).
  if m.status in ('sent', 'delivered') then
    reason := 'already_' || m.status;
    return next;
    return;
  end if;
  if m.status = 'cancelled' then
    reason := 'message_cancelled';
    return next;
    return;
  end if;
  if m.status = 'suppressed' then
    reason := 'previously_suppressed';
    return next;
    return;
  end if;

  -- Provider must be configured and activated.
  select * into v_provider from public.whatsapp_provider_config c limit 1;
  if v_provider is null or not v_provider.is_configured then
    reason := 'provider_not_configured';
    is_deferrable := true;
    return next;
    return;
  end if;
  if not v_provider.is_active then
    reason := 'provider_not_active';
    is_deferrable := true;
    return next;
    return;
  end if;

  select * into v_controls from public.platform_messaging_controls c limit 1;
  if v_controls is not null and v_controls.global_paused then
    reason := 'messaging_paused_globally';
    is_deferrable := true;
    return next;
    return;
  end if;

  -- Business-hours window (platform timezone).
  if v_controls is not null then
    v_local_time := (now() at time zone v_controls.timezone)::time;
    if v_local_time < v_controls.business_hours_start
       or v_local_time > v_controls.business_hours_end then
      reason := 'outside_business_hours';
      is_deferrable := true;
      return next;
      return;
    end if;
  end if;

  -- Daily send cap.
  if v_controls is not null then
    select count(*) into v_sent_today
    from public.message_outbox o
    where o.sent_at is not null
      and o.status in ('sent', 'delivered')
      and o.sent_at >= (date_trunc('day', (now() at time zone v_controls.timezone))
                        at time zone v_controls.timezone);
    if v_sent_today >= v_controls.daily_send_cap then
      reason := 'daily_send_cap_reached';
      is_deferrable := true;
      return next;
      return;
    end if;
  end if;

  -- ── Test messages: only to the configured test recipient ──
  if m.category = 'test' then
    if v_provider.test_recipient_phone = '' then
      reason := 'test_recipient_not_configured';
      return next;
      return;
    end if;
    if m.recipient_phone <> v_provider.test_recipient_phone then
      reason := 'test_recipient_mismatch';
      return next;
      return;
    end if;
    if m.owner_user_id is null then
      reason := 'test_missing_tester';
      return next;
      return;
    end if;
    ok := true;
    return next;
    return;
  end if;

  -- ── OWNER PATH: the owner's own subscription-expiry
  --    reminders. Deliberately does NOT require an
  --    active subscription — expiry is the trigger. ──
  if m.category = 'owner_subscription_expiry' then
    if m.member_id is not null then
      reason := 'owner_message_has_member_target';
      return next;
      return;
    end if;
    if m.owner_user_id is null then
      reason := 'owner_reminder_missing_owner';
      return next;
      return;
    end if;
    select * into v_owner from public.profiles p where p.id = m.owner_user_id;
    if v_owner is null or v_owner.role <> 'gym-owner' then
      reason := 'owner_profile_invalid';
      return next;
      return;
    end if;
    select * into v_owner_wa from public.gym_owner_whatsapp w
      where w.user_id = m.owner_user_id;
    if v_owner_wa is null or not v_owner_wa.is_verified then
      reason := 'owner_number_unverified';
      return next;
      return;
    end if;
    if not v_owner_wa.service_reminders then
      reason := 'owner_service_reminders_disabled';
      return next;
      return;
    end if;
    if v_owner_wa.whatsapp_number = '' then
      reason := 'owner_number_missing';
      return next;
      return;
    end if;
    if m.recipient_phone <> v_owner_wa.whatsapp_number then
      reason := 'recipient_mismatch';
      return next;
      return;
    end if;
    select * into v_gym from public.gyms g where g.id = m.gym_id;
    if v_gym is null then
      reason := 'gym_not_found';
      return next;
      return;
    end if;
    -- An expired subscription does NOT suppress the
    -- owner's own reminders — renewing an expired
    -- subscription is exactly what they nudge
    -- about. A renewed subscription (end date
    -- pushed beyond the window) suppresses stale
    -- reminders at send time.
    if v_gym.subscription_end_date > now() + interval '7 days' then
      reason := 'subscription_renewed_or_not_due';
      return next;
      return;
    end if;

    ok := true;
    return next;
    return;
  end if;

  -- ── MEMBER PATH (strict) ────────────────────────────
  if m.member_id is null or m.owner_user_id is not null then
    reason := 'member_message_missing_member';
    return next;
    return;
  end if;

  select * into v_gym from public.gyms g where g.id = m.gym_id;
  if v_gym is null then
    reason := 'gym_not_found';
    return next;
    return;
  end if;
  if v_gym.status <> 'active' then
    reason := 'gym_status_' || v_gym.status;
    return next;
    return;
  end if;
  if not public.gym_subscription_active(v_gym.id) then
    reason := 'owner_subscription_inactive';
    return next;
    return;
  end if;

  -- The member must belong to this gym.
  if not exists (
    select 1 from public.members mem
    where mem.id = m.member_id and mem.gym_id = m.gym_id
  ) then
    reason := 'member_not_in_gym';
    return next;
    return;
  end if;

  -- Owner's per-gym messaging toggles.
  select * into v_gym_settings from public.gym_messaging_settings s
    where s.gym_id = m.gym_id;
  if v_gym_settings is null then
    reason := 'gym_messaging_not_configured';
    return next;
    return;
  end if;
  if v_gym_settings.paused then
    reason := 'gym_messaging_paused';
    return next;
    return;
  end if;
  if m.category = 'membership_expiry'
     and not v_gym_settings.membership_expiry_reminders then
    reason := 'membership_reminders_disabled_by_owner';
    return next;
    return;
  end if;
  if m.category = 'fitness_daily'
     and not v_gym_settings.daily_fitness_messages then
    reason := 'fitness_messages_disabled_by_owner';
    return next;
    return;
  end if;

  -- Member opt-in state. An explicit unsubscribe is
  -- reported precisely; a never-opted-in member is
  -- simply not opted in.
  select * into v_optin from public.member_whatsapp_optins o
    where o.member_id = m.member_id;
  if v_optin.opted_out_at is not null then
    reason := 'member_unsubscribed';
    return next;
    return;
  end if;
  if v_optin is null or not v_optin.opted_in then
    reason := 'member_not_opted_in';
    return next;
    return;
  end if;
  if v_optin.whatsapp_number = '' then
    reason := 'member_number_missing';
    return next;
    return;
  end if;
  if m.recipient_phone <> v_optin.whatsapp_number then
    reason := 'recipient_mismatch';
    return next;
    return;
  end if;
  if m.category = 'membership_expiry' and not v_optin.membership_expiry then
    reason := 'member_membership_reminders_disabled';
    return next;
    return;
  end if;
  if m.category = 'fitness_daily' and not v_optin.fitness_daily then
    reason := 'member_fitness_messages_disabled';
    return next;
    return;
  end if;

  -- Daily fitness messages exist only once the
  -- member has a fitness profile AND a
  -- trainer-approved workout plan. The enqueuer
  -- pre-filters on the same conditions; this is
  -- the send-time re-check.
  if m.category = 'fitness_daily' then
    if not exists (
      select 1 from public.fitness_profiles fp
      where fp.member_id = m.member_id
    ) then
      reason := 'fitness_profile_missing';
      return next;
      return;
    end if;
    if not exists (
      select 1 from public.workout_plans wp
      where wp.member_id = m.member_id
        and wp.approved
        and not wp.archived
    ) then
      reason := 'fitness_plan_not_approved';
      return next;
      return;
    end if;
  end if;

  -- Membership-expiry reminders only make sense for a
  -- membership that is still valid but inside the window.
  if m.category = 'membership_expiry' then
    select mem.end_date into v_member_end
    from public.members mem where mem.id = m.member_id;
    if v_member_end is null or v_member_end <= now() then
      reason := 'membership_already_expired';
      return next;
      return;
    end if;
    if v_member_end > now() + interval '7 days' then
      reason := 'membership_renewed_or_not_due';
      return next;
      return;
    end if;
  end if;

  ok := true;
  return next;
end;
$$;

-- ── Daily fitness message enqueuer ──────────────────
-- One message per member per LOCAL day: the
-- platform tip of the day (30 rotating tips,
-- keyed by the member's local day-of-year),
-- sent at the member's preferred time.
--
-- The idempotency key embeds the member and
-- the local date, so repeated runs never
-- duplicate a day's message.
--
-- p_catchup_hours bounds how far past the
-- preferred time a message may still be
-- enqueued: a send time more than that in the
-- past is skipped (the day is gone) — which
-- also stops yesterday's message being
-- delivered alongside today's tomorrow
-- morning. There is no upper bound: messages
-- for later today are enqueued early and wait
-- for their scheduled time.

create or replace function public.enqueue_daily_fitness_messages(
  p_catchup_hours integer default 4
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
  v_tip text;
  v_scheduled_for timestamptz;
  v_key text;
begin
  for v_member in
    select
      m.id as member_id,
      m.gym_id,
      m.name as member_name,
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
    join public.fitness_profiles fp
      on fp.member_id = m.id
    where g.status = 'active'
      and g.subscription_end_date > now()
      and ms.daily_fitness_messages
      and not ms.paused
      and opt.opted_in
      and opt.fitness_daily
      and opt.opted_out_at is null
      and opt.whatsapp_number <> ''
      and exists (
        select 1 from public.workout_plans wp
        where wp.member_id = m.id
          and wp.approved
          and not wp.archived
      )
  loop
    -- Today's tip (30 rotating platform tips,
    -- keyed by the member's local day of
    -- year). No tips table content — nothing
    -- to send today.
    select ft.tip into v_tip
    from public.fitness_tips ft
    where ft.day_index = (
      (extract(doy from (now() at time zone v_member.timezone))::integer - 1) % 30
    );
    continue when v_tip is null;

    -- The local send time: today at the
    -- member's preferred time.
    v_scheduled_for := (
      (now() at time zone v_member.timezone)::date::text
      || ' ' || v_member.preferred_time
    )::timestamp at time zone v_member.timezone;

    -- Skip send times beyond the catch-up
    -- window (see the header comment).
    continue when v_scheduled_for <
      now() - (p_catchup_hours || ' hours')::interval;

    v_key := format(
      'fitness-daily:%s:%s',
      v_member.member_id,
      to_char(now() at time zone v_member.timezone, 'YYYY-MM-DD')
    )

    v_id := public.enqueue_message(
      p_idempotency_key := v_key,
      p_gym_id := v_member.gym_id,
      p_member_id := v_member.member_id,
      p_recipient_phone := v_member.whatsapp_number,
      p_category := 'fitness_daily',
      p_template_name := 'gym_sos_fitness_daily',
      p_template_params := jsonb_build_object(
        '1', v_member.member_name,
        '2', v_tip
      ),
      p_scheduled_for := v_scheduled_for
    )

    if v_id is not null then
      v_count := v_count + 1
    end if
  end loop

  return v_count
end;
$$;

-- ── Row level security ───────────────────────────────

alter table public.fitness_profiles enable row level security;

create policy "gym_owners manage own member fitness profiles"
  on public.fitness_profiles for all to authenticated
  using (exists (
    select 1 from public.members mem
    where mem.id = member_id
      and mem.gym_id = public.auth_gym_id()
      and public.gym_access_ok(public.auth_gym_id())
  ))
  with check (exists (
    select 1 from public.members mem
    where mem.id = member_id
      and mem.gym_id = public.auth_gym_id()
      and public.gym_access_ok(public.auth_gym_id())
  ));

create policy "super_admins manage all fitness profiles"
  on public.fitness_profiles for all to authenticated
  using (public.auth_role() = 'super-admin')
  with check (public.auth_role() = 'super-admin');

alter table public.workout_plans enable row level security;

create policy "gym_owners manage own member workout plans"
  on public.workout_plans for all to authenticated
  using (exists (
    select 1 from public.members mem
    where mem.id = member_id
      and mem.gym_id = public.auth_gym_id()
      and public.gym_access_ok(public.auth_gym_id())
  ))
  with check (exists (
    select 1 from public.members mem
    where mem.id = member_id
      and mem.gym_id = public.auth_gym_id()
      and public.gym_access_ok(public.auth_gym_id())
  ));

create policy "super_admins manage all workout plans"
  on public.workout_plans for all to authenticated
  using (public.auth_role() = 'super-admin')
  with check (public.auth_role() = 'super-admin');

alter table public.fitness_tips enable row level security;

-- Generic platform content: any signed-in user
-- may read the rotating tips; only the platform
-- (migration) writes them.
create policy "authenticated users read fitness tips"
  on public.fitness_tips for select to authenticated
  using (true);

-- ── updated_at maintenance ───────────────────────────

create trigger fitness_profiles_updated_at
  before update on public.fitness_profiles
  for each row execute function public.handle_updated_at();

create trigger workout_plans_updated_at
  before update on public.workout_plans
  for each row execute function public.handle_updated_at();

commit;
