import React from "react";
import { QueryClient } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/I18nProvider";
import { translations } from "@/i18n/translations";
import { canRestoreBinding, isActiveBinding } from "@/lib/bindingStatus";
import {
  AdAccountsBusinessTable,
  ArchiveBindingDialog,
  BindingRowActions,
  RestoreBindingDialog,
  SourceBindingsBusinessTable,
  formatBindingSourceName,
} from "@/pages/Bindings";
import { workspaceRoleQueryKey } from "@/hooks/useWorkspaceRole";

vi.mock("@/auth/AuthProvider", () => ({ useAuth: () => ({ session: null }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: vi.fn() } } }));

const activeRow = {
  binding_id: "binding-active",
  source_id: "source-active",
  source_kind: "google_sheet_tab",
  source_name: "google_sheet:insight_hub_dev_google_sheet_template:Реги АВ - БД",
  client_name: "Client A",
  project_name: "Project B",
  funnel_name: "Funnel C",
  mapping_status: "confirmed",
  binding_status: "active",
  updated_at: "2026-07-13T14:28:00.000Z",
};

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



  it("uses fixed-pixel Source table columns with a flexible primary column", () => {
    const { container } = renderWithI18n(
      <SourceBindingsBusinessTable rows={[activeRow]} canManage={true} roleLoading={false} onEdit={vi.fn()} onArchive={vi.fn()} onRestore={vi.fn()} />,
    );
    const table = container.querySelector("table") as HTMLTableElement;
    expect(table).toHaveClass("w-full", "min-w-[990px]", "table-fixed");
    const columns = Array.from(container.querySelectorAll("col"));
    expect(columns[0].getAttribute("style") ?? "").toBe("");
    expect(columns.slice(1).map((col) => col.getAttribute("style"))).toEqual([
      "width: 110px;",
      "width: 100px;",
      "width: 100px;",
      "width: 115px;",
      "width: 80px;",
      "width: 95px;",
      "width: 150px;",
    ]);
    expect(container.innerHTML).not.toContain("%");
  });

  it("uses fixed-pixel Ad Account table columns with separate Platform and Client columns", () => {
    const { container } = renderWithI18n(
      <AdAccountsBusinessTable rows={[{ ...activeRow, external_account_id: "act_1", external_account_name: "Account", platform: "meta" }]} canManage={true} roleLoading={false} onEdit={vi.fn()} onArchive={vi.fn()} onRestore={vi.fn()} />,
    );
    const table = container.querySelector("table") as HTMLTableElement;
    expect(table).toHaveClass("w-full", "min-w-[1030px]", "table-fixed");
    const columns = Array.from(container.querySelectorAll("col"));
    expect(columns[0].getAttribute("style") ?? "").toBe("");
    expect(columns.slice(1).map((col) => col.getAttribute("style"))).toEqual([
      "width: 85px;",
      "width: 95px;",
      "width: 95px;",
      "width: 95px;",
      "width: 115px;",
      "width: 80px;",
      "width: 95px;",
      "width: 150px;",
    ]);
    expect(container.innerHTML).not.toContain("%");
  });

  it("renders active Source actions as compact full-width action buttons", () => {
    const { container } = renderWithI18n(
      <SourceBindingsBusinessTable rows={[activeRow]} canManage={true} roleLoading={false} onEdit={vi.fn()} onArchive={vi.fn()} onRestore={vi.fn()} />,
    );
    const actionContainer = container.querySelector("td:last-child > div");
    expect(actionContainer).toHaveClass("flex", "w-full", "flex-col", "items-stretch", "gap-2");
    expect(actionContainer).not.toHaveClass("items-start", "flex-wrap");
    const buttons = within(actionContainer as HTMLElement).getAllByRole("button");
    expect(buttons).toHaveLength(2);
    for (const button of buttons) expect(button).toHaveClass("w-full", "max-w-full", "justify-center", "whitespace-nowrap", "h-8");
  });

  it("renders active Ad Account actions through the same fixed-width shared component classes", () => {
    const { container } = renderWithI18n(
      <AdAccountsBusinessTable rows={[{ ...activeRow, external_account_id: "act_1", external_account_name: "Account", platform: "meta" }]} canManage={true} roleLoading={false} onEdit={vi.fn()} onArchive={vi.fn()} onRestore={vi.fn()} />,
    );
    const actionContainer = container.querySelector("td:last-child > div");
    expect(actionContainer).toHaveClass("flex", "w-full", "flex-col", "items-stretch", "gap-2");
    expect(actionContainer).not.toHaveClass("items-start", "flex-wrap");
  });

  it("keeps existing archive and restore callbacks wired to the selected row", () => {
    const onEdit = vi.fn();
    const onArchive = vi.fn();
    const onRestore = vi.fn();
    const { rerender } = renderWithI18n(
      <BindingRowActions row={activeRow} canManage={true} roleLoading={false} onEdit={onEdit} onArchive={onArchive} onRestore={onRestore} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /переприв/i }));
    fireEvent.click(screen.getByRole("button", { name: /архівувати/i }));
    expect(onEdit).toHaveBeenCalledWith(activeRow);
    expect(onArchive).toHaveBeenCalledWith(activeRow);

    rerender(<I18nProvider><BindingRowActions row={archivedRow} canManage={true} roleLoading={false} onEdit={onEdit} onArchive={onArchive} onRestore={onRestore} /></I18nProvider>);
    fireEvent.click(screen.getByRole("button", { name: /відновити/i }));
    expect(onRestore).toHaveBeenCalledWith(archivedRow);
  });

  it("uses the same action container for archived Restore, permission loading, and Read-only", () => {
    const { container, rerender } = renderWithI18n(
      <BindingRowActions row={archivedRow} canManage={true} roleLoading={false} onEdit={vi.fn()} onArchive={vi.fn()} onRestore={vi.fn()} />,
    );
    let actionContainer = container.firstElementChild as HTMLElement;
    expect(actionContainer).toHaveClass("flex", "w-full", "flex-col", "items-stretch");
    expect(screen.getByRole("button", { name: /відновити/i })).toHaveClass("w-full", "max-w-full", "justify-center", "whitespace-nowrap", "h-8");
    rerender(<I18nProvider><BindingRowActions row={activeRow} canManage={false} roleLoading={true} onEdit={vi.fn()} onArchive={vi.fn()} onRestore={vi.fn()} /></I18nProvider>);
    actionContainer = container.firstElementChild as HTMLElement;
    expect(actionContainer).toHaveClass("w-full");
    expect(screen.getByLabelText("Loading permissions")).toHaveClass("w-full", "max-w-full", "h-8");
    rerender(<I18nProvider><BindingRowActions row={activeRow} canManage={false} roleLoading={false} onEdit={vi.fn()} onArchive={vi.fn()} onRestore={vi.fn()} /></I18nProvider>);
    expect(screen.getByText("Лише перегляд")).toHaveClass("w-full");
  });

  it("renders Updated timestamps as separate date and time lines without nowrap cells", () => {
    const { container } = renderWithI18n(
      <SourceBindingsBusinessTable rows={[activeRow]} canManage={false} roleLoading={false} onEdit={vi.fn()} onArchive={vi.fn()} onRestore={vi.fn()} />,
    );
    const updatedCell = container.querySelector("tbody td:nth-child(7)") as HTMLElement;
    expect(updatedCell).not.toHaveClass("whitespace-nowrap");
    expect(within(updatedCell).getByText("13.07.2026")).toBeTruthy();
    expect(within(updatedCell).getByText(/17:28|16:28/)).toBeTruthy();
    expect(updatedCell.querySelector("[title]")?.getAttribute("title")).toContain("13.07.2026");
  });

  it("uses friendly source names in archive and restore dialogs without primary raw google_sheet prefix", () => {
    renderWithI18n(
      <>
        <ArchiveBindingDialog target={{ row: archivedRow, type: "source" }} pending={false} onCancel={vi.fn()} onConfirm={vi.fn()} />
        <RestoreBindingDialog target={{ row: archivedRow, type: "source" }} pending={false} onCancel={vi.fn()} onConfirm={vi.fn()} />
      </>,
    );
    const friendly = screen.getAllByText("insight_hub_dev_google_sheet_template · Реги АВ - БД");
    expect(friendly).toHaveLength(2);
    expect(screen.queryByText(/^google_sheet:/)).toBeNull();
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
