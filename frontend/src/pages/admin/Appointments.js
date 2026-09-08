import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Download, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/shared/Primitives";
import { ErrorState, LoadingState } from "@/components/shared/States";
import { AppointmentTable, Pagination } from "@/components/dashboard/Widgets";
import { NewAppointmentDialog } from "@/components/dashboard/Dialogs";
import { adminApi, useAdminQuery } from "@/features/admin/hooks";
import { useAuth } from "@/features/auth/AuthContext";
import { API_BASE } from "@/lib/api";
import { todayIso } from "@/lib/format";
import { useSeo } from "@/lib/seo";
import { cn } from "@/lib/utils";

const STATUSES = ["NEW", "CONTACTED", "CONFIRMED", "ASSIGNED", "RESCHEDULED", "COMPLETED", "CANCELLED", "NO_SHOW"];

export default function Appointments() {
  const [params, setParams] = useSearchParams();
  const { can } = useAuth();
  const [newOpen, setNewOpen] = useState(false);
  useSeo({ title: "Appointments · Dashboard", noindex: true });
  const status = params.get("status") || "";
  const selected = status ? status.split(",") : [];
  const date = params.get("date") === "today" ? todayIso() : params.get("date") || "";
  const query = useMemo(() => ({
    status: status || undefined, date_from: date || params.get("from") || undefined, date_to: date || params.get("to") || undefined,
    doctor_id: params.get("doctor") || undefined, service_id: params.get("service") || undefined, search: params.get("q") || undefined,
    needs_assignment: params.get("needs_assignment") ? true : undefined, page: Number(params.get("page") || 1), page_size: 25, sort: params.get("sort") || "-created_at",
  }), [params, status, date]);
  const { data, isLoading, isError, refetch } = useAdminQuery("appointments", "/admin/appointments", query);
  const { data: doctors } = useAdminQuery("doctors", "/admin/doctors");
  const { data: services } = useAdminQuery("services", "/admin/services");

  const update = (patch) => { const next = new URLSearchParams(params); Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k))); if (!("page" in patch)) next.delete("page"); setParams(next); };
  const toggleStatus = (s) => { const next = selected.includes(s) ? selected.filter((x) => x !== s) : [...selected, s]; update({ status: next.join(",") }); };
  const hasFilters = [...params.keys()].some((k) => k !== "page" && k !== "sort");

  return (
    <div data-testid="admin-appointments">
      <PageHeader title="Appointments" description="Every booking request, confirmation and visit — searchable and filterable." actions={<>
        {can(["OWNER", "ADMIN"]) && <Button asChild variant="outline" size="sm"><a href={`${API_BASE}/admin/appointments/export.csv${status ? `?status=${status}` : ""}`} data-testid="appointments-export"><Download className="h-4 w-4" /> Export CSV</a></Button>}
        {can(["OWNER", "ADMIN", "STAFF"]) && <Button size="sm" onClick={() => setNewOpen(true)} className="bg-brand hover:bg-brand-hover" data-testid="appointments-new"><Plus className="h-4 w-4" /> New appointment</Button>}
      </>} />
      <div className="rounded-xl border border-border bg-white p-3" data-testid="appointments-filters">
        <div className="flex flex-wrap gap-1.5">{STATUSES.map((s) => <button key={s} type="button" onClick={() => toggleStatus(s)} aria-pressed={selected.includes(s)} data-testid={`filter-status-${s}`} className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors", selected.includes(s) ? "border-brand bg-brand text-white" : "border-border text-muted-foreground hover:border-brand/40")}>{s.replace("_", " ")}</button>)}</div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <div className="relative lg:col-span-2"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input defaultValue={params.get("q") || ""} onKeyDown={(e) => e.key === "Enter" && update({ q: e.target.value })} placeholder="Name, phone or PT-ID, then Enter" className="pl-9" data-testid="appointments-search" /></div>
          <Input type="date" value={date} onChange={(e) => update({ date: e.target.value, from: "", to: "" })} aria-label="Filter by date" data-testid="appointments-date-filter" />
          <Select value={params.get("doctor") || "all"} onValueChange={(v) => update({ doctor: v === "all" ? "" : v })}><SelectTrigger aria-label="Doctor filter" data-testid="appointments-doctor-filter"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All doctors</SelectItem><SelectItem value="unassigned">Unassigned</SelectItem>{(doctors?.items || []).map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent></Select>
          <Select value={params.get("service") || "all"} onValueChange={(v) => update({ service: v === "all" ? "" : v })}><SelectTrigger aria-label="Service filter" data-testid="appointments-service-filter"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All services</SelectItem>{(services?.items || []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select>
        </div>
        {hasFilters && <button type="button" onClick={() => setParams({})} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground" data-testid="appointments-clear-filters"><X className="h-3 w-3" /> Clear filters</button>}
      </div>
      <div className="mt-4">
        {isLoading && <LoadingState rows={8} />}
        {isError && <ErrorState onRetry={refetch} />}
        {data && <><AppointmentTable items={data.items} emptyTitle={hasFilters ? "No appointments match these filters" : "No appointments yet"} emptyText={hasFilters ? "Try widening the date range or clearing a filter." : "Bookings from the website will appear here."} /><Pagination page={data.page} pageSize={data.page_size} total={data.total} onChange={(p) => update({ page: String(p) })} /></>}
      </div>
      <NewAppointmentDialog open={newOpen} onOpenChange={setNewOpen} />
    </div>
  );
}
