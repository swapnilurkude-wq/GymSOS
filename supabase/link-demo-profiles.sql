-- Links the demo login accounts (created in Supabase Auth) to their
-- profile rows, which carries the role and gym assignment that RLS
-- policies use.
--
-- Run this AFTER creating the demo users:
--   Supabase dashboard → Authentication → Users → Add user
--     admin@gymsos.demo    password: DemoAdmin@123  (auto-confirm)
--     owner@ironpulse.com  password: Owner@123      (auto-confirm)
--
-- (Profiles are auto-created by the handle_new_user trigger — this
-- script upgrades those rows to their demo roles and gym assignment.)

begin;

-- Gym owner: Rahul Deshmukh → Iron Pulse Fitness
insert into public.profiles (id, name, role, gym_id, gym_name)
select
  u.id,
  'Rahul Deshmukh',
  'gym-owner',
  '00000000-0000-4000-8000-000000000001',
  'Iron Pulse Fitness'
from auth.users u
where u.email = 'owner@ironpulse.com'
on conflict (id) do update
  set name = excluded.name,
      role = excluded.role,
      gym_id = excluded.gym_id,
      gym_name = excluded.gym_name;

-- Super admin: platform administrator (no gym assignment)
insert into public.profiles (id, name, role)
select
  u.id,
  'Platform Admin',
  'super-admin'
from auth.users u
where u.email = 'admin@gymsos.demo'
on conflict (id) do update
  set name = excluded.name,
      role = excluded.role;

-- Default notification preferences for both demo users
insert into public.notification_preferences (user_id)
select u.id
from auth.users u
where u.email in ('owner@ironpulse.com', 'admin@gymsos.demo')
on conflict (user_id) do nothing;

commit;
