-- Demo data for GymSOS.
--
-- Dates are authored relative to now() so a freshly seeded project
-- always opens with the same believable mix of active, renewal-due,
-- expired and suspended gyms / members — no matter when it is run.
--
-- Ids are deterministic UUIDs so seed.sql can be re-run safely
-- (on conflict do nothing) and profiles can reference stable ids.

begin;

-- ── Gyms ────────────────────────────────────────────────────────────

insert into public.gyms (id, name, location, plan, status, owner_name, owner_email, owner_contact, member_count, subscription_end_date, created_at) values
  ('00000000-0000-4000-8000-000000000001', 'Iron Pulse Fitness',    'Pune, Maharashtra',       'pro',     'active',    'Rahul Deshmukh', 'owner@ironpulse.com',        '9822099001', 482, now() + interval '240 days',  now() - interval '280 days'),
  ('00000000-0000-4000-8000-000000000002', 'PowerHouse Gym',        'Mumbai, Maharashtra',     'growth',  'active',    'Nikhil Shah',    'nikhil@powerhousegym.in',    '9821023456', 214, now() + interval '200 days',  now() - interval '260 days'),
  ('00000000-0000-4000-8000-000000000003', 'FitZone Arena',         'Bengaluru, Karnataka',    'pro',     'active',    'Anitha Reddy',   'anitha@fitzonearena.in',     '9880034567', 356, now() + interval '10 days',   now() - interval '240 days'),
  ('00000000-0000-4000-8000-000000000004', 'Titan Strength Studio', 'Hyderabad, Telangana',    'starter', 'active',    'Kiran Rao',      'kiran@titanstrength.in',     '9848045678', 87,  now() + interval '320 days',  now() - interval '200 days'),
  ('00000000-0000-4000-8000-000000000005', 'Flex Fitness Club',     'Delhi',                   'growth',  'active',    'Aman Kapoor',    'aman@flexfitnessclub.in',    '9811056789', 198, now() + interval '150 days',  now() - interval '180 days'),
  ('00000000-0000-4000-8000-000000000006', 'CorePower Studio',      'Ahmedabad, Gujarat',      'trial',   'active',    'Devang Patel',   'devang@corepowerstudio.in',  '9825067890', 22,  now() + interval '6 days',    now() - interval '90 days'),
  ('00000000-0000-4000-8000-000000000007', 'Momentum Fitness',      'Chennai, Tamil Nadu',     'starter', 'suspended', 'Suresh Kumar',   'suresh@momentumfitness.in',  '9840078901', 64,  now() + interval '180 days',  now() - interval '160 days'),
  ('00000000-0000-4000-8000-000000000008', 'Apex Athletic Club',    'Jaipur, Rajasthan',       'trial',   'active',    'Vivek Sharma',   'vivek@apexathletic.in',      '9829089012', 15,  now() + interval '90 days',   now() - interval '60 days'),
  ('00000000-0000-4000-8000-000000000009', 'Vertex Gym & Spa',      'Kolkata, West Bengal',    'growth',  'active',    'Ritika Sen',     'ritika@vertexgymspa.in',     '9831090123', 176, now() + interval '280 days',  now() - interval '150 days'),
  ('00000000-0000-4000-8000-000000000010', 'Prime Fitness Hub',     'Nagpur, Maharashtra',     'starter', 'expired',   'Ganesh Bhosale', 'ganesh@primefitnesshub.in',  '9822001234', 51,  now() - interval '20 days',   now() - interval '320 days'),
  ('00000000-0000-4000-8000-000000000011', 'Elevate Wellness Center','Indore, Madhya Pradesh', 'trial',   'active',    'Shreya Jain',    'shreya@elevatewellness.in',  '9827012345', 9,   now() + interval '45 days',   now() - interval '4 days'),
  ('00000000-0000-4000-8000-000000000012', 'Summit Strength Co.',   'Chandigarh',              'pro',     'active',    'Harpreet Singh', 'harpreet@summitstrength.in', '9888023456', 267, now() + interval '365 days',  now() - interval '120 days')
on conflict (id) do nothing;

-- ── Members of Iron Pulse Fitness (gym …0001) ─────────────────────

