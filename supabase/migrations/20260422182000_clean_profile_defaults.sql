alter table public.profiles
  alter column favorite_categories set default '{}'::text[];

update public.profiles
set favorite_categories = '{}'::text[],
    updated_at = timezone('utc', now())
where favorite_categories = array['Electronics', 'Sneakers', 'Gaming']::text[];

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  metadata_name text;
  email_name text;
  next_name text;
begin
  metadata_name := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'name', '')), '');
  email_name := nullif(split_part(coalesce(new.email, ''), '@', 1), '');
  next_name := coalesce(metadata_name, email_name, 'You');

  if lower(next_name) = 'heisenberg' and email_name is not null then
    next_name := email_name;
  end if;

  insert into public.profiles (
    id,
    email,
    name
  )
  values (
    new.id,
    new.email,
    next_name
  )
  on conflict (id) do update
    set email = excluded.email,
        name = case
          when public.profiles.name is null or btrim(public.profiles.name) = '' then excluded.name
          when lower(btrim(public.profiles.name)) = 'heisenberg'
            and lower(btrim(excluded.name)) <> 'heisenberg'
            then excluded.name
          else public.profiles.name
        end;

  insert into public.user_activity (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;
