-- WhatsApp messaging infrastructure (Stage 1 of the WhatsApp plan).
--
-- PURELY ADDITIVE: every object here is new — no existing table,
-- column, function, policy or trigger is modified. Existing
-- behaviour (login, payments, receipts, reports, trials, the
-- Super Admin dashboard) is untouched.
--
-- The integration ships DISABLED. Nothing is sent until the
-- Super Admin configures a provider, sends a test message and
-- flips is_active — see whatsapp_provider_config.is_active and
-- platform_messaging_controls.global_paused.
--
-- ── Design ──────────────────────────────────────────────────
--   * Every message is a row in message_outbox. A scheduled
--     job (Stage 3) scans due rows, re-checks eligibility
--     IMMEDIATELY BEFORE DELIVERY, sends, and logs.
--   * message_eligibility_check() is the DB-side mirror of the
--     TypeScript engine in supabase/functions/_shared/whatsapp/
--     (added in Stage 2). The two must stay in sync — the
--     TypeScript engine is the authoritative one; this function
--     exists so eligibility can be queried and audited in SQL.
--   * The owner's own subscription-expiry reminders use a
--     SEPARATE eligibility path: an expired subscription is
--     exactly when those fire, so they must still be deliverable
--     to the owner — while every member-message path requires
--     an active owner subscription.
--   * Transient failures (business hours, daily cap, provider
--     paused) are DEFERRED (retry later); everything else is
--     terminal and the message is suppressed with a reason.
--
-- ── Rollback ────────────────────────────────────────────────
--   Disable: update whatsapp_provider_config set is_active = false;
--   Remove: drop the tables/functions below (they are new, so
--   dropping them cannot affect existing data). Always pg_dump
--   before applying this migration (see README → Rollback).

begin;

-- ── Provider configuration (Super Admin only) ─────────────
-- Singleton: at most one row. The access token and webhook
-- secret are stored ENCRYPTED with pgcrypto — the decryption
-- key lives in Edge Function secrets, never in the app.

