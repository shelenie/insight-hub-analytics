import type { TranslationKey } from "@/i18n/translations";
import { OPTIONS, type ContextOption } from "@/lib/assistantRouting";
import type { ChatMessage } from "@/lib/assistantConversation";

export const AI_CHAT_HISTORY_VISIBLE_DAYS = 14;
export const AI_CHAT_TITLE_MAX_LENGTH = 60;
export const AI_CHAT_PREVIEW_MAX_LENGTH = 120;

export type AiChatSession = {
  id: string;
  workspace_id: string;
  user_id: string;
  title: string;
  last_message_preview: string | null;
  last_context_label: string | null;
  last_request_type: string | null;
  last_context_scope: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type AiChatMessageRow = {
  id: string;
  session_id: string;
  workspace_id: string;
  user_id: string;
  role: "user" | "assistant";
  text: string;
  context_label: string | null;
  request_type: string | null;
  context_scope: string | null;
  auto_routed: boolean | null;
  created_at: string;
};

export function createSessionTitle(prompt: string): string {
  const normalized = prompt.replace(/\s+/g, " ").trim();
  if (normalized.length <= AI_CHAT_TITLE_MAX_LENGTH) return normalized || "Новий чат";
  return `${normalized.slice(0, AI_CHAT_TITLE_MAX_LENGTH - 1).trim()}…`;
}

export function createMessagePreview(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= AI_CHAT_PREVIEW_MAX_LENGTH) return normalized;
  return `${normalized.slice(0, AI_CHAT_PREVIEW_MAX_LENGTH - 1).trim()}…`;
}

export function getRecentHistoryCutoff(now = new Date()): string {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - AI_CHAT_HISTORY_VISIBLE_DAYS);
  return cutoff.toISOString();
}

export function optionFromPersistedMetadata(requestType?: string | null, contextScope?: string | null): ContextOption {
  return OPTIONS.find((option) => option.requestType === requestType && option.contextScope === contextScope) ?? OPTIONS[0];
}

export function messageFromRow(row: AiChatMessageRow, t: (key: TranslationKey) => string): ChatMessage {
  const option = optionFromPersistedMetadata(row.request_type, row.context_scope);
  return {
    id: row.id,
    role: row.role,
    text: row.text,
    contextLabel: row.context_label ?? `${t("assistantContextPrefix")}: ${t(option.labelKey)}`,
    option,
    autoRouted: Boolean(row.auto_routed),
  };
}

export function groupSessionsByRecency(sessions: AiChatSession[], now = new Date()) {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const startOfLastSevenDays = new Date(startOfToday);
  startOfLastSevenDays.setDate(startOfLastSevenDays.getDate() - 6);

  return {
    today: sessions.filter((session) => new Date(session.updated_at) >= startOfToday),
    yesterday: sessions.filter((session) => {
      const updatedAt = new Date(session.updated_at);
      return updatedAt >= startOfYesterday && updatedAt < startOfToday;
    }),
    lastSevenDays: sessions.filter((session) => {
      const updatedAt = new Date(session.updated_at);
      return updatedAt >= startOfLastSevenDays && updatedAt < startOfYesterday;
    }),
    earlier: sessions.filter((session) => new Date(session.updated_at) < startOfLastSevenDays),
  };
}
