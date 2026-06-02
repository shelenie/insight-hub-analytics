-- Harden the user preferences timestamp trigger by removing SECURITY DEFINER.

create or replace function public.set_user_preferences_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_user_preferences_updated_at() from public;
