-- AI Assistant persistent user-owned chat history.
-- Stores only visible chat text and safe routing metadata; raw backend JSON context is not persisted.

create table if not exists public.ai_chat_sessions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  user_id uuid not null references auth.users(id),
  title text not null,
  last_message_preview text null,
  last_context_label text null,
  last_request_type text null,
  last_context_scope text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz null
);

create table if not exists public.ai_chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.ai_chat_sessions(id) on delete cascade,
  workspace_id uuid not null,
  user_id uuid not null references auth.users(id),
  role text not null check (role in ('user', 'assistant')),
  text text not null,
  context_label text null,
  request_type text null,
  context_scope text null,
  auto_routed boolean default false,
  created_at timestamptz not null default now()
);

create index if not exists ai_chat_sessions_workspace_user_archived_updated_idx
  on public.ai_chat_sessions (workspace_id, user_id, archived_at, updated_at desc);

create index if not exists ai_chat_messages_session_created_idx
  on public.ai_chat_messages (session_id, created_at asc);

create index if not exists ai_chat_messages_workspace_user_created_idx
  on public.ai_chat_messages (workspace_id, user_id, created_at desc);

create or replace function public.set_ai_chat_sessions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_ai_chat_sessions_updated_at on public.ai_chat_sessions;
create trigger set_ai_chat_sessions_updated_at
before update on public.ai_chat_sessions
for each row
execute function public.set_ai_chat_sessions_updated_at();

alter table public.ai_chat_sessions enable row level security;
alter table public.ai_chat_messages enable row level security;

-- User-owned history only. Access also requires active workspace access via existing helper.
drop policy if exists ai_chat_sessions_select_own_workspace on public.ai_chat_sessions;
create policy ai_chat_sessions_select_own_workspace
on public.ai_chat_sessions
for select
to authenticated
using (
  user_id = auth.uid()
  and public.workspace_role_rank(public.get_workspace_role(workspace_id, auth.uid())) >= 1
);

drop policy if exists ai_chat_sessions_insert_own_workspace on public.ai_chat_sessions;
create policy ai_chat_sessions_insert_own_workspace
on public.ai_chat_sessions
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.workspace_role_rank(public.get_workspace_role(workspace_id, auth.uid())) >= 1
);

drop policy if exists ai_chat_sessions_update_own_workspace on public.ai_chat_sessions;
create policy ai_chat_sessions_update_own_workspace
on public.ai_chat_sessions
for update
to authenticated
using (
  user_id = auth.uid()
  and public.workspace_role_rank(public.get_workspace_role(workspace_id, auth.uid())) >= 1
)
with check (
  user_id = auth.uid()
  and public.workspace_role_rank(public.get_workspace_role(workspace_id, auth.uid())) >= 1
);

drop policy if exists ai_chat_messages_select_own_workspace on public.ai_chat_messages;
create policy ai_chat_messages_select_own_workspace
on public.ai_chat_messages
for select
to authenticated
using (
  user_id = auth.uid()
  and public.workspace_role_rank(public.get_workspace_role(workspace_id, auth.uid())) >= 1
  and exists (
    select 1
    from public.ai_chat_sessions s
    where s.id = ai_chat_messages.session_id
      and s.workspace_id = ai_chat_messages.workspace_id
      and s.user_id = auth.uid()
  )
);

drop policy if exists ai_chat_messages_insert_own_workspace on public.ai_chat_messages;
create policy ai_chat_messages_insert_own_workspace
on public.ai_chat_messages
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.workspace_role_rank(public.get_workspace_role(workspace_id, auth.uid())) >= 1
  and exists (
    select 1
    from public.ai_chat_sessions s
    where s.id = session_id
      and s.workspace_id = workspace_id
      and s.user_id = auth.uid()
  )
);
