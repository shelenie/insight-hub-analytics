import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const bindingsSource = readFileSync(resolve(process.cwd(), "src/pages/Bindings.tsx"), "utf8");
const appSource = readFileSync(resolve(process.cwd(), "src/App.tsx"), "utf8");
const sidebarSource = readFileSync(resolve(process.cwd(), "src/components/layout/AppSidebar.tsx"), "utf8");
const translationsSource = readFileSync(resolve(process.cwd(), "src/i18n/translations.ts"), "utf8");

describe("Bindings ads multi-account readiness", () => {
  it("calls the backend readiness RPC from the existing Bindings query", () => {
    expect(bindingsSource).toContain("readAdsMultiAccountReadiness()");
    expect(bindingsSource).toContain("supabase.rpc(");
    expect(bindingsSource).toContain('"build_ads_multi_account_readiness"');
    expect(bindingsSource).toContain("adsMultiAccountReadiness");
  });

  it("renders readiness only inside existing Bindings tabs without new navigation", () => {
    expect(bindingsSource).toContain('<TabsContent value="overview"');
    expect(bindingsSource).toContain("<AdsBindingReadinessSummary");
    expect(bindingsSource).toContain("readiness={query.data?.adsMultiAccountReadiness}");
    expect(bindingsSource).toContain('<TabsContent value="ad-account"');
    expect(bindingsSource).toContain("<BindingGapsPanel");
    expect(bindingsSource).toContain('<TabsContent value="health"');
    expect(bindingsSource).toContain('t("bindingsAdsReadinessTechnicalTitle")');
    expect(bindingsSource).not.toContain('value="ads-readiness"');
    expect(bindingsSource).not.toContain('value="multi-account-readiness"');
    expect(appSource).not.toContain('path="/ads-readiness"');
    expect(sidebarSource).not.toContain('/ads-readiness');
  });

  it("reads counters from the nested summary payload", () => {
    expect(bindingsSource).toContain('const summary = readObject(payload, "summary");');
    expect(bindingsSource).toContain('readNumber(summary, "total_accounts")');
    expect(bindingsSource).toContain('readNumber(summary, "bound_accounts")');
    expect(bindingsSource).toContain('readNumber(summary, "unbound_accounts")');
    expect(bindingsSource).toContain('readNumber(summary, "needs_attention_count")');
    expect(bindingsSource).not.toContain('readNumber(payload, "total_accounts")');
  });

  it("renders binding gap rows from payload.binding_gaps with the required columns", () => {
    expect(bindingsSource).toContain('const gapRows = readArray(readiness.payload, "binding_gaps");');
    ["gap_type", "platform", "external_account_name", "external_account_id", "message", "next_action"].forEach((column) =>
      expect(bindingsSource).toContain(`"${column}"`),
    );
  });

  it("keeps readiness unavailable state graceful and localized", () => {
    expect(bindingsSource).toContain("ReadinessUnavailableNotice");
    expect(bindingsSource).toContain('t("bindingsAdsReadinessUnavailable")');
    expect(translationsSource).toContain("Ad account binding readiness is temporarily unavailable");
  });
});
