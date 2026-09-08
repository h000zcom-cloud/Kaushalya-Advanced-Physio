import { AlertCircle, Inbox, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function EmptyState({ icon: Icon = Inbox, title, text, action, className, testId = "empty-state" }) {
  return (
    <div data-testid={testId} className={cn("flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-white/60 px-6 py-12 text-center", className)}>
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-brand-soft text-brand"><Icon className="h-5 w-5" /></div>
      <h3 className="font-admin text-base font-semibold text-foreground">{title}</h3>
      {text && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function LoadingState({ rows = 4, className, label = "Loading" }) {
  return (
    <div role="status" aria-live="polite" aria-label={label} data-testid="loading-state" className={cn("space-y-3", className)}>
      {Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" style={{ opacity: 1 - i * 0.15 }} />)}
    </div>
  );
}

export function ErrorState({ message = "Something went wrong while loading this section.", onRetry, className }) {
  return (
    <div role="alert" data-testid="error-state" className={cn("flex flex-col items-start gap-3 rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-5 text-sm text-[#991B1B]", className)}>
      <div className="flex items-center gap-2 font-medium"><AlertCircle className="h-4 w-4" /> {message}</div>
      {onRetry && <Button type="button" size="sm" variant="outline" onClick={onRetry} data-testid="error-retry-button" className="bg-white"><RefreshCw className="h-3.5 w-3.5" /> Try again</Button>}
    </div>
  );
}

export function Spinner({ className }) {
  return <span aria-hidden className={cn("inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent", className)} />;
}
