import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, PageHeader } from "@/components/shared/Primitives";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/States";
import { CapacityIndicator } from "@/components/shared/CapacityIndicator";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useAppointmentDrawer } from "@/components/dashboard/AppointmentDrawer";
import { useAdminMutation, useAdminQuery } from "@/features/admin/hooks";
import { useAuth } from "@/features/auth/AuthContext";
import { api } from "@/lib/api";
import { dayjs, formatDate, formatTime, todayIso } from "@/lib/format";
import { useSeo } from "@/lib/seo";
import { cn } from "@/lib/utils";

const STATUSES = ["NEW", "CONTACTED", "CONFIRMED", "ASSIGNED", "RESCHEDULED", "COMPLETED", "CANCELLED", "NO_SHOW"];

export default function Schedule() {
  const [view, setView] = useState("day");
  const [anchor, setAnchor] = useState(todayIso());
  const [filters, setFilters] = useState({ doctor_id: "", service_id: "", status: "" });
  const [override, setOverride] = useState(null);
  const { can } = useAuth();
  const { openAppointment } = useAppointmentDrawer();
  const { data: doctors } = useAdminQuery("doctors", "/admin/doctors");
  const { data: services } = useAdminQuery("services", "/admin/services");
  useSeo({ title: "Schedule · Dashboard", noindex: true });

  const range = useMemo(() => {
    const d = dayjs(anchor);
    if (view === "day") return { from: anchor, to: anchor };
    if (view === "week") { const start = d.subtract((d.day() + 6) % 7, "day"); return { from: start.format("YYYY-MM-DD"), to: start.add(6, "day").format("YYYY-MM-DD") }; }
    return { from: d.startOf("month").format("YYYY-MM-DD"), to: d.endOf("month").format("YYYY-MM-DD") };
  }, [view, anchor]);
  const params = { doctor_id: filters.doctor_id || undefined, service_id: filters.service_id || undefined, status: filters.status || undefined };
  const day = useAdminQuery("schedule-day", "/admin/schedule/day", { date: anchor, ...params }, { enabled: view === "day" });
  const rng = useAdminQuery("schedule-range", "/admin/schedule/range", { date_from: range.from, date_to: range.to, ...params }, { enabled: view !== "day" });
  const saveOverride = useAdminMutation((body) => api.put("/admin/schedule/overrides", body), { success: "Capacity override saved", onSuccess: () => setOverride(null) });
  const removeOverride = useAdminMutation((id) => api.delete(`/admin/schedule/overrides/${id}`), { success: "Override removed", onSuccess: () => setOverride(null) });
  const overrides = useAdminQuery("overrides", "/admin/schedule/overrides", { date_from: range.from, date_to: range.to });

  const shift = (n) => setAnchor(dayjs(anchor).add(n, view === "day" ? "day" : view === "week" ? "week" : "month").format("YYYY-MM-DD"));
  const title = view === "day" ? formatDate(anchor, "dddd, D MMMM YYYY") : view === "week" ? `${formatDate(range.from, "D MMM")} – ${formatDate(range.to, "D MMM YYYY")}` : formatDate(anchor, "MMMM YYYY");

  return (
    <div data-testid="admin-schedule">
      <PageHeader title="Schedule" description="Capacity is calculated live from doctor availability, leave, holidays and overrides." />
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-white p-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => shift(-1)} aria-label="Previous" data-testid="schedule-prev"><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => setAnchor(todayIso())} data-testid="schedule-today">Today</Button>
          <Button variant="outline" size="sm" onClick={() => shift(1)} aria-label="Next" data-testid="schedule-next"><ChevronRight className="h-4 w-4" /></Button>
          <Input type="date" value={anchor} onChange={(e) => e.target.value && setAnchor(e.target.value)} className="h-9 w-40" aria-label="Jump to date" data-testid="schedule-date-input" />
          <span className="ml-2 hidden font-admin text-sm font-semibold md:inline" data-testid="schedule-title">{title}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-border p-0.5">{["day", "week", "month"].map((v) => <button key={v} type="button" onClick={() => setView(v)} aria-pressed={view === v} data-testid={`schedule-view-${v}`} className={cn("rounded-md px-3 py-1.5 text-xs font-semibold capitalize", view === v ? "bg-brand text-white" : "text-muted-foreground")}>{v}</button>)}</div>
          <Select value={filters.doctor_id || "all"} onValueChange={(v) => setFilters({ ...filters, doctor_id: v === "all" ? "" : v })}><SelectTrigger className="h-9 w-40" aria-label="Doctor" data-testid="schedule-doctor-filter"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All doctors</SelectItem><SelectItem value="unassigned">Unassigned</SelectItem>{(doctors?.items || []).map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent></Select>
          <Select value={filters.service_id || "all"} onValueChange={(v) => setFilters({ ...filters, service_id: v === "all" ? "" : v })}><SelectTrigger className="h-9 w-44" aria-label="Service"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All services</SelectItem>{(services?.items || []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select>
          <Select value={filters.status || "all"} onValueChange={(v) => setFilters({ ...filters, status: v === "all" ? "" : v })}><SelectTrigger className="h-9 w-36" aria-label="Status"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
        </div>
      </div>

      <div className="mt-4">
        {view === "day" && (day.isLoading ? <LoadingState rows={8} /> : day.isError ? <ErrorState onRetry={day.refetch} /> : !day.data.is_open ? <EmptyState title="Clinic closed" text="This day is outside working hours or marked as a holiday." /> : (
          <div className="space-y-3" data-testid="schedule-day-view">
            <p className="text-sm text-muted-foreground">{day.data.booked} / {day.data.capacity} booked across the day. {can(["OWNER", "ADMIN"]) && "Click a slot header to set a capacity override."}</p>
            {day.data.slots.map((slot) => (
              <div key={slot.slot_start} className="rounded-xl border border-border bg-white p-3">
                <CapacityIndicator slot={slot} onClick={can(["OWNER", "ADMIN"]) ? () => setOverride({ date: anchor, slot_start: slot.slot_start, capacity: slot.capacity, note: "", existing: overrides.data?.items?.find((o) => o.date === anchor && o.slot_start === slot.slot_start) }) : undefined} />
                {slot.has_override && <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-clay">Manual override active</p>}
                {slot.appointments.length > 0 && <ul className="mt-2 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">{slot.appointments.map((a) => <li key={a.id}><button type="button" onClick={() => openAppointment(a.id)} data-testid={`schedule-appt-${a.public_id}`} className="flex w-full items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-left text-xs hover:border-brand/40"><span className="min-w-0"><span className="block truncate font-medium">{a.patient_name}</span><span className="block truncate text-muted-foreground">{a.service_name} · {a.doctor_name || "Unassigned"}</span></span><StatusBadge status={a.status} /></button></li>)}</ul>}
              </div>
            ))}
          </div>
        ))}
        {view !== "day" && (rng.isLoading ? <LoadingState rows={8} /> : rng.isError ? <ErrorState onRetry={rng.refetch} /> : (
          <div className={cn("grid gap-2", view === "week" ? "grid-cols-1 md:grid-cols-7" : "grid-cols-7")} data-testid={`schedule-${view}-view`}>
            {view === "month" && ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => <span key={d} className="text-center text-xs font-semibold text-muted-foreground">{d}</span>)}
            {view === "month" && Array.from({ length: (dayjs(range.from).day() + 6) % 7 }).map((_, i) => <span key={`pad-${i}`} />)}
            {rng.data.days.map((d) => {
              const appts = rng.data.appointments.filter((a) => a.date === d.date);
              const util = d.capacity ? Math.round((d.booked / d.capacity) * 100) : 0;
              return (
                <div key={d.date} className={cn("rounded-xl border border-border bg-white p-2", !d.is_open && "bg-muted/40", d.date === todayIso() && "border-brand")}>
                  <button type="button" onClick={() => { setAnchor(d.date); setView("day"); }} className="flex w-full items-center justify-between text-left" data-testid={`schedule-cell-${d.date}`}><span className="font-admin text-sm font-semibold">{view === "week" ? formatDate(d.date, "ddd D") : dayjs(d.date).date()}</span>{d.is_open && <span className={cn("text-[10px] font-semibold", util >= 100 ? "text-[#B91C1C]" : util >= 70 ? "text-[#B45309]" : "text-muted-foreground")}>{d.booked}/{d.capacity}</span>}</button>
                  {d.is_open && <div className="mt-1 h-1 w-full rounded-full bg-muted"><div className={cn("h-full rounded-full", util >= 100 ? "bg-[#B91C1C]" : util >= 70 ? "bg-[#B45309]" : "bg-brand")} style={{ width: `${Math.min(util, 100)}%` }} /></div>}
                  {view === "week" && <ul className="mt-2 space-y-1">{appts.slice(0, 8).map((a) => <li key={a.id}><button type="button" onClick={() => openAppointment(a.id)} className="w-full truncate rounded-md bg-brand-soft/60 px-2 py-1 text-left text-[11px] hover:bg-brand-soft">{formatTime(a.slot_start)} · {a.patient_name}</button></li>)}{appts.length > 8 && <li className="text-[11px] text-muted-foreground">+{appts.length - 8} more</li>}</ul>}
                  {view === "month" && appts.length > 0 && <p className="mt-1 text-[10px] text-muted-foreground">{appts.length} appt{appts.length > 1 ? "s" : ""}</p>}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <Dialog open={!!override} onOpenChange={() => setOverride(null)}>
        <DialogContent data-testid="override-dialog">
          <DialogHeader><DialogTitle className="font-admin">Capacity override</DialogTitle><DialogDescription>{override && `${formatDate(override.date)} · ${formatTime(override.slot_start)}. Replaces the doctor-derived capacity for this slot only. Extra bookings beyond doctor capacity will need manual assignment.`}</DialogDescription></DialogHeader>
          {override && <><Field label="Capacity" htmlFor="ov-cap"><Input id="ov-cap" type="number" min={0} max={500} value={override.capacity} onChange={(e) => setOverride({ ...override, capacity: Number(e.target.value) })} data-testid="override-capacity-input" /></Field><Field label="Note" htmlFor="ov-note"><Input id="ov-note" value={override.note} onChange={(e) => setOverride({ ...override, note: e.target.value })} /></Field></>}
          <DialogFooter>{override?.existing && <Button variant="outline" onClick={() => removeOverride.mutate(override.existing.id)} className="text-destructive" data-testid="override-remove">Remove override</Button>}<Button onClick={() => saveOverride.mutate({ date: override.date, slot_start: override.slot_start, capacity: override.capacity, note: override.note })} disabled={saveOverride.isPending} className="bg-brand hover:bg-brand-hover" data-testid="override-save">Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
