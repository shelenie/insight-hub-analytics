-- Persist authenticated users' operational timestamp display preference.

create table if not exists public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid null,
  timezone_display_mode text not null default 'utc',
  timezone_name text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_preferences_timezone_display_mode_check
    check (timezone_display_mode in ('utc', 'local')),
  constraint user_preferences_user_id_key unique (user_id)
);

create or replace function public.set_user_preferences_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_user_preferences_updated_at on public.user_preferences;
create trigger set_user_preferences_updated_at
before update on public.user_preferences
for each row
execute function public.set_user_preferences_updated_at();

alter table public.user_preferences enable row level security;

revoke all on table public.user_preferences from public;
revoke all on table public.user_preferences from anon;

grant select, insert, update on table public.user_preferences to authenticated;
grant all on table public.user_preferences to service_role;

drop policy if exists user_preferences_select_own on public.user_preferences;
create policy user_preferences_select_own
on public.user_preferences
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists user_preferences_insert_own on public.user_preferences;
create policy user_preferences_insert_own
on public.user_preferences
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists user_preferences_update_own on public.user_preferences;
create policy user_preferences_update_own
on public.user_preferences
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