insert into public.members (id, gym_id, receipt_number, name, contact_number, gender, address, member_type, plan, duration_months, start_date, end_date, amount, discount, paid_amount, balance_amount, payment_mode, cash_amount, online_amount, payment_receiver, payment_date, notes, terms_accepted, created_at, updated_at) values
  ('00000000-0000-4000-8000-000000001001', '00000000-0000-4000-8000-000000000001', 'IPF-0001', 'Priya Kulkarni',   '9822011234', 'female', 'Baner Road, Pune',     'new',      'Quarterly',    3,  now(),                now() + interval '90 days',  7500,  0,    7500,  0,    'cash',   7500, 0,    'Rahul Deshmukh', now(),                '',                                                        true, now() - interval '2 days',   now()),
  ('00000000-0000-4000-8000-000000001002', '00000000-0000-4000-8000-000000000001', 'IPF-0002', 'Rohit Sharma',     '9822022345', 'male',   'Kothrud, Pune',        'renewal',  'Monthly',      1,  now() - interval '26 days', now() + interval '4 days',   2500,  0,    2500,  0,    'online', 0,    2500, 'Rahul Deshmukh', now() - interval '26 days', '',                                                        true, now() - interval '40 days',  now() - interval '26 days'),
  ('00000000-0000-4000-8000-000000001003', '00000000-0000-4000-8000-000000000001', 'IPF-0003', 'Ananya Deshpande', '9822033456', 'female', 'Viman Nagar, Pune',    'renewal',  'Annual',       12, now() - interval '25 days', now() + interval '340 days', 18000, 1000, 10000, 7000, 'mixed',  5000, 5000, 'Rahul Deshmukh', now() - interval '25 days', 'Balance to be cleared by month end.',                             true, now() - interval '90 days',  now() - interval '25 days'),
  ('00000000-0000-4000-8000-000000001004', '00000000-0000-4000-8000-000000000001', 'IPF-0004', 'Vikram Singh',     '9822044567', 'male',   'Hinjewadi, Pune',      'new',      'Half-Yearly',  6,  now() - interval '15 days', now() + interval '167 days', 12000, 0,    12000, 0,    'cash',   12000, 0,    'Rahul Deshmukh', now() - interval '15 days', '',                                                        true, now() - interval '15 days',  now() - interval '15 days'),
  ('00000000-0000-4000-8000-000000001005', '00000000-0000-4000-8000-000000000001', 'IPF-0005', 'Sneha Patil',      '9822055678', 'female', 'Aundh, Pune',          'renewal',  'Monthly',      1,  now() - interval '32 days', now() - interval '2 days',   2500,  0,    2500,  0,    'online', 0,    2500, 'Rahul Deshmukh', now() - interval '32 days', '',                                                        true, now() - interval '60 days',  now() - interval '32 days'),
  ('00000000-0000-4000-8000-000000001006', '00000000-0000-4000-8000-000000000001', 'IPF-0006', 'Arjun Mehta',      '9822066789', 'male',   'Wakad, Pune',          'new',      'Quarterly',    3,  now() - interval '30 days', now() + interval '60 days',  7500,  0,    7500,  0,    'cash',   7500, 0,    'Rahul Deshmukh', now() - interval '30 days', '',                                                        true, now() - interval '30 days',  now() - interval '30 days'),
  ('00000000-0000-4000-8000-000000001007', '00000000-0000-4000-8000-000000000001', 'IPF-0007', 'Karan Joshi',      '9822077890', 'male',   'Shivaji Nagar, Pune',  'renewal',  'Monthly',      1,  now() - interval '60 days', now() - interval '30 days',  2500,  0,    1500,  1000, 'cash',   1500, 0,    'Rahul Deshmukh', now() - interval '60 days', 'Left without clearing balance — follow up.',                    true, now() - interval '100 days', now() - interval '60 days'),
  ('00000000-0000-4000-8000-000000001008', '00000000-0000-4000-8000-000000000001', 'IPF-0008', 'Meera Nair',       '9822088901', 'female', 'Kharadi, Pune',        'new',      'Annual',       12, now() - interval '5 days',  now() + interval '360 days', 18000, 2000, 16000, 0,    'mixed',  8000, 8000, 'Rahul Deshmukh', now() - interval '5 days',  '',                                                        true, now() - interval '5 days',   now() - interval '5 days')
on conflict (id) do nothing;

-- ── Receipt template for Iron Pulse Fitness ──────────────────────

insert into public.receipt_templates (gym_id, gym_name, gym_address, contact_number, terms_and_conditions, authorized_signature_name, created_at, updated_at)
values (
  '00000000-0000-4000-8000-000000000001',
  'Iron Pulse Fitness',
  'Baner Road, Pune, Maharashtra',
  '9822099001',
  'Membership is non-transferable and non-refundable. Fees are billed for the chosen duration and renew automatically unless cancelled before the renewal date. The gym is not responsible for loss or damage to personal belongings.',
  'Rahul Deshmukh',
  now(),
  now()
)
on conflict (gym_id) do nothing;

-- ── Numbering counters ────────────────────────────────────────────
-- 8 members seeded → next member receipt number is IPF-0009.
-- Receipt ledger starts at 0 → first receipt is IPF-RCT-0001.

insert into public.receipt_counters (gym_id, last_number)
values ('00000000-0000-4000-8000-000000000001', 8)
on conflict (gym_id) do nothing;

insert into public.receipt_ledger_counters (gym_id, last_number)
values ('00000000-0000-4000-8000-000000000001', 0)
on conflict (gym_id) do nothing;

commit;