create table public.whatsapp_provider_config (
  id                     uuid primary key default gen_random_uuid(),
  provider               text not null default 'meta-cloud-api'
                         check (provider in ('meta-cloud-api', 'gupshup', 'twilio', 'three60dialog')),
  phone_number_id        text not null default '',
  business_account_id    text not null default '',
  encrypted_access_token bytea,
  encrypted_webhook_secret bytea,
  test_recipient_phone   text not null default '',
  is_configured          boolean not null default false,
  is_active              boolean not null default false,
  last_error             text,
  last_tested_at         timestamptz,
  tested_by              uuid references public.profiles (id),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create unique index whatsapp_provider_config_singleton
  on public.whatsapp_provider_config ((true));

-- ── Platform messaging controls (Super Admin only) ─────────

create table public.platform_messaging_controls (
  id                 uuid primary key default gen_random_uuid(),
  global_paused      boolean not null default false,
  daily_send_cap     integer not null default 500,
  business_hours_start time not null default '09:00:00',
  business_hours_end   time not null default '20:00:00',
  timezone           text not null default 'Asia/Kolkata',
  updated_at         timestamptz not null default now()
);

create unique index platform_messaging_controls_singleton
  on public.platform_messaging_controls ((true));

-- Default controls: messaging stays off until a provider
-- is configured and activated (the eligibility check
-- requires whatsapp_provider_config.is_active = true).
insert into public.platform_messaging_controls (
  global_paused, daily_send_cap,
  business_hours_start, business_hours_end, timezone
)
values (false, 500, '09:00:00', '20:00:00', 'Asia/Kolkata');

-- ── Gym Owner WhatsApp settings ────────────────────────────
-- One row per gym-owner profile: the owner's own verified
-- number, category consents and preferred time.

create table public.gym_owner_whatsapp (
  user_id           uuid primary key references public.profiles (id) on delete cascade,
  whatsapp_number   text not null default '',
  is_verified       boolean not null default false,
  verified_at       timestamptz,
  fitness_daily     boolean not null default false,
  membership_expiry boolean not null default false,
  service_reminders boolean not null default false,
  preferred_time    time not null default '09:00:00',
  timezone          text not null default 'Asia/Kolkata',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ── Per-gym messaging settings (owner's toggles for MEMBER
--    messaging — member messages only flow when the owner
--    enables the category here) ────────────────────────────

create table public.gym_messaging_settings (
  gym_id                      uuid primary key references public.gyms (id) on delete cascade,
  membership_expiry_reminders boolean not null default false,
  daily_fitness_messages      boolean not null default false,
  paused                      boolean not null default false,
  default_preferred_time      time not null default '09:00:00',
  updated_at                  timestamptz not null default now()
);

-- ── Member opt-ins ────────────────────────────────────────
-- One row per member. whatsapp_number is the destination the
-- owner recorded with the member's consent (prefilled from the
-- member's contact number). opted_out_at records an
-- unsubscribe; triggers cancel that member's queued messages.

create table public.member_whatsapp_optins (
  member_id        uuid primary key references public.members (id) on delete cascade,
  gym_id           uuid not null references public.gyms (id) on delete cascade,
  whatsapp_number  text not null default '',
  opted_in         boolean not null default false,
  fitness_daily    boolean not null default false,
  membership_expiry boolean not null default false,
  opted_in_at      timestamptz,
  opted_out_at     timestamptz,
  preferred_time   time not null default '09:00:00',
  timezone         text not null default 'Asia/Kolkata',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index member_whatsapp_optins_gym_idx
  on public.member_whatsapp_optins (gym_id);

-- ── Message outbox (the queue) ────────────────────────────
-- Exactly one of member_id / owner_user_id is set
-- (owner-bound rows carry the owner's profile id).

create table public.message_outbox (
  id                 uuid primary key default gen_random_uuid(),
  idempotency_key    text not null unique,
  -- Null only for 'test' rows (super-admin test
  -- sends, which are not gym-bound). Real
  -- messages always carry their gym.
  gym_id             uuid references public.gyms (id) on delete cascade,
  member_id          uuid references public.members (id) on delete cascade,
  owner_user_id      uuid references public.profiles (id) on delete cascade,
  recipient_phone    text not null check (recipient_phone ~ '^[0-9]{8,15}$'),
  category           text not null
                     check (category in ('fitness_daily', 'membership_expiry', 'owner_subscription_expiry', 'test')),
  template_name      text not null,
  template_params    jsonb not null default '{}'::jsonb,
  status             text not null default 'scheduled'
                     check (status in ('scheduled', 'pending', 'sending', 'sent', 'delivered', 'failed', 'suppressed', 'cancelled')),
  status_reason      text not null default '',
  scheduled_for      timestamptz not null,
  attempts           integer not null default 0,
  last_attempt_at    timestamptz,
  provider_message_id text not null default '',
  estimated_cost     numeric (10, 4) not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  sent_at            timestamptz,
  check ((member_id is null) <> (owner_user_id is null))
);

create index message_outbox_due_idx
  on public.message_outbox (scheduled_for)
  where status in ('scheduled', 'pending');

-- Duplicate-job safeguard: at most one pending message per
-- target + category per day. Failed rows are not in the
-- predicate, so safe retries after a failure still work.
create unique index message_outbox_one_pending_per_day
  on public.message_outbox (
    coalesce(member_id, owner_user_id, recipient_phone),
    category,
    date_trunc('day', scheduled_for)
  )
  where status in ('scheduled', 'pending', 'sending');

-- ── Append-only message event log ─────────────────────────
-- Reason codes and provider error codes only — NEVER fitness
-- photos, health data or other member PII beyond the phone.

create table public.message_events (
  id         uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.message_outbox (id) on delete cascade,
  event_type text not null
             check (event_type in ('queued', 'sending', 'sent', 'delivered', 'read', 'failed', 'suppressed', 'cancelled', 'retried')),
  detail     jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index message_events_message_idx
  on public.message_events (message_id);

-- ── Subscription-state helper ─────────────────────────────
-- Full owner-subscription check: the gym row must be active
-- AND not past its end date. Stricter than gym_access_ok(),
-- which only blocks expired trials — paid gyms past their
-- renewal date count as inactive here (their member messages
-- are suppressed until the Super Admin renews).

create or replace function public.gym_subscription_active(p_gym_id uuid)
returns boolean
language sql
stable
security invoker
as $$
  select exists (
    select 1
    from public.gyms g
    where g.id = p_gym_id
      and g.status = 'active'
      and g.subscription_end_date > now()
  )
$$;

-- ── Central eligibility check ─────────────────────────────
-- Called by the scheduler immediately before delivery.
-- Returns (ok, reason, is_deferrable):
--   is_deferrable = true  → transient condition, retry later
--   is_deferrable = false → terminal, suppress the message

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
  --    reminders. Deliberately does NOT require an active
  --    subscription — expiry is the trigger. ────────────────
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

  -- ── MEMBER PATH (strict) ────────────────────────────────
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

-- ── Queue helpers ─────────────────────────────────────────
-- enqueue_message is idempotent: a repeated call with the
-- same idempotency key returns NULL (the original row stands).

create or replace function public.enqueue_message(
  p_idempotency_key text,
  p_gym_id uuid,
  p_member_id uuid default null,
  p_owner_user_id uuid default null,
  p_recipient_phone text,
  p_category text,
  p_template_name text,
  p_template_params jsonb default '{}'::jsonb,
  p_scheduled_for timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.message_outbox (
    idempotency_key, gym_id, member_id, owner_user_id,
    recipient_phone, category, template_name, template_params,
    scheduled_for
  )
  values (
    p_idempotency_key, p_gym_id, p_member_id, p_owner_user_id,
    p_recipient_phone, p_category, p_template_name, p_template_params,
    p_scheduled_for
  )
  on conflict (idempotency_key) do nothing
  returning id into v_id;

  if v_id is not null then
    insert into public.message_events (message_id, event_type, detail)
    values (v_id, 'queued', jsonb_build_object(
      'category', p_category,
      'scheduled_for', to_char(p_scheduled_for, 'YYYY-MM-DD"T"HH24:MI:SS')
    ));
  end if;

  return v_id;
end;
$$;

-- Cancels queued messages. With p_category set, only that
-- category is cancelled; with it NULL, every category EXCEPT
-- owner subscription reminders is cancelled (an inactive gym
-- must still receive its own renewal reminders).

create or replace function public.cancel_pending_for_gym(
  p_gym_id uuid,
  p_reason text default 'gym_inactive',
  p_category text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  with cancelled as (
    update public.message_outbox
    set status = 'cancelled',
        status_reason = p_reason,
        updated_at = now()
    where gym_id = p_gym_id
      and status in ('scheduled', 'pending', 'sending')
      and (
        (p_category is not null and category = p_category)
        or
        (p_category is null and category <> 'owner_subscription_expiry')
      )
    returning id
  )
  insert into public.message_events (message_id, event_type, detail)
  select id, 'cancelled', jsonb_build_object('reason', p_reason)
  from cancelled;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.cancel_pending_for_member(
  p_member_id uuid,
  p_reason text default 'member_unsubscribed'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  with cancelled as (
    update public.message_outbox
    set status = 'cancelled',
        status_reason = p_reason,
        updated_at = now()
    where member_id = p_member_id
      and status in ('scheduled', 'pending', 'sending')
    returning id
  )
  insert into public.message_events (message_id, event_type, detail)
  select id, 'cancelled', jsonb_build_object('reason', p_reason)
  from cancelled;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ── Automatic safeguards (triggers) ───────────────────────

-- A renewal (end date moved forward) cancels the owner's
-- pending expiry reminders. A gym going inactive cancels all
-- queued MEMBER messages — owner reminders are preserved so
-- the owner can still be notified.

create or replace function public.handle_gym_subscription_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.subscription_end_date > old.subscription_end_date then
    perform public.cancel_pending_for_gym(
      new.id, 'subscription_renewed', 'owner_subscription_expiry'
    );
  end if;

  if new.status in ('expired', 'suspended')
     and old.status = 'active' then
    perform public.cancel_pending_for_gym(new.id, 'gym_' || new.status);
  end if;

  return new;
end;
$$;

create trigger gyms_subscription_change
  after update on public.gyms
  for each row execute function public.handle_gym_subscription_change();

-- A member unsubscribing cancels their queued messages.

create or replace function public.handle_member_optout()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.opted_in = false and old.opted_in = true)
     or (new.opted_out_at is not null and old.opted_out_at is null) then
    perform public.cancel_pending_for_member(new.member_id, 'member_unsubscribed');
  end if;
  return new;
end;
$$;

create trigger member_whatsapp_optins_optout
  after update on public.member_whatsapp_optins
  for each row execute function public.handle_member_optout();

-- ── Row level security ────────────────────────────────────

alter table public.whatsapp_provider_config enable row level security;

create policy "super_admins manage provider config"
  on public.whatsapp_provider_config for all to authenticated
  using (public.auth_role() = 'super-admin')
  with check (public.auth_role() = 'super-admin');

alter table public.platform_messaging_controls enable row level security;

create policy "super_admins manage messaging controls"
  on public.platform_messaging_controls for all to authenticated
  using (public.auth_role() = 'super-admin')
  with check (public.auth_role() = 'super-admin');

alter table public.gym_owner_whatsapp enable row level security;

create policy "users manage own whatsapp settings"
  on public.gym_owner_whatsapp for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "super_admins read all whatsapp settings"
  on public.gym_owner_whatsapp for select to authenticated
  using (public.auth_role() = 'super-admin');

alter table public.gym_messaging_settings enable row level security;

create policy "gym_owners manage own messaging settings"
  on public.gym_messaging_settings for all to authenticated
  using (gym_id = public.auth_gym_id() and public.gym_access_ok(public.auth_gym_id()))
  with check (gym_id = public.auth_gym_id() and public.gym_access_ok(public.auth_gym_id()));

create policy "super_admins manage all messaging settings"
  on public.gym_messaging_settings for all to authenticated
  using (public.auth_role() = 'super-admin')
  with check (public.auth_role() = 'super-admin');

alter table public.member_whatsapp_optins enable row level security;

create policy "gym_owners manage own member opt-ins"
  on public.member_whatsapp_optins for all to authenticated
  using (gym_id = public.auth_gym_id() and public.gym_access_ok(public.auth_gym_id()))
  with check (gym_id = public.auth_gym_id() and public.gym_access_ok(public.auth_gym_id()));

create policy "super_admins manage all member opt-ins"
  on public.member_whatsapp_optins for all to authenticated
  using (public.auth_role() = 'super-admin')
  with check (public.auth_role() = 'super-admin');

alter table public.message_outbox enable row level security;

create policy "gym_owners read own gym messages"
  on public.message_outbox for select to authenticated
  using (gym_id = public.auth_gym_id() and public.gym_access_ok(public.auth_gym_id()));

create policy "super_admins manage all messages"
  on public.message_outbox for all to authenticated
  using (public.auth_role() = 'super-admin')
  with check (public.auth_role() = 'super-admin');

alter table public.message_events enable row level security;

create policy "gym_owners read own gym message events"
  on public.message_events for select to authenticated
  using (exists (
    select 1 from public.message_outbox o
    where o.id = message_id
      and o.gym_id = public.auth_gym_id()
      and public.gym_access_ok(public.auth_gym_id())
  ));

create policy "super_admins read all message events"
  on public.message_events for select to authenticated
  using (public.auth_role() = 'super-admin');

-- ── updated_at maintenance ────────────────────────────────

create trigger whatsapp_provider_config_updated_at
  before update on public.whatsapp_provider_config
  for each row execute function public.handle_updated_at();

create trigger platform_messaging_controls_updated_at
  before update on public.platform_messaging_controls
  for each row execute function public.handle_updated_at();

create trigger gym_owner_whatsapp_updated_at
  before update on public.gym_owner_whatsapp
  for each row execute function public.handle_updated_at();

create trigger gym_messaging_settings_updated_at
  before update on public.gym_messaging_settings
  for each row execute function public.handle_updated_at();

create trigger member_whatsapp_optins_updated_at
  before update on public.member_whatsapp_optins
  for each row execute function public.handle_updated_at();

create trigger message_outbox_updated_at
  before update on public.message_outbox
  for each row execute function public.handle_updated_at();

commit;
