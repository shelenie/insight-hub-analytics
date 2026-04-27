import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { suggestedPromptsByLang } from "@/data/mock";
import { fmtCurrency } from "@/lib/format";
import { Sparkles, Send, User, Bot, BarChart3 } from "lucide-react";
import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useI18n } from "@/i18n/I18nProvider";

type Msg =
  | { role: "user" | "assistant"; content: string }
  | { role: "assistant-card"; data: ResponseCardData };

type ResponseCardData = {
  summary: string;
  metrics: { label: string; value: string }[];
  filters: string[];
  chart?: { name: string; value: number }[];
  table?: { campaign: string; roas: number; revenue: number }[];
};

const sampleResponses = {
  uk: {
    summary:
      "За останні 7 днів ROAS виріс на 12% (з 2.48x до 2.78x), завдяки кампаніям Atlas-Search-Brand і Retention-Email-Push. Виторг збільшився на $34,200 при стабільних витратах.",
    metrics: [
      { label: "ROAS", value: "2.78x (+12%)" },
      { label: "Виторг", value: "$512.8k (+7%)" },
      { label: "Витрати", value: "$184.3k (+8%)" },
      { label: "Продажі", value: "612 (+9%)" },
    ],
    filters: ["Останні 7 днів", "Усі проєкти", "Усі групи"],
  },
  en: {
    summary:
      "ROAS grew 12% over the last 7 days (2.48x → 2.78x), driven by Atlas-Search-Brand and Retention-Email-Push. Revenue is up $34,200 while spend stayed flat.",
    metrics: [
      { label: "ROAS", value: "2.78x (+12%)" },
      { label: "Revenue", value: "$512.8k (+7%)" },
      { label: "Spend", value: "$184.3k (+8%)" },
      { label: "Sales", value: "612 (+9%)" },
    ],
    filters: ["Last 7 days", "All projects", "All groups"],
  },
};

const tooltipStyle = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  fontSize: "12px",
};

export default function Assistant() {
  const { t, lang } = useI18n();
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: t("assistantWelcome") },
  ]);
  const [input, setInput] = useState("");

  function buildResponse(): ResponseCardData {
    const base = sampleResponses[lang];
    return {
      ...base,
      chart: [
        { name: "Atlas-Search-Brand", value: 9.48 },
        { name: "Retention-Email-Push", value: 7.24 },
        { name: "EVG-FB-Interest-A", value: 5.06 },
        { name: "WBN-Q4-LAL3", value: 5.02 },
        { name: "Launch-May-IG", value: 3.09 },
      ],
      table: [
        { campaign: "Atlas-Search-Brand", roas: 9.48, revenue: 39800 },
        { campaign: "Retention-Email-Push", roas: 7.24, revenue: 49200 },
        { campaign: "EVG-FB-Interest-A", roas: 5.06, revenue: 71800 },
      ],
    };
  }

  function sendPrompt(text: string) {
    if (!text.trim()) return;
    setMessages((m) => [
      ...m,
      { role: "user", content: text },
      { role: "assistant-card", data: buildResponse() },
    ]);
    setInput("");
  }

  const prompts = suggestedPromptsByLang[lang];

  return (
    <DashboardLayout title={t("assistantTitle")} subtitle={t("assistantSubtitle")}>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        {/* Suggested prompts */}
        <div className="lg:col-span-1 space-y-4">
          <SectionCard title={t("suggestedPrompts")}>
            <div className="flex flex-col gap-2">
              {prompts.map((p) => (
                <button
                  key={p}
                  onClick={() => sendPrompt(p)}
                  className="text-left rounded-md border border-border bg-card px-3 py-2 text-sm transition-colors hover:border-primary/40 hover:bg-primary-soft/40"
                >
                  {p}
                </button>
              ))}
            </div>
          </SectionCard>

          <SectionCard title={t("whatICanDo")}>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li className="flex gap-2"><span className="text-success">✓</span> {t("canAnalyze")}</li>
              <li className="flex gap-2"><span className="text-success">✓</span> {t("canCompare")}</li>
              <li className="flex gap-2"><span className="text-success">✓</span> {t("canSurface")}</li>
              <li className="flex gap-2"><span className="text-destructive">✗</span> {t("cantEdit")}</li>
              <li className="flex gap-2"><span className="text-destructive">✗</span> {t("cantTrigger")}</li>
            </ul>
          </SectionCard>
        </div>

        {/* Chat panel */}
        <SectionCard className="lg:col-span-3 flex flex-col" contentClassName="flex flex-col gap-3">
          <div className="flex h-[60vh] flex-col gap-4 overflow-y-auto pr-1">
            {messages.map((m, i) => {
              if (m.role === "user") {
                return (
                  <div key={i} className="flex items-start gap-2.5 self-end max-w-[85%]">
                    <div className="rounded-2xl rounded-tr-sm bg-primary px-3.5 py-2 text-sm text-primary-foreground">
                      {m.content}
                    </div>
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  </div>
                );
              }
              if (m.role === "assistant") {
                return (
                  <div key={i} className="flex items-start gap-2.5 max-w-[85%]">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-soft">
                      <Bot className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div className="rounded-2xl rounded-tl-sm bg-muted px-3.5 py-2 text-sm">
                      {m.content}
                    </div>
                  </div>
                );
              }
              if (m.role === "assistant-card") {
                return <ResponseCard key={i} data={m.data} />;
              }
              return null;
            })}
          </div>

          {/* Input */}
          <div className="flex items-center gap-2 border-t pt-3">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendPrompt(input)}
              placeholder={t("assistantInputPlaceholder")}
              className="h-10 text-sm"
            />
            <Button onClick={() => sendPrompt(input)} className="h-10 gap-1.5">
              <Send className="h-3.5 w-3.5" />
              {t("send")}
            </Button>
          </div>
        </SectionCard>
      </div>
    </DashboardLayout>
  );
}

function ResponseCard({ data }: { data: ResponseCardData }) {
  const { t } = useI18n();
  return (
    <div className="flex items-start gap-2.5 max-w-full">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-soft">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
      </div>
      <div className="flex-1 space-y-3 rounded-2xl rounded-tl-sm border bg-card p-4 shadow-card">
        {/* Filters */}
        <div>
          <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {t("appliedFilters")}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {data.filters.map((f) => (
              <span key={f} className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {f}
              </span>
            ))}
          </div>
        </div>

        {/* Summary */}
        <p className="text-sm leading-relaxed">{data.summary}</p>

        {/* Key metrics */}
        <div>
          <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {t("keyMetrics")}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {data.metrics.map((m) => (
              <div key={m.label} className="rounded-md border bg-background p-2.5">
                <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{m.label}</div>
                <div className="mt-0.5 text-sm font-semibold num">{m.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Chart */}
        {data.chart && (
          <div>
            <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <BarChart3 className="h-3 w-3" /> {t("supportingChart")} — ROAS
            </div>
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.chart} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} interval={0} angle={-15} textAnchor="end" height={50} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v.toFixed(2)}x`} />
                  <Bar dataKey="value" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Table */}
        {data.table && (
          <div>
            <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {t("topContributors")}
            </div>
            <div className="overflow-hidden rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("thCampaign")}</TableHead>
                    <TableHead className="text-right">{t("thRoas")}</TableHead>
                    <TableHead className="text-right">{t("thRevenue")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.table.map((r) => (
                    <TableRow key={r.campaign}>
                      <TableCell className="font-medium">{r.campaign}</TableCell>
                      <TableCell className="text-right num">{r.roas.toFixed(2)}x</TableCell>
                      <TableCell className="text-right num">{fmtCurrency(r.revenue)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
