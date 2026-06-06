alter table public.profiles
add column if not exists plan text;

update public.profiles
set plan = 'free'
where plan is null;

alter table public.profiles
alter column plan set default 'free';

alter table public.profiles
alter column plan set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_plan_check'
  ) then
    alter table public.profiles
    add constraint profiles_plan_check
    check (plan in ('free', 'pro'));
  end if;
end
$$;
