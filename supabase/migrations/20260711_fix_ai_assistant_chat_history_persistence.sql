-- Fix live AI Assistant chat history persistence through PostgREST grants
-- and fully-qualified RLS predicates. Keeps user-owned, active workspace-scoped access.

grant select, insert, update on table public.ai_chat_sessions to authenticated;
grant select, insert on table public.ai_chat_messages to authenticated;

alter table public.ai_chat_sessions enable row level security;
alter table public.ai_chat_messages enable row level security;

drop policy if exists ai_chat_sessions_select_own_workspace on public.ai_chat_sessions;
create policy ai_chat_sessions_select_own_workspace
on public.ai_chat_sessions
for select
to authenticated
using (
  ai_chat_sessions.user_id = auth.uid()
  and public.workspace_role_rank(public.get_workspace_role(ai_chat_sessions.workspace_id, auth.uid())) >= 1
);

drop policy if exists ai_chat_sessions_insert_own_workspace on public.ai_chat_sessions;
create policy ai_chat_sessions_insert_own_workspace
on public.ai_chat_sessions
for insert
to authenticated
with check (
  ai_chat_sessions.user_id = auth.uid()
  and public.workspace_role_rank(public.get_workspace_role(ai_chat_sessions.workspace_id, auth.uid())) >= 1
);

drop policy if exists ai_chat_sessions_update_own_workspace on public.ai_chat_sessions;
create policy ai_chat_sessions_update_own_workspace
on public.ai_chat_sessions
for update
to authenticated
using (
  ai_chat_sessions.user_id = auth.uid()
  and public.workspace_role_rank(public.get_workspace_role(ai_chat_sessions.workspace_id, auth.uid())) >= 1
)
with check (
  ai_chat_sessions.user_id = auth.uid()
  and public.workspace_role_rank(public.get_workspace_role(ai_chat_sessions.workspace_id, auth.uid())) >= 1
);

drop policy if exists ai_chat_messages_select_own_workspace on public.ai_chat_messages;
create policy ai_chat_messages_select_own_workspace
on public.ai_chat_messages
for select
to authenticated
using (
  ai_chat_messages.user_id = auth.uid()
  and public.workspace_role_rank(public.get_workspace_role(ai_chat_messages.workspace_id, auth.uid())) >= 1
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
  ai_chat_messages.user_id = auth.uid()
  and public.workspace_role_rank(public.get_workspace_role(ai_chat_messages.workspace_id, auth.uid())) >= 1
  and exists (
    select 1
    from public.ai_chat_sessions s
    where s.id = ai_chat_messages.session_id
      and s.workspace_id = ai_chat_messages.workspace_id
      and s.user_id = auth.uid()
  )
);
