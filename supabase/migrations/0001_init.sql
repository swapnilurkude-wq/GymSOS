-- GymSOS platform schema
--
-- Conventions:
--   * uuid primary keys (gen_random_uuid is built into Supabase's Postgres)
--   * timestamptz for every ISO-timestamp field the app stores
--   * integer for rupee amounts (the app works in whole rupees)
--   * check constraints instead of native enums for easy JS interop
--   * row level security on every table; policies key off the caller's
--     profile row (role + gym_id), see auth_role() / auth_gym_id()

begin;

-- ── Gyms ────────────────────────────────────────────────────────────────────

create table public.gyms (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null,
  location             text not null default '',
  plan                 text not null default 'trial'
                       check (plan in ('trial', 'starter', 'growth', 'pro')),
  status               text not null default 'active'
                       check (status in ('active', 'suspended', 'expired')),
  owner_name           text not null default '',
  owner_email          text not null default '',
  owner_contact        text not null default '',
  member_count         integer not null default 0,
  subscription_end_date timestamptz not null default now(),
  created_at           timestamptz not null default now()
);

create index gyms_owner_email_idx on public.gyms (owner_email);

-- ── User profiles (extends auth.users) ─────────────────────────────────────

create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  name       text not null default '',
  avatar_url text,
  role       text not null default 'gym-owner'
             check (role in ('super-admin', 'gym-owner')),
  gym_id     uuid references public.gyms (id) on delete set null,
  gym_name   text,
  created_at timestamptz not null default now()
);

-- ── Members ─────────────────────────────────────────────────────────────────

create table public.members (
  id             uuid primary key default gen_random_uuid(),
  gym_id         uuid not null references public.gyms (id) on delete cascade,
  receipt_number text not null,
  photo_url      text,
  name           text not null,
  contact_number text not null default '',
  gender         text not null default 'other'
                 check (gender in ('male', 'female', 'other')),
  address        text not null default '',
  member_type    text not null default 'new'
                 check (member_type in ('new', 'renewal')),
  plan           text not null default 'Monthly'
                 check (plan in ('Monthly', 'Quarterly', 'Half-Yearly', 'Annual')),
  duration_months integer not null default 1,
  start_date     timestamptz not null default now(),
  end_date       timestamptz not null default now(),
  amount         integer not null default 0,
  discount       integer not null default 0,
  paid_amount    integer not null default 0,
  balance_amount integer not null default 0,
  payment_mode   text not null default 'cash'
                 check (payment_mode in ('cash', 'online', 'mixed')),
  cash_amount    integer not null default 0,
  online_amount  integer not null default 0,
  payment_receiver text not null default '',
  payment_date   timestamptz not null default now(),
  notes          text not null default '',
  terms_accepted boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (gym_id, receipt_number)
);

create index members_gym_idx on public.members (gym_id);
create index members_gym_end_date_idx on public.members (gym_id, end_date);

-- ── Receipts (payment ledger) ───────────────────────────────────────────────

create table public.receipts (
  id               uuid primary key default gen_random_uuid(),
  gym_id           uuid not null references public.gyms (id) on delete cascade,
  member_id        uuid not null references public.members (id) on delete cascade,
  receipt_number   text not null,
  receipt_date     timestamptz not null default now(),
  status           text not null default 'pending'
                   check (status in ('paid', 'partial', 'pending')),
  member_name      text not null default '',
  member_contact   text not null default '',
  member_dob       date,
  particular       text not null default 'new'
                   check (particular in ('new', 'renewal', 'add-on', 'facility')),
  plan             text not null default 'Monthly'
                   check (plan in ('Monthly', 'Quarterly', 'Half-Yearly', 'Annual')),
  duration_months  integer not null default 1,
  start_date       timestamptz not null default now(),
  end_date         timestamptz not null default now(),
  total_amount     integer not null default 0,
  amount_paid      integer not null default 0,
  cash_amount      integer not null default 0,
  online_amount    integer not null default 0,
  balance_amount   integer not null default 0,
  balance_paid     integer not null default 0,
  balance_due_date timestamptz,
  payment_mode     text not null default 'cash'
                   check (payment_mode in ('cash', 'online', 'mixed')),
  transaction_id   text not null default '',
  notes            text not null default '',
  nutrition        boolean not null default false,
  personal_training boolean not null default false,
  customer_signature text not null default '',
  receiver_signature text not null default '',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (gym_id, receipt_number)
);

create index receipts_gym_idx on public.receipts (gym_id);
create index receipts_gym_receipt_date_idx on public.receipts (gym_id, receipt_date);
create index receipts_member_idx on public.receipts (member_id);

-- ── Receipt templates & numbering counters ──────────────────────────────

