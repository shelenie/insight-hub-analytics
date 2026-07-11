-- Allow users to permanently delete only their own archived AI Assistant chat sessions.
-- Messages cascade through ai_chat_messages.session_id -> ai_chat_sessions(id) on delete cascade.

alter table public.ai_chat_sessions enable row level security;

grant delete on table public.ai_chat_sessions to authenticated;

drop policy if exists ai_chat_sessions_delete_own_archived_workspace on public.ai_chat_sessions;
create policy ai_chat_sessions_delete_own_archived_workspace
on public.ai_chat_sessions
for delete
to authenticated
using (
  ai_chat_sessions.user_id = auth.uid()
  and ai_chat_sessions.archived_at is not null
  and public.workspace_role_rank(public.get_workspace_role(ai_chat_sessions.workspace_id, auth.uid())) >= 1
);
