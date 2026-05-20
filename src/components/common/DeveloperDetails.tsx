import { ReactNode } from "react";

type DeveloperDetailsProps = {
  title?: string;
  children: ReactNode;
};

export function DeveloperDetails({ title = "Developer details", children }: DeveloperDetailsProps) {
  return (
    <details className="mt-2 rounded-md border border-border/60 bg-muted/30 p-3 text-xs">
      <summary className="cursor-pointer font-medium text-muted-foreground">{title}</summary>
      <div className="mt-2 text-muted-foreground">{children}</div>
    </details>
  );
}

export function FriendlyError({ message = "Could not load this section yet.", technical }: { message?: string; technical?: string | null }) {
  return (
    <div className="rounded-md border border-warning/30 bg-warning-soft p-3 text-sm text-warning-foreground">
      <p>{message}</p>
      {technical ? <DeveloperDetails title="Technical details"><p className="break-words">{technical}</p></DeveloperDetails> : null}
    </div>
  );
}
