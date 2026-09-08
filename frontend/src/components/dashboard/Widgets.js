import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DemoBadge } from "@/components/shared/Primitives";
import { EmptyState } from "@/components/shared/States";
import { useAppointmentDrawer } from "@/components/dashboard/AppointmentDrawer";
import { displayPhone, formatDate, formatSlot, fromNow } from "@/lib/format";
import { cn } from "@/lib/utils";

export function StatTile({ label, value, hint, tone = "default", to, testId }) {
  const Comp = to ? Link : "div";
  return (
    <Comp to={to} data-testid={testId} className={cn("flex flex-col rounded-xl border border-border bg-white p-4 transition-colors", to && "hover:border-brand/40", tone === "alert" && value > 0 && "border-[#FDE68A] bg-[#FFFBEB]")}>
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="mt-2 font-admin text-3xl font-bold tabular-nums text-foreground">{value ?? "—"}</span>
      {hint && <span className="mt-1 text-xs text-muted-foreground">{hint}</span>}
    </Comp>
  );
}

export function AppointmentTable({ items, emptyTitle = "No appointments", emptyText, dense = false, showDate = true }) {
  const { openAppointment } = useAppointmentDrawer();
  if (!items?.length) return <EmptyState title={emptyTitle} text={emptyText} testId="appointments-empty" />;
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-white">
      <table className="admin-table w-full min-w-[720px]" data-testid="appointments-table">
        <thead className="border-b border-border bg-muted/50"><tr><th>ID</th><th>Patient</th>{showDate && <th>Date</th>}<th>Time</th><th>Service</th><th>Doctor</th><th>Status</th></tr></thead>
        <tbody className="divide-y divide-border">
          {items.map((a) => (
            <tr key={a.id} onClick={() => openAppointment(a.id)} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && openAppointment(a.id)} data-testid={`appointment-row-${a.public_id}`} className={cn("cursor-pointer transition-colors hover:bg-brand-soft/40 focus:bg-brand-soft/40 focus:outline-none", dense && "text-xs")}>
              <td className="font-mono text-xs text-muted-foreground">{a.public_id}{a.is_demo && <DemoBadge className="ml-2" />}</td>
              <td><p className="font-medium">{a.patient_name}</p><p className="text-xs text-muted-foreground">{displayPhone(a.patient_phone)}</p></td>
              {showDate && <td className="whitespace-nowrap">{formatDate(a.date, "D MMM YYYY")}</td>}
              <td className="whitespace-nowrap">{formatSlot(a.slot_start, a.slot_end)}</td>
              <td>{a.service_name}</td>
              <td>{a.doctor_name || <span className={cn("text-xs font-medium", a.needs_manual_assignment ? "text-[#B45309]" : "text-muted-foreground")}>{a.needs_manual_assignment ? "Needs assignment" : "—"}</span>}</td>
              <td><StatusBadge status={a.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({ page, pageSize, total, onChange }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground" data-testid="pagination">
      <span>Page {page} of {pages} · {total} records</span>
      <div className="flex gap-1"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></Button><Button variant="outline" size="sm" disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="Next page"><ChevronRight className="h-4 w-4" /></Button></div>
    </div>
  );
}

export function ActivityList({ items }) {
  if (!items?.length) return <EmptyState title="No activity yet" text="Actions taken in the dashboard appear here." />;
  return (
    <ol className="divide-y divide-border rounded-xl border border-border bg-white" data-testid="activity-list">
      {items.map((a) => <li key={a.id} className="flex items-start justify-between gap-3 px-4 py-2.5 text-sm"><div><p className="font-medium">{a.action.replaceAll("_", " ")}</p><p className="text-xs text-muted-foreground">{a.user_name || a.user_email || "System"}{a.metadata?.public_id ? ` · ${a.metadata.public_id}` : ""}</p></div><span className="shrink-0 text-xs text-muted-foreground">{fromNow(a.created_at)}</span></li>)}
    </ol>
  );
}

export function Card({ title, action, children, className, testId }) {
  return (
    <section data-testid={testId} className={cn("rounded-xl border border-border bg-white", className)}>
      {(title || action) && <header className="flex items-center justify-between border-b border-border px-4 py-3"><h2 className="font-admin text-sm font-semibold">{title}</h2>{action}</header>}
      <div className="p-4">{children}</div>
    </section>
  );
}
