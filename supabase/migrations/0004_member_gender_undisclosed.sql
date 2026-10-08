-- Adds the fourth gender option, "Prefer not to say",
-- to member records (stored as 'undisclosed').
--
-- Purely additive: existing rows keep their value and
-- the app default stays 'other'.

begin;

alter table public.members drop constraint if exists members_gender_check;

alter table public.members add constraint members_gender_check
  check (gender in ('male', 'female', 'other', 'undisclosed'));

commit;
