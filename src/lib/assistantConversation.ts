import type { TranslationKey } from "@/i18n/translations";
import type { ContextOption } from "@/lib/assistantRouting";
import { cleanAssistantTextForModelContext } from "@/lib/assistantAnswerParsing";

const CONVERSATION_HISTORY_MAX_MESSAGES = 12;
const CONVERSATION_HISTORY_TEXT_BUDGET = 15000;
const LATEST_ASSISTANT_TEXT_SLICE = 5500;
const OLDER_MESSAGE_TEXT_SLICE = 1400;

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  contextLabel: string;
  option: ContextOption;
  autoRouted?: boolean;
};

export type ConversationHistoryPayload = {
  role: "user" | "assistant";
  text: string;
  context_label: string;
  option_label: string;
  request_type: string;
  context_scope: string;
};

export type ConversationThreadMetadata = {
  previous_assistant_context_scope: string | null;
  previous_assistant_request_type: string | null;
  previous_assistant_label: string | null;
  current_thread_has_history: boolean;
};

export function buildConversationHistory(
  messages: ChatMessage[],
  t: (key: TranslationKey) => string,
): ConversationHistoryPayload[] {
  const latestAssistantIndex = findLatestAssistantIndex(messages);
  const selected: ConversationHistoryPayload[] = [];
  let usedCharacters = 0;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (selected.length >= CONVERSATION_HISTORY_MAX_MESSAGES) break;

    const message = messages[index];
    const textLimit =
      index === latestAssistantIndex
        ? LATEST_ASSISTANT_TEXT_SLICE
        : OLDER_MESSAGE_TEXT_SLICE;
    const remainingBudget = CONVERSATION_HISTORY_TEXT_BUDGET - usedCharacters;
    if (remainingBudget <= 0) break;

    const cleanedMessageText = cleanAssistantTextForModelContext(message.text);
    const text = cleanedMessageText.slice(0, Math.min(textLimit, remainingBudget));
    if (!text.trim()) continue;

    usedCharacters += text.length;
    selected.push({
      role: message.role,
      text,
      context_label: message.contextLabel,
      option_label: t(message.option.labelKey),
      request_type: message.option.requestType,
      context_scope: message.option.contextScope,
    });
  }

  return selected.reverse();
}

export function buildConversationThreadMetadata(
  messages: ChatMessage[],
  previousAssistantMessage: ChatMessage | null,
  t: (key: TranslationKey) => string,
): ConversationThreadMetadata {
  return {
    previous_assistant_context_scope:
      previousAssistantMessage?.option.contextScope ?? null,
    previous_assistant_request_type:
      previousAssistantMessage?.option.requestType ?? null,
    previous_assistant_label: previousAssistantMessage
      ? t(previousAssistantMessage.option.labelKey)
      : null,
    current_thread_has_history: messages.length > 0,
  };
}

function findLatestAssistantIndex(messages: ChatMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role === "assistant") return index;
  }
  return -1;
}
