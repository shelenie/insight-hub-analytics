import React from "react";
import { QueryClient } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/I18nProvider";
import { translations } from "@/i18n/translations";
import { canRestoreBinding, isActiveBinding } from "@/lib/bindingStatus";
import {
  AdAccountsBusinessTable,
  SourceBindingsBusinessTable,
  formatBindingSourceName,
} from "@/pages/Bindings";
import { workspaceRoleQueryKey } from "@/hooks/useWorkspaceRole";

vi.mock("@/auth/AuthProvider", () => ({ useAuth: () => ({ session: null }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: vi.fn() } } }));

const archivedRow = {
  binding_id: "binding-1",
  source_id: "source-1",
  source_kind: "google_sheet_tab",
  source_name: "google_sheet:insight_hub_dev_google_sheet_template:Реги АВ - БД",
  client_name: "Client A",
  project_name: "Project B",
  funnel_name: "Funnel C",
  mapping_status: "confirmed",
  binding_status: "archived",
  updated_at: "2026-07-13T00:00:00.000Z",
};

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nProvider>{ui}</I18nProvider>);
}

describe("Bindings confirmed UI defects", () => {
  it("translates archived status in Ukrainian and English without exposing the key", () => {
    expect(translations.bindingsStatusArchived.uk).toBe("Архівні");
    expect(translations.bindingsStatusArchived.en).toBe("Archived");
    expect(translations.bindingsStatusArchived.uk).not.toBe("bindingsStatusArchived");
  });

  it("formats Google Sheet tab source names without using the raw technical prefix", () => {
    expect(formatBindingSourceName(archivedRow)).toBe(
      "insight_hub_dev_google_sheet_template · Реги АВ - БД",
    );
  });

  it("renders Client, Project, and Funnel values in inner divs, not clamped table cells", () => {
    const { container } = renderWithI18n(
      <SourceBindingsBusinessTable rows={[archivedRow]} canManage={false} roleLoading={false} onEdit={vi.fn()} onArchive={vi.fn()} onRestore={vi.fn()} />,
    );
    for (const text of ["Client A", "Project B", "Funnel C"]) {
      const div = screen.getByText(text);
      expect(div.tagName).toBe("DIV");
      expect(div).toHaveClass("line-clamp-2");
      expect(div.closest("td")).not.toHaveClass("line-clamp-2");
    }
    expect(container.querySelectorAll("tbody tr:first-child td")).toHaveLength(8);
  });

  it("keeps status and action cells as separate semantic table cells", () => {
    renderWithI18n(
      <AdAccountsBusinessTable
        rows={[{ ...archivedRow, external_account_id: "act_1", external_account_name: "Account" }]}
        canManage={true}
        roleLoading={false}
        onEdit={vi.fn()}
        onArchive={vi.fn()}
        onRestore={vi.fn()}
      />,
    );
    const cells = screen.getAllByRole("cell");
    expect(cells).toHaveLength(9);
    expect(within(cells[6]).getByText("Архівний")).toBeTruthy();
    expect(within(cells[8]).getByRole("button", { name: /відновити/i })).toBeTruthy();
  });

  it("shows a permission-loading placeholder for archived rows and not Read-only", () => {
    renderWithI18n(
      <SourceBindingsBusinessTable rows={[archivedRow]} canManage={false} roleLoading={true} onEdit={vi.fn()} onArchive={vi.fn()} onRestore={vi.fn()} />,
    );
    expect(screen.getByLabelText("Loading permissions")).toBeTruthy();
    expect(screen.queryByText("Лише перегляд")).toBeNull();
  });

  it("shows Restore for authorized users and Read-only for unauthorized users", () => {
    const { rerender } = renderWithI18n(
      <SourceBindingsBusinessTable rows={[archivedRow]} canManage={true} roleLoading={false} onEdit={vi.fn()} onArchive={vi.fn()} onRestore={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: /відновити/i })).toBeTruthy();
    rerender(
      <I18nProvider>
        <SourceBindingsBusinessTable rows={[archivedRow]} canManage={false} roleLoading={false} onEdit={vi.fn()} onArchive={vi.fn()} onRestore={vi.fn()} />
      </I18nProvider>,
    );
    expect(screen.getByText("Лише перегляд")).toBeTruthy();
  });

  it("reuses the same workspace-role query key and creates new keys for session or workspace changes", async () => {
    const queryClient = new QueryClient();
    const queryFn = vi.fn(async () => ({ role: "admin", capabilities: { can_manage_bindings: true } }));
    await queryClient.fetchQuery({ queryKey: workspaceRoleQueryKey("workspace-1", "user-1"), queryFn, staleTime: 5 * 60 * 1000 });
    await queryClient.fetchQuery({ queryKey: workspaceRoleQueryKey("workspace-1", "user-1"), queryFn, staleTime: 5 * 60 * 1000 });
    expect(queryFn).toHaveBeenCalledTimes(1);
    await queryClient.fetchQuery({ queryKey: workspaceRoleQueryKey("workspace-2", "user-1"), queryFn, staleTime: 5 * 60 * 1000 });
    await queryClient.fetchQuery({ queryKey: workspaceRoleQueryKey("workspace-1", "user-2"), queryFn, staleTime: 5 * 60 * 1000 });
    expect(queryFn).toHaveBeenCalledTimes(3);
  });

  it("keeps archive/restore status helpers unchanged", () => {
    expect(isActiveBinding({ binding_status: "active" })).toBe(true);
    expect(canRestoreBinding({ binding_status: "archived" })).toBe(true);
    expect(canRestoreBinding({ binding_status: "paused" })).toBe(false);
  });
});
