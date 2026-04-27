import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { suggestedPrompts, aiChatSeed } from "@/data/mock";
import { fmtCurrency, fmtNum } from "@/lib/format";
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

const sampleResponse: ResponseCardData = {
  summary:
    "За останні 7 днів ROAS виріс на 12% (з 2.48x до 2.78x), завдяки кампаніям Atlas-Search-Brand та Retention-Email-Push. Виторг збільшився на $34,200, при цьому витрати залишились стабільними.",
  metrics: [
    { label: "ROAS", value: "2.78x (+12%)" },
    { label: "Revenue", value: "$512.8k (+7%)" },
    { label: "Spend", value: "$184.3k (+8%)" },
    { label: "Sales", value: "612 (+9%)" },
  ],
  filters: ["Last 7 days", "All projects", "All report groups"],
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

const tooltipStyle = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  fontSize: "12px",
};

export default function Assistant() {
  const [messages, setMessages] = useState<Msg[]>(aiChatSeed);
  const [input, setInput] = useState("");

  function sendPrompt(text: string) {
    if (!text.trim()) return;
    setMessages((m) => [
      ...m,
      { role: "user", content: text },
      { role: "assistant-card", data: sampleResponse },
    ]);
    setInput("");
  }

  return (
    <DashboardLayout
      title="AI Assistant"
      subtitle="Internal analytics assistant — read-only, works on prepared fact data"
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        {/* Suggested prompts */}
        <div className="lg:col-span-1 space-y-4">
          <SectionCard title="Suggested prompts">
            <div className="flex flex-col gap-2">
              {suggestedPrompts.map((p) => (
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

          <SectionCard title="What I can do">
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li className="flex gap-2"><span className="text-success">✓</span> Analyze prepared fact tables</li>
              <li className="flex gap-2"><span className="text-success">✓</span> Compare periods & cohorts</li>
              <li className="flex gap-2"><span className="text-success">✓</span> Surface anomalies & trends</li>
              <li className="flex gap-2"><span className="text-destructive">✗</span> Edit raw data or mappings</li>
              <li className="flex gap-2"><span className="text-destructive">✗</span> Trigger destructive actions</li>
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
              // assistant-card
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
              placeholder="Запитай про метрики, тренди або кампанії…"
              className="h-10 text-sm"
            />
            <Button onClick={() => sendPrompt(input)} className="h-10 gap-1.5">
              <Send className="h-3.5 w-3.5" />
              Send
            </Button>
          </div>
        </SectionCard>
      </div>
    </DashboardLayout>
  );
}

function ResponseCard({ data }: { data: ResponseCardData }) {
  return (
    <div className="flex items-start gap-2.5 max-w-full">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-soft">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
      </div>
      <div className="flex-1 space-y-3 rounded-2xl rounded-tl-sm border bg-card p-4 shadow-card">
        {/* Filters */}
        <div className="flex flex-wrap gap-1.5">
          {data.filters.map((f) => (
            <span key={f} className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {f}
            </span>
          ))}
        </div>

        {/* Summary */}
        <p className="text-sm leading-relaxed">{data.summary}</p>

        {/* Key metrics */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {data.metrics.map((m) => (
            <div key={m.label} className="rounded-md border bg-background p-2.5">
              <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{m.label}</div>
              <div className="mt-0.5 text-sm font-semibold num">{m.value}</div>
            </div>
          ))}
        </div>

        {/* Chart */}
        {data.chart && (
          <div>
            <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <BarChart3 className="h-3 w-3" /> Supporting chart — ROAS by campaign
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
              Top contributors
            </div>
            <div className="overflow-hidden rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaign</TableHead>
                    <TableHead className="text-right">ROAS</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
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