create table public.receipt_templates (
  gym_id                   uuid primary key references public.gyms (id) on delete cascade,
  logo_url                 text,
  gym_name                 text not null default '',
  gym_address              text not null default '',
  contact_number           text not null default '',
  terms_and_conditions     text not null default '',
  authorized_signature_name text not null default '',
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create table public.receipt_counters (
  gym_id      uuid primary key references public.gyms (id) on delete cascade,
  last_number integer not null default 0
);

create table public.receipt_ledger_counters (
  gym_id      uuid primary key references public.gyms (id) on delete cascade,
  last_number integer not null default 0
);

-- ── Per-user notification settings ────────────────────────────────────────

create table public.notification_preferences (
  user_id          uuid primary key references auth.users (id) on delete cascade,
  renewal_reminders boolean not null default true,
  payment_alerts    boolean not null default true,
  weekly_digest     boolean not null default false,
  updated_at        timestamptz not null default now()
);

create table public.notification_reads (
  user_id        uuid not null references auth.users (id) on delete cascade,
  notification_id text not null,
  read_at        timestamptz not null default now(),
  primary key (user_id, notification_id)
);

-- ── RLS helper functions ──────────────────────────────────────────────────

create or replace function public.auth_role()
returns text
language sql
stable
security invoker
as $$
  select p.role from public.profiles p where p.id = auth.uid()
$$;

create or replace function public.auth_gym_id()
returns uuid
language sql
stable
security invoker
as $$
  select p.gym_id from public.profiles p where p.id = auth.uid()
$$;

-- ── Row level security ──────────────────────────────────────────────────

alter table public.gyms enable row level security;

create policy "super_admins manage all gyms"
  on public.gyms for all to authenticated
  using (public.auth_role() = 'super-admin')
  with check (public.auth_role() = 'super-admin');

create policy "gym_owners read own gym"
  on public.gyms for select to authenticated
  using (id = public.auth_gym_id());

create policy "gym_owners update own gym"
  on public.gyms for update to authenticated
  using (id = public.auth_gym_id())
  with check (id = public.auth_gym_id());

alter table public.profiles enable row level security;

create policy "users read own profile"
  on public.profiles for select to authenticated
  using (id = auth.uid());

create policy "super_admins read all profiles"
  on public.profiles for select to authenticated
  using (public.auth_role() = 'super-admin');

create policy "users update own profile"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

alter table public.members enable row level security;

create policy "super_admins manage all members"
  on public.members for all to authenticated
  using (public.auth_role() = 'super-admin')
  with check (public.auth_role() = 'super-admin');

create policy "gym_owners manage own members"
  on public.members for all to authenticated
  using (gym_id = public.auth_gym_id())
  with check (gym_id = public.auth_gym_id());

alter table public.receipts enable row level security;

create policy "super_admins manage all receipts"
  on public.receipts for all to authenticated
  using (public.auth_role() = 'super-admin')
  with check (public.auth_role() = 'super-admin');

create policy "gym_owners manage own receipts"
  on public.receipts for all to authenticated
  using (gym_id = public.auth_gym_id())
  with check (gym_id = public.auth_gym_id());

alter table public.receipt_templates enable row level security;

create policy "super_admins manage all receipt templates"
  on public.receipt_templates for all to authenticated
  using (public.auth_role() = 'super-admin')
  with check (public.auth_role() = 'super-admin');

create policy "gym_owners manage own receipt template"
  on public.receipt_templates for all to authenticated
  using (gym_id = public.auth_gym_id())
  with check (gym_id = public.auth_gym_id());

alter table public.receipt_counters enable row level security;

create policy "super_admins manage all counters"
  on public.receipt_counters for all to authenticated
  using (public.auth_role() = 'super-admin')
  with check (public.auth_role() = 'super-admin');

create policy "gym_owners manage own counter"
  on public.receipt_counters for all to authenticated
  using (gym_id = public.auth_gym_id())
  with check (gym_id = public.auth_gym_id());

alter table public.receipt_ledger_counters enable row level security;

create policy "super_admins manage all ledger counters"
  on public.receipt_ledger_counters for all to authenticated
  using (public.auth_role() = 'super-admin')
  with check (public.auth_role() = 'super-admin');

create policy "gym_owners manage own ledger counter"
  on public.receipt_ledger_counters for all to authenticated
  using (gym_id = public.auth_gym_id())
  with check (gym_id = public.auth_gym_id());

alter table public.notification_preferences enable row level security;

create policy "users manage own notification preferences"
  on public.notification_preferences for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

alter table public.notification_reads enable row level security;

create policy "users manage own notification reads"
  on public.notification_reads for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ── updated_at maintenance ──────────────────────────────────────────────

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger members_updated_at
  before update on public.members
  for each row execute function public.handle_updated_at();

create trigger receipts_updated_at
  before update on public.receipts
  for each row execute function public.handle_updated_at();

create trigger receipt_templates_updated_at
  before update on public.receipt_templates
  for each row execute function public.handle_updated_at();

commit;
