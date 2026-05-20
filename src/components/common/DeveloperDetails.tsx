import { ReactNode } from "react";

type DeveloperDetailsProps = {
  title?: string;
  children: ReactNode;
};

function isDebugMode() {
  if (typeof window === "undefined") return false;
  const byQuery = new URLSearchParams(window.location.search).get("debug") === "1";
  const byStorage = window.localStorage.getItem("insightHubDebug") === "true";
  return byQuery || byStorage;
}

export function DeveloperDetails({ title = "Developer details", children }: DeveloperDetailsProps) {
  if (!isDebugMode()) return null;

  return (
    <details className="mt-2 rounded-md border border-border/60 bg-muted/30 p-3 text-xs">
      <summary className="cursor-pointer font-medium text-muted-foreground">{title}</summary>
      <div className="mt-2 text-muted-foreground">{children}</div>
    </details>
  );
}

export function FriendlyError({ message = "Цей розділ поки недоступний.", technical }: { message?: string; technical?: string | null }) {
  return (
    <div className="rounded-md border border-warning/30 bg-warning-soft p-3 text-sm text-warning-foreground">
      <p>{message}</p>
      {technical ? <DeveloperDetails title="Technical details"><p className="break-words">{technical}</p></DeveloperDetails> : null}
    </div>
  );
}
