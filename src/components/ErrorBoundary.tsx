import { Component, type ErrorInfo, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught render error", error, errorInfo);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    const isDebugMode =
      typeof window !== "undefined" &&
      (new URLSearchParams(window.location.search).get("debug") === "1" ||
        window.localStorage.getItem("insightHubDebug") === "true");

    return (
      <div className="min-h-screen bg-background bg-hero p-4 lg:p-8">
        <div className="mx-auto max-w-2xl rounded-lg border border-border/70 bg-card/70 p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Сторінку не вдалося відкрити.</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Спробуйте оновити сторінку або повернутися до огляду.
          </p>
          <div className="mt-4 flex items-center gap-2">
            <Button onClick={() => window.location.reload()}>Оновити сторінку</Button>
            <Button asChild variant="outline">
              <Link to="/">Повернутися до огляду</Link>
            </Button>
          </div>
          {isDebugMode ? (
          <details className="mt-4 rounded-md border border-border/60 bg-card/50 p-3 text-xs">
            <summary className="cursor-pointer font-medium">Технічні деталі</summary>
            <p className="mt-2 break-words text-muted-foreground">
              {this.state.error?.stack ?? this.state.error?.message ?? "Unknown rendering error"}
            </p>
          </details>
          ) : null}
        </div>
      </div>
    );
  }
}
