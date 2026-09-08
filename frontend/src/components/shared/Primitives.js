import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";

export function PageHeader({ title, description, actions, className, testId = "page-header" }) {
  return (
    <div data-testid={testId} className={cn("mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div>
        <h1 className="font-admin text-2xl font-bold tracking-tight text-foreground">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function DemoBadge({ className }) {
  return <span data-testid="demo-badge" className={cn("inline-flex items-center rounded-full border border-dashed border-clay/50 bg-clay-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-clay", className)}>Demo content</span>;
}

export function PersonAvatar({ name, photoUrl, size = "md", className }) {
  const sizes = { sm: "h-9 w-9 text-xs", md: "h-12 w-12 text-sm", lg: "h-20 w-20 text-xl", xl: "h-28 w-28 text-2xl" };
  if (photoUrl) return <img src={photoUrl} alt={name} loading="lazy" className={cn("rounded-full object-cover", sizes[size], className)} />;
  return <div aria-hidden className={cn("flex items-center justify-center rounded-full bg-brand-soft font-serif font-semibold text-brand", sizes[size], className)}>{initials(name)}</div>;
}

export function Field({ label, htmlFor, error, hint, required, children, className }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && <label htmlFor={htmlFor} className="block text-sm font-medium text-foreground">{label}{required && <span className="ml-0.5 text-clay" aria-hidden>*</span>}</label>}
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p role="alert" className="text-xs font-medium text-destructive" data-testid={`${htmlFor}-error`}>{error}</p>}
    </div>
  );
}
