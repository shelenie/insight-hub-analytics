import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const edgeFunctionSource = readFileSync(
  "supabase/functions/ai-helper-run/index.ts",
  "utf8",
);
const playbookSource = readFileSync(
  "supabase/functions/ai-helper-run/playbooks.ts",
  "utf8",
);

describe("ai-helper-run code-versioned analysis playbooks", () => {
  it("always includes safety/evidence and uses selected playbooks in prompt building", () => {
    expect(playbookSource).toContain("PLAYBOOK_SAFETY_AND_EVIDENCE");
    expect(playbookSource).toContain(
      "const selected: AnalysisPlaybook[] = [PLAYBOOK_SAFETY_AND_EVIDENCE]",
    );
    expect(edgeFunctionSource).toContain(
      "formatPlaybooksForPrompt(selectedPlaybooks)",
    );
    expect(edgeFunctionSource).toContain(
      "selected_playbooks: getPlaybookIds(selectedPlaybooks)",
    );
  });

  it("selects playbooks by request without injecting CMO/CFO into ads health by default", () => {
    expect(playbookSource).toContain(
      'request.includes("ads_health") || scope.includes("ads_health")',
    );
    expect(playbookSource).toContain("add(PLAYBOOK_DATA_READINESS)");
    expect(playbookSource).toContain('request.includes("ads_performance")');
    expect(playbookSource).toContain('scope.includes("ads_performance")');
    expect(playbookSource).toContain("add(PLAYBOOK_CMO_CAMPAIGN_DIAGNOSIS)");
    expect(playbookSource).toContain("add(PLAYBOOK_CFO_BUDGET_EFFICIENCY)");
  });

  it("adds anomaly, data-quality, client communication, and operations readiness playbooks", () => {
    expect(playbookSource).toContain("PLAYBOOK_ADS_ANOMALY_REVIEW");
    expect(playbookSource).toContain(
      "current anomaly/drop analysis is blocked or unreliable",
    );
    expect(playbookSource).toContain("PLAYBOOK_DATA_QUALITY_IMPORT_REVIEW");
    expect(playbookSource).toContain("rejected rows");
    expect(playbookSource).toContain("PLAYBOOK_CLIENT_COMMUNICATION");
    expect(playbookSource).toContain("що сказати клієнту");
    expect(playbookSource).toContain("PLAYBOOK_OPERATIONS_READINESS");
  });

  it("keeps CFO and CMO production guardrails", () => {
    expect(playbookSource).toContain("every dollar has opportunity cost");
    expect(playbookSource).toContain("spend efficiency");
    expect(playbookSource).toContain("CPL efficiency");
    expect(playbookSource).toContain(
      "Do not invent revenue, margin, ROAS, LTV, CAC payback, payback period",
    );
    expect(playbookSource).toContain("audience quality");
    expect(playbookSource).toContain("creative fatigue");
    expect(playbookSource).toContain("offer-message fit");
    expect(playbookSource).toContain("funnel step");
    expect(playbookSource).toContain("landing page/form");
    expect(playbookSource).toContain("tracking");
    expect(playbookSource).toContain("lead quality");
  });

  it("keeps Ukrainian wording guidance and response token limit", () => {
    expect(playbookSource).toContain("витрати / ліди");
    expect(playbookSource).toContain("права доступу / відмова в доступі");
    expect(playbookSource).toContain("Звʼязки даних");
    expect(edgeFunctionSource).toContain("max_output_tokens: 2200");
  });
});
