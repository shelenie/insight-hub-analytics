import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildConversationHistory } from "@/lib/assistantConversation";
import {
  createMessagePreview,
  createRenamedSessionTitle,
  createSessionTitle,
  getRecentHistoryCutoff,
  groupSessionsByRecency,
  messageFromRow,
} from "@/lib/assistantChatHistory";
import { OPTIONS } from "@/lib/assistantRouting";

const assistantSource = readFileSync("src/pages/Assistant.tsx", "utf8");
const sheetSource = readFileSync("src/components/ui/sheet.tsx", "utf8");
const migrationSource = readFileSync(
  "supabase/migrations/20260710_ai_assistant_chat_history.sql",
  "utf8",
);
const persistenceFixMigrationSource = readFileSync(
  "supabase/migrations/20260711_fix_ai_assistant_chat_history_persistence.sql",
  "utf8",
);
const generalModeConstraintMigrationSource = readFileSync(
  "supabase/migrations/20260711_allow_general_ai_helper_requests.sql",
  "utf8",
);
const archivedDeleteMigrationSource = readFileSync(
  "supabase/migrations/20260711_allow_archived_ai_chat_session_delete.sql",
  "utf8",
);

describe("AI Assistant persistent chat history", () => {
  it("adds Supabase chat history tables, indexes, RLS, and soft archive metadata", () => {
    expect(migrationSource).toContain(
      "create table if not exists public.ai_chat_sessions",
    );
    expect(migrationSource).toContain(
      "create table if not exists public.ai_chat_messages",
    );
    expect(migrationSource).toContain("archived_at timestamptz null");
    expect(migrationSource).toContain(
      "on public.ai_chat_sessions (workspace_id, user_id, archived_at, updated_at desc)",
    );
    expect(migrationSource).toContain(
      "on public.ai_chat_messages (session_id, created_at asc)",
    );
    expect(migrationSource).toContain(
      "alter table public.ai_chat_sessions enable row level security",
    );
    expect(migrationSource).toContain(
      "alter table public.ai_chat_messages enable row level security",
    );
    expect(migrationSource).toContain("user_id = auth.uid()");
    expect(migrationSource).toContain(
      "public.workspace_role_rank(public.get_workspace_role(workspace_id, auth.uid())) >= 1",
    );
    expect(migrationSource).not.toMatch(
      /service_role|drop table|delete from public\.ai_chat/i,
    );
  });

  it("adds the source-controlled General mode constraint migration without data, RLS, or grant changes", () => {
    expect(generalModeConstraintMigrationSource).toContain(
      "drop constraint if exists ai_helper_requests_request_type_check",
    );
    expect(generalModeConstraintMigrationSource).toContain(
      "drop constraint if exists ai_helper_requests_context_scope_check",
    );
    expect(generalModeConstraintMigrationSource).toContain(
      "'general_assistant'",
    );
    expect(generalModeConstraintMigrationSource).toContain("'general'");
    expect(generalModeConstraintMigrationSource).toContain(
      "'data_quality_summary'",
    );
    expect(generalModeConstraintMigrationSource).toContain("'ads_health'");
    expect(generalModeConstraintMigrationSource).not.toMatch(
      /delete\s+from|drop\s+table|service_role|grant\s+/i,
    );
    expect(generalModeConstraintMigrationSource).not.toContain(
      "alter table public.ai_helper_requests disable row level security",
    );
  });

  it("fixes live PostgREST grants while preserving user-owned workspace RLS", () => {
    expect(persistenceFixMigrationSource).toContain(
      "grant select, insert, update on table public.ai_chat_sessions to authenticated",
    );
    expect(persistenceFixMigrationSource).toContain(
      "grant select, insert on table public.ai_chat_messages to authenticated",
    );
    expect(persistenceFixMigrationSource).toContain(
      "alter table public.ai_chat_sessions enable row level security",
    );
    expect(persistenceFixMigrationSource).toContain(
      "alter table public.ai_chat_messages enable row level security",
    );
    expect(persistenceFixMigrationSource).toContain(
      "ai_chat_sessions.user_id = auth.uid()",
    );
    expect(persistenceFixMigrationSource).toContain(
      "public.get_workspace_role(ai_chat_sessions.workspace_id, auth.uid())",
    );
    expect(persistenceFixMigrationSource).toContain(
      "ai_chat_messages.user_id = auth.uid()",
    );
    expect(persistenceFixMigrationSource).toContain(
      "s.id = ai_chat_messages.session_id",
    );
    expect(persistenceFixMigrationSource).toContain(
      "s.workspace_id = ai_chat_messages.workspace_id",
    );
    expect(persistenceFixMigrationSource).not.toMatch(
      /service_role|to anon|for delete|drop table|delete from public\.ai_chat/i,
    );
  });

  it("allows permanent deletion only for own archived AI chat sessions", () => {
    expect(archivedDeleteMigrationSource).toContain("for delete");
    expect(archivedDeleteMigrationSource).toContain(
      "ai_chat_sessions.user_id = auth.uid()",
    );
    expect(archivedDeleteMigrationSource).toContain(
      "ai_chat_sessions.archived_at is not null",
    );
    expect(archivedDeleteMigrationSource).toContain(
      "public.workspace_role_rank(public.get_workspace_role(ai_chat_sessions.workspace_id, auth.uid())) >= 1",
    );
    expect(archivedDeleteMigrationSource).toContain(
      "alter table public.ai_chat_sessions enable row level security",
    );
    expect(archivedDeleteMigrationSource).not.toContain(
      "disable row level security",
    );
    expect(archivedDeleteMigrationSource).not.toMatch(
      /delete\s+from|service_role|to anon/i,
    );
  });

  it("creates deterministic titles/previews and recent 14-day cutoff", () => {
    expect(createSessionTitle("  hello    world  ")).toBe("hello world");
    expect(createSessionTitle("x".repeat(80))).toHaveLength(60);
    expect(createSessionTitle("x".repeat(80))).toMatch(/…$/);
    expect(createMessagePreview("a\n\n b")).toBe("a b");
    expect(createMessagePreview("### Heading")).toBe("Heading");
    expect(createMessagePreview("**CPL** — це *Cost Per Lead*")).toBe(
      "CPL — це Cost Per Lead",
    );
    expect(createSessionTitle("Контекст: Test\n\nPrompt body")).toBe(
      "Prompt body",
    );
    expect(
      createMessagePreview("[CLIENT_COPY_START]\nClient\n[CLIENT_COPY_END]"),
    ).toBe("Client");
    expect(getRecentHistoryCutoff(new Date("2026-07-10T00:00:00Z"))).toBe(
      "2026-06-26T00:00:00.000Z",
    );
  });

  it("renders compact drawer UI, empty state, archive action, and recent non-archived query", () => {
    expect(assistantSource).toContain(
      "const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)",
    );
    expect(assistantSource).toContain(
      "const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false)",
    );
    expect(assistantSource).toContain('t("assistantHistory")');
    expect(assistantSource).toContain('t("assistantHistoryTitle")');
    expect(assistantSource).toContain('t("assistantHistoryRecentSubtitle")');
    expect(assistantSource).toContain('t("assistantHistoryArchiveSubtitle")');
    expect(assistantSource).toContain('t("assistantHistoryEmpty")');
    expect(assistantSource).toContain('t("assistantHistoryGroupToday")');
    expect(assistantSource).toContain('t("assistantHistoryGroupYesterday")');
    expect(assistantSource).toContain(
      't("assistantHistoryGroupLastSevenDays")',
    );
    expect(assistantSource).toContain('t("assistantHistoryGroupEarlier")');
    expect(assistantSource).toContain('t("assistantHistoryArchive")');
    expect(assistantSource).toContain('t("assistantHistoryRename")');
    expect(assistantSource).toContain('t("assistantHistoryRenameSave")');
    expect(assistantSource).toContain('t("assistantHistoryRenameCancel")');
    expect(assistantSource).toContain('.is("archived_at", null)');
    expect(assistantSource).toContain('.not("archived_at", "is", null)');
    expect(assistantSource).toContain('t("assistantHistoryRecent")');
    expect(assistantSource).toContain('t("assistantHistoryArchiveTab")');
    expect(assistantSource).toContain('t("assistantHistoryRestore")');
    expect(assistantSource).toContain(
      'onClick={() => onViewChange("archive")}',
    );
    expect(assistantSource).toContain('onClick={() => onViewChange("recent")}');
    expect(assistantSource).toContain('t("assistantHistoryArchivedEmpty")');
    expect(assistantSource).toContain('t("assistantHistoryNoAiAnswer")');
    expect(assistantSource).toContain(
      "border border-primary/25 bg-background font-semibold text-foreground shadow-sm ring-1 ring-primary/10",
    );
    expect(assistantSource).toContain(
      "text-muted-foreground hover:bg-background/50 hover:text-foreground",
    );
    expect(assistantSource).toContain("rounded-lg border px-2 py-1.5");
    expect(assistantSource).toContain(
      "line-clamp-1 min-w-0 flex-1 text-xs text-muted-foreground",
    );
    expect(assistantSource).toContain(
      'className="h-5 rounded-full px-1.5 text-[10px] text-muted-foreground"',
    );
    expect(assistantSource).toContain(
      '.gte("updated_at", getRecentHistoryCutoff())',
    );
    expect(assistantSource).toContain(
      '.limit(targetView === "recent" ? 30 : 100)',
    );
    expect(assistantSource).toContain('setHistoryView("recent")');
    expect(assistantSource).toContain('void loadSessions("recent")');
    expect(assistantSource).toContain("void loadSessions(nextView)");
    expect(assistantSource).toContain(
      ".update({ archived_at: new Date().toISOString() })",
    );
    expect(sheetSource).toContain("overlayClassName?: string");
    expect(sheetSource).toContain(
      "<SheetOverlay className={overlayClassName} />",
    );
    expect(sheetSource).toContain("fixed inset-0 z-50 bg-black/80");
    expect(assistantSource).toContain(
      'overlayClassName="bg-slate-950/45 backdrop-blur-[1px]"',
    );
  });

  it("persists first user message and assistant response into the same session and updates metadata", () => {
    expect(assistantSource).toContain('from("ai_chat_sessions")');
    expect(assistantSource).toContain("createSessionTitle(submittedPrompt)");
    expect(assistantSource).toContain(
      "const sessionId = await ensureSession(submittedPrompt)",
    );
    expect(assistantSource).toContain("setCurrentSessionId(sessionId)");
    expect(assistantSource).toContain("pendingSessionId.current = sessionId");
    expect(assistantSource).toContain(
      'await saveChatMessage(sessionId, userMessage, "user_message_save")',
    );
    expect(assistantSource).toContain("persistedSessionId");
    expect(assistantSource).toContain("assistant_message_save");
    expect(assistantSource).toContain(
      "await updateSessionMetadata(persistedSessionId, assistantMessage)",
    );
    expect(assistantSource).toContain(
      "last_message_preview: createMessagePreview(message.text)",
    );
    expect(assistantSource).toContain(
      "last_request_type: message.option.requestType",
    );
    expect(assistantSource).toContain(
      "last_context_scope: message.option.contextScope",
    );
    expect(assistantSource).toContain("isSubmittingRef.current");
    expect(assistantSource).toContain("sessionCreationPromiseRef.current");
    expect(assistantSource).toContain("if (sessionCreationPromiseRef.current)");
    expect(assistantSource).toContain(
      "return sessionCreationPromiseRef.current",
    );
    expect(assistantSource).toContain("createOptimisticSession(");
    expect(assistantSource).toContain("void loadSessions()");
  });

  it("records non-blocking persistence diagnostics without blocking AI answers", () => {
    expect(assistantSource).toContain("type HistoryOperation");
    expect(assistantSource).toContain("sanitizeHistoryError");
    expect(assistantSource).toContain("HistoryPersistenceStatus");
    expect(assistantSource).toContain("assistantHistorySaveWarning");
    expect(assistantSource).toContain("session_create");
    expect(assistantSource).toContain("user_message_save");
    expect(assistantSource).toContain("assistant_message_save");
    expect(assistantSource).toContain("session_metadata_update");
    expect(assistantSource).toContain("drawer_load");
    expect(assistantSource).toContain("No chat session id available");
    expect(assistantSource).toContain("run.mutate({");
    expect(assistantSource).toContain("threadMetadata,");
    expect(assistantSource).not.toContain("service_role");
  });

  it("supports safe manual rename without changing archive behavior", () => {
    expect(assistantSource).toContain("const renameChatSession = async");
    expect(assistantSource).toContain(
      "const nextTitle = createRenamedSessionTitle(title)",
    );
    expect(assistantSource).toContain(".update({ title: nextTitle })");
    expect(assistantSource).toContain(
      "const deleteArchivedChatSession = async",
    );
    expect(assistantSource).toContain('.not("archived_at", "is", null)');
    expect(
      createRenamedSessionTitle(
        "  Контекст: Old\n\n[CLIENT_COPY_START]\nMy   renamed   chat\n[CLIENT_COPY_END]  ",
      ),
    ).toBe("My renamed chat");
    expect(createRenamedSessionTitle("   ")).toBeNull();
  });

  it("marks sessions without AI metadata as incomplete while keeping rename/archive/restore", () => {
    expect(assistantSource).toContain("function isIncompleteHistorySession");
    expect(assistantSource).toContain("!session.last_request_type");
    expect(assistantSource).toContain("!session.last_context_scope");
    expect(assistantSource).toContain("!session.last_context_label");
    expect(assistantSource).toContain('t("assistantHistoryNoAiAnswer")');
    expect(assistantSource).toContain("onRename(session.id, nextTitle)");
    expect(assistantSource).toContain("onArchive(session.id)");
    expect(assistantSource).toContain("onRestore(session.id)");
    expect(assistantSource).toContain("setDeleteSessionId(session.id)");
    expect(assistantSource).toContain('view === "archive" ? (');
  });

  it("loads an existing chat into visible messages and keeps bounded follow-up context", () => {
    expect(assistantSource).toContain("const loadChatSession = async");
    expect(assistantSource).toContain(
      '.order("created_at", { ascending: true })',
    );
    expect(assistantSource).toContain("messageFromRow(row, t)");
    expect(assistantSource).toContain("function getSessionContextLabel");
    expect(assistantSource).toContain("optionFromPersistedMetadata");
    expect(assistantSource).toContain("session.last_request_type");
    expect(assistantSource).toContain("return session.last_context_label");
    expect(assistantSource).toContain("setCurrentSessionId(sessionId)");
    expect(assistantSource).toContain(
      "conversation_history: conversationHistory",
    );

    const option =
      OPTIONS.find(
        (item) => item.labelKey === "assistantContextAdsPerformance",
      ) ?? OPTIONS[0];
    const row = {
      id: "m1",
      session_id: "s1",
      workspace_id: "w1",
      user_id: "u1",
      role: "assistant" as const,
      text: "Previous context",
      context_label: "Контекст: Ефективність реклами",
      request_type: option.requestType,
      context_scope: option.contextScope,
      auto_routed: false,
      created_at: "2026-07-10T00:00:00Z",
    };
    const message = messageFromRow(row, ((key: string) => key) as never);
    const history = buildConversationHistory(
      [message],
      ((key: string) => key) as never,
    );
    expect(history[0].text).toBe("Previous context");
    expect(history[0].request_type).toBe(option.requestType);

    const markerMessage = messageFromRow(
      {
        ...row,
        id: "m2",
        text: "[CLIENT_COPY_START]\nClient text\n[CLIENT_COPY_END]",
      },
      ((key: string) => key) as never,
    );
    expect(
      buildConversationHistory(
        [markerMessage],
        ((key: string) => key) as never,
      )[0].text,
    ).toBe("Client text");
  });

  it("hides assistant context chips while preserving user metadata and client-copy behavior", () => {
    expect(assistantSource).not.toContain(
      "mt-2 text-[10px] text-primary-foreground/65",
    );
    expect(assistantSource).not.toContain(
      "mb-2 inline-flex rounded-full bg-muted/70 px-2.5 py-1 text-[11px] text-muted-foreground",
    );
    expect(assistantSource).toContain("stripLeadingContextLabel(answer)");
    expect(assistantSource).toContain("ClientCopyBlock");
    expect(assistantSource).toContain(
      "serializeAnswerForWholeCopy(message.text)",
    );
    expect(assistantSource).toContain('t("assistantClientCopyTitle")');
    expect(assistantSource).toContain('t("assistantClientCopyCopyLabel")');
    expect(assistantSource).not.toContain("Текст для клієнта");
    expect(assistantSource).not.toContain("Скопіювати текст для клієнта");
  });

  it("groups drawer sessions by display recency", () => {
    const base = new Date("2026-07-10T12:00:00Z");
    const mk = (id: string, updated_at: string) => ({
      id,
      workspace_id: "w",
      user_id: "u",
      title: id,
      last_message_preview: null,
      last_context_label: null,
      last_request_type: null,
      last_context_scope: null,
      created_at: updated_at,
      updated_at,
      archived_at: null,
    });
    const grouped = groupSessionsByRecency(
      [
        mk("today", "2026-07-10T08:00:00Z"),
        mk("yesterday", "2026-07-09T08:00:00Z"),
        mk("week", "2026-07-06T08:00:00Z"),
        mk("earlier", "2026-06-28T08:00:00Z"),
      ],
      base,
    );
    expect(grouped.today.map((item) => item.id)).toEqual(["today"]);
    expect(grouped.yesterday.map((item) => item.id)).toEqual(["yesterday"]);
    expect(grouped.lastSevenDays.map((item) => item.id)).toEqual(["week"]);
    expect(grouped.earlier.map((item) => item.id)).toEqual(["earlier"]);
  });
});

it("keeps routing metadata hidden by default but available as admin-only collapsed debug details", () => {
  expect(assistantSource).toContain(
    'role === "admin" || role === "superadmin"',
  );
  expect(assistantSource).toContain("canShowAssistantRoutingDebug");
  expect(assistantSource).toContain("function AssistantRoutingDebug");
  expect(assistantSource).toContain('t("assistantTechnicalDetails")');
  expect(assistantSource).toContain("<details");
  expect(assistantSource).not.toContain("<details open");
  expect(assistantSource).toContain("request_type");
  expect(assistantSource).toContain("context_scope");
  expect(assistantSource).toContain("auto_routed");
  expect(assistantSource).toContain("mode_label");
  expect(assistantSource).not.toContain("JSON.stringify(message");
  expect(assistantSource).not.toContain("raw_context");
  expect(assistantSource).not.toContain("backend_payload");
});
