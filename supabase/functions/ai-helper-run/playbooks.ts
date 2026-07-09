export type AnalysisPlaybook = {
  id: string;
  version: string;
  applies_to: string[];
  instructions: string[];
};

const includesAny = (value: string, terms: RegExp[]) =>
  terms.some((term) => term.test(value));
const normalize = (value: string) => value.toLowerCase().replace(/[’']/g, "ʼ");

export const PLAYBOOK_SAFETY_AND_EVIDENCE: AnalysisPlaybook = {
  id: "PLAYBOOK_SAFETY_AND_EVIDENCE",
  version: "2026-07-09.1",
  applies_to: ["all"],
  instructions: [
    "Use only provided JSON context; never invent metrics, periods, campaign names, client names, revenue, ROAS, causes, attribution, or actions.",
    "Separate facts from hypotheses and clearly label what needs verification.",
    "Do not use fake action language such as I fixed, I synced, I paused, or I changed.",
    "Never expose secrets, tokens, API keys, or private credentials.",
    "Do not expose raw backend field names in the main answer unless explicitly requested; translate operational backend fields into user-facing language.",
    "If data are stale, missing, fallback, or imported, say so clearly.",
    "Ukrainian wording: prefer витрати / ліди, права доступу / відмова в доступі, акаунти без витрат або лідів, свіжі дані / поточні дані, привʼязки, and Звʼязки даних.",
    "Avoid бо є немає and avoid mixed English/Ukrainian operational phrasing unless it is a platform name or common metric like CPL / API.",
  ],
};

export const PLAYBOOK_DATA_READINESS: AnalysisPlaybook = {
  id: "PLAYBOOK_DATA_READINESS",
  version: "2026-07-09.1",
  applies_to: [
    "ads_health",
    "ads_performance",
    "ads_anomalies",
    "data_quality_when_freshness_relevant",
  ],
  instructions: [
    "Inspect available period and latest date; say whether data are fresh enough for current or last-7-days analysis.",
    "Distinguish historical imported data from current/live API source and do not claim live API health unless context explicitly allows it.",
    "Mention access/sync blockers, account binding gaps, and test/no-spend account possibility when context indicates it.",
    "Do not say no data when historical/imported/fallback data exist; use історичні імпортовані дані instead of platform=other.",
    "Use свіжі дані / поточні дані instead of unnecessary fresh data.",
  ],
};

export const PLAYBOOK_CMO_CAMPAIGN_DIAGNOSIS: AnalysisPlaybook = {
  id: "PLAYBOOK_CMO_CAMPAIGN_DIAGNOSIS",
  version: "2026-07-09.1",
  applies_to: ["ads_performance", "ads_anomalies_hypothesis_lens"],
  instructions: [
    "Inspect marketing reasons: audience quality, creative fatigue, offer-message fit, message-market fit, funnel step, landing page/form, tracking, lead quality, retargeting exhaustion, campaign structure, and attribution gaps.",
    "Separate data facts from marketing hypotheses and do not overstate cause.",
    "Say what the marketing team should inspect first.",
    "Avoid recommending budget moves without data support.",
  ],
};

export const PLAYBOOK_CFO_BUDGET_EFFICIENCY: AnalysisPlaybook = {
  id: "PLAYBOOK_CFO_BUDGET_EFFICIENCY",
  version: "2026-07-09.1",
  applies_to: ["ads_performance", "budget_impact_anomalies"],
  instructions: [
    "Use CFO principles adapted to ads analytics: cash/runway awareness when relevant, every dollar has opportunity cost, simplicity over overbuilt models, and finance enables decisions rather than blocking operations.",
    "Inspect wasted spend risk, CPL efficiency, spend efficiency, spend concentration, spend without leads, opportunity cost, and where to protect, reduce, pause, or reallocate budget.",
    "Check whether high spend is justified by lead volume / CPL and whether a stronger financial claim requires revenue, margin, or ROAS.",
    "Inspect unit economics such as CAC, LTV, and payback period only when context provides those data.",
    "Do not invent revenue, margin, ROAS, LTV, CAC payback, payback period, board/investor implications, fundraising, dilution, layoffs, debt/equity, M&A, compensation, or covenant claims unless these data exist in context.",
  ],
};

export const PLAYBOOK_ADS_ANOMALY_REVIEW: AnalysisPlaybook = {
  id: "PLAYBOOK_ADS_ANOMALY_REVIEW",
  version: "2026-07-09.1",
  applies_to: ["ads_anomaly_explanation", "ads_anomalies"],
  instructions: [
    "Analyze drops/spikes only when data freshness supports it; if fresh data are missing, say current anomaly/drop analysis is blocked or unreliable.",
    "Do not invent current drops; historical anomalies may be mentioned only as historical context.",
    "Distinguish metric anomaly from source/data freshness issue.",
    "Explain whether the issue is performance-related or data-readiness-related.",
  ],
};

export const PLAYBOOK_DATA_QUALITY_IMPORT_REVIEW: AnalysisPlaybook = {
  id: "PLAYBOOK_DATA_QUALITY_IMPORT_REVIEW",
  version: "2026-07-09.1",
  applies_to: ["data_quality_summary", "data_quality", "import_health"],
  instructions: [
    "Inspect rejected rows, import health, mapping issues, raw/staging/processed data quality, source freshness, and source consistency.",
    "Inspect date normalization, number/currency normalization, duplicate rows, missing fields, and transformation errors.",
    "Do not turn every data quality question into ads connector health.",
    "If ads freshness is the main data quality issue, explain it as a data quality/freshness issue.",
    "If context has not enough detail, say what is missing instead of inventing.",
  ],
};

export const PLAYBOOK_CLIENT_COMMUNICATION: AnalysisPlaybook = {
  id: "PLAYBOOK_CLIENT_COMMUNICATION",
  version: "2026-07-09.1",
  applies_to: ["client_communication"],
  instructions: [
    "Produce client-safe language that can be copied.",
    "Avoid raw backend terms; separate what is known from what is being checked.",
    "Do not overpromise fixes and do not use blamey wording.",
    "Keep it practical and transparent.",
  ],
};

export const PLAYBOOK_OPERATIONS_READINESS: AnalysisPlaybook = {
  id: "PLAYBOOK_OPERATIONS_READINESS",
  version: "2026-07-09.1",
  applies_to: [
    "full_production",
    "production_readiness",
    "onboarding",
    "mapping",
    "alerts",
    "import_contexts",
  ],
  instructions: [
    "Focus on actionability: what is ready, blocked, and needs review.",
    "Do not force ads/CPL/CMO/CFO sections when not relevant.",
    "Keep admin next steps clear.",
  ],
};

const ALL_PLAYBOOKS = [
  PLAYBOOK_SAFETY_AND_EVIDENCE,
  PLAYBOOK_DATA_READINESS,
  PLAYBOOK_CMO_CAMPAIGN_DIAGNOSIS,
  PLAYBOOK_CFO_BUDGET_EFFICIENCY,
  PLAYBOOK_ADS_ANOMALY_REVIEW,
  PLAYBOOK_DATA_QUALITY_IMPORT_REVIEW,
  PLAYBOOK_CLIENT_COMMUNICATION,
  PLAYBOOK_OPERATIONS_READINESS,
] as const;

export function getPlaybooksForRequest(params: {
  requestType: string;
  contextScope: string;
  userPrompt: string;
}) {
  const request = normalize(params.requestType);
  const scope = normalize(params.contextScope);
  const prompt = normalize(params.userPrompt);
  const selected: AnalysisPlaybook[] = [PLAYBOOK_SAFETY_AND_EVIDENCE];
  const add = (playbook: AnalysisPlaybook) => {
    if (!selected.some((item) => item.id === playbook.id))
      selected.push(playbook);
  };

  const asksClientCommunication = includesAny(prompt, [
    /що сказати клієнту/,
    /поясни клієнту/,
    /client update|client-ready/,
    /для клієнта/,
    /як сформулювати/,
  ]);
  const budgetImpact = includesAny(`${prompt} ${request} ${scope}`, [
    /budget|бюджет|spend|витрат|cpl|cac|ltv|payback|roas|ефективн/,
  ]);
  const freshnessRelevant = includesAny(`${prompt} ${request} ${scope}`, [
    /fresh|свіж|поточн|source|джерел|sync|синхрон|readiness|готовн|access|доступ/,
  ]);

  if (request.includes("ads_health") || scope.includes("ads_health"))
    add(PLAYBOOK_DATA_READINESS);
  else if (
    request.includes("ads_performance") ||
    scope.includes("ads_performance")
  ) {
    add(PLAYBOOK_DATA_READINESS);
    add(PLAYBOOK_CMO_CAMPAIGN_DIAGNOSIS);
    add(PLAYBOOK_CFO_BUDGET_EFFICIENCY);
  } else if (request.includes("ads_anomaly") || scope.includes("ads_anomal")) {
    add(PLAYBOOK_DATA_READINESS);
    add(PLAYBOOK_ADS_ANOMALY_REVIEW);
    add(PLAYBOOK_CMO_CAMPAIGN_DIAGNOSIS);
    if (budgetImpact) add(PLAYBOOK_CFO_BUDGET_EFFICIENCY);
  } else if (
    request.includes("data_quality") ||
    scope.includes("data_quality")
  ) {
    add(PLAYBOOK_DATA_QUALITY_IMPORT_REVIEW);
    if (freshnessRelevant) add(PLAYBOOK_DATA_READINESS);
  } else if (
    request.includes("import_health") ||
    scope.includes("import_health")
  ) {
    add(PLAYBOOK_DATA_QUALITY_IMPORT_REVIEW);
  } else if (
    request.includes("full_production") ||
    scope.includes("full_production") ||
    request.includes("production_readiness") ||
    scope.includes("production_readiness") ||
    request.includes("onboarding") ||
    scope.includes("onboarding") ||
    request.includes("mapping") ||
    scope.includes("mapping") ||
    request.includes("alerts") ||
    scope.includes("alerts")
  ) {
    add(PLAYBOOK_OPERATIONS_READINESS);
  }

  if (asksClientCommunication) add(PLAYBOOK_CLIENT_COMMUNICATION);
  return selected;
}

export function formatPlaybooksForPrompt(playbooks: AnalysisPlaybook[]) {
  return playbooks
    .map((playbook) =>
      [
        `[${playbook.id} v${playbook.version}]`,
        `Applies to: ${playbook.applies_to.join(", ")}`,
        ...playbook.instructions.map((line) => `- ${line}`),
      ].join("\n"),
    )
    .join("\n\n");
}

export function getPlaybookIds(playbooks: AnalysisPlaybook[]) {
  return playbooks.map((playbook) => playbook.id);
}

export function getAllPlaybooksForTests() {
  return [...ALL_PLAYBOOKS];
}
