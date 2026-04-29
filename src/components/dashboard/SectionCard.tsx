import { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface SectionCardProps {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  noPadding?: boolean;
  /** Adds a subtle accent top line — use for hero/insight cards */
  accent?: boolean;
}

export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
  contentClassName,
  noPadding,
  accent,
}: SectionCardProps) {
  return (
    <Card
      className={cn(
        "border-border/70 bg-card shadow-card transition-shadow hover:shadow-card-md",
        accent && "ring-accent-top",
        className,
      )}
    >
      {(title || actions) && (
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 border-b border-border/60 pb-3 pt-3.5">
          <div className="min-w-0">
            {title && (
              <CardTitle className="text-[14px] font-semibold tracking-tight">{title}</CardTitle>
            )}
            {description && (
              <CardDescription className="mt-0.5 text-[11.5px] text-muted-foreground">
                {description}
              </CardDescription>
            )}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </CardHeader>
      )}
      <CardContent className={cn(!noPadding && "p-4", noPadding && "p-0", contentClassName)}>
        {children}
      </CardContent>
    </Card>
  );
}
