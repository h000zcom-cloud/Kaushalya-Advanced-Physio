import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, Check, MessageCircle, Phone, Stethoscope, UserCheck, UserX, XCircle } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DemoBadge } from "@/components/shared/Primitives";
import { ErrorState, LoadingState } from "@/components/shared/States";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { AssignDoctorDialog, CancelDialog, RescheduleDialog } from "@/components/dashboard/Dialogs";
import { adminApi, useAdminMutation } from "@/features/admin/hooks";
import { useAuth } from "@/features/auth/AuthContext";
import { displayPhone, formatDate, formatDateTime, formatSlot, telLink, waLink } from "@/lib/format";

const DrawerContext = createContext({ openAppointment: () => {} });
export const useAppointmentDrawer = () => useContext(DrawerContext);

export function AppointmentDrawerProvider({ children }) {
  const [id, setId] = useState(null);
  const openAppointment = useCallback((appointmentId) => setId(appointmentId), []);
  const value = useMemo(() => ({ openAppointment }), [openAppointment]);
  return (
    <DrawerContext.Provider value={value}>
      {children}
      <Sheet open={!!id} onOpenChange={(o) => !o && setId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl" data-testid="appointment-drawer">{id && <AppointmentDetail id={id} onClose={() => setId(null)} />}</SheetContent>
      </Sheet>
    </DrawerContext.Provider>
  );
}

function Row({ label, children }) {
  return <div className="flex items-start justify-between gap-4 py-2 text-sm"><span className="text-muted-foreground">{label}</span><span className="text-right font-medium text-foreground">{children}</span></div>;
}

function AppointmentDetail({ id }) {
  const { can } = useAuth();
  const canWrite = can(["OWNER", "ADMIN", "STAFF"]);
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ["admin", "appointment", id], queryFn: () => adminApi.appointment(id) });
  const [dialog, setDialog] = useState(null);
  const [note, setNote] = useState("");
  const action = useAdminMutation(({ action: a, body }) => adminApi.act(id, a, body), { success: (d) => `Appointment ${d.public_id} updated`, onSuccess: () => setDialog(null) });
  const addNote = useAdminMutation(() => adminApi.act(id, "notes", { text: note }), { success: "Note added", onSuccess: () => setNote("") });

  if (isLoading) return <LoadingState rows={6} className="mt-8" />;
  if (isError || !data) return <ErrorState className="mt-8" onRetry={refetch} />;
  const a = data.appointment;
  const active = !["COMPLETED", "CANCELLED", "NO_SHOW"].includes(a.status);
  const canConfirm = ["NEW", "CONTACTED", "RESCHEDULED"].includes(a.status);
  const canContact = a.status === "NEW";
  const canFinish = ["CONFIRMED", "ASSIGNED", "RESCHEDULED"].includes(a.status);
  const waText = `Hello ${a.patient_name}, this is ${a.clinic_name || "the clinic"} regarding your appointment ${a.public_id} on ${formatDate(a.date)} at ${formatSlot(a.slot_start)}.`;

  return (
    <div className="pb-8">
      <SheetHeader className="text-left">
        <div className="flex flex-wrap items-center gap-2"><SheetTitle className="font-admin text-xl" data-testid="drawer-public-id">{a.public_id}</SheetTitle><StatusBadge status={a.status} />{a.is_demo && <DemoBadge />}</div>
        <SheetDescription>{a.service_name} · {formatDate(a.date)} · {formatSlot(a.slot_start, a.slot_end)}</SheetDescription>
      </SheetHeader>
      {a.needs_manual_assignment && active && <p role="status" data-testid="drawer-needs-assignment" className="mt-4 rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-3 py-2 text-sm font-medium text-[#92400E]">Needs manual doctor assignment</p>}

      <section className="mt-5 rounded-xl border border-border bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div><p className="font-admin text-base font-semibold" data-testid="drawer-patient-name">{a.patient_name}</p><p className="text-sm text-muted-foreground">{displayPhone(a.patient_phone)}{a.patient_email ? ` · ${a.patient_email}` : ""}</p></div>
          <Link to={`/admin/patients/${a.patient_id}`} className="text-sm font-semibold text-brand hover:underline" data-testid="drawer-patient-link">Profile</Link>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline"><a href={telLink(a.patient_phone)} data-testid="drawer-call-button"><Phone className="h-3.5 w-3.5" /> Call</a></Button>
          <Button asChild size="sm" variant="outline" className="border-wa/40 text-wa hover:bg-wa/5 hover:text-wa"><a href={waLink(a.patient_phone, waText)} target="_blank" rel="noreferrer" data-testid="drawer-whatsapp-button"><MessageCircle className="h-3.5 w-3.5" /> WhatsApp</a></Button>
        </div>
        {a.message && <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-sm text-foreground"><span className="text-muted-foreground">Patient note: </span>{a.message}</p>}
      </section>

      <section className="mt-4 divide-y divide-border rounded-xl border border-border bg-white px-4">
        <Row label="Doctor">{a.doctor_name || <span className="text-[#B45309]">Unassigned</span>}</Row>
        <Row label="Acceptance">{a.acceptance_mode === "AUTO" ? "Auto-confirm" : "Manual confirmation"}</Row>
        <Row label="Source">{a.source}</Row>
        <Row label="Created">{formatDateTime(a.created_at)}</Row>
        {a.rescheduled_from && <Row label="Moved from">{formatDate(a.rescheduled_from.date)} {formatSlot(a.rescheduled_from.slot_start)}</Row>}
        {a.cancellation_reason && <Row label="Cancel reason">{a.cancellation_reason}</Row>}
      </section>

      {canWrite && active && (
        <section className="mt-4 grid grid-cols-2 gap-2" data-testid="drawer-actions">
          {canConfirm && <Button onClick={() => action.mutate({ action: "confirm" })} disabled={action.isPending} className="bg-brand hover:bg-brand-hover" data-testid="action-confirm"><Check className="h-4 w-4" /> Confirm</Button>}
          {canContact && <Button variant="outline" onClick={() => action.mutate({ action: "contacted" })} disabled={action.isPending} data-testid="action-contacted"><Phone className="h-4 w-4" /> Mark contacted</Button>}
          <Button variant="outline" onClick={() => setDialog("assign")} data-testid="action-assign"><Stethoscope className="h-4 w-4" /> {a.doctor_id ? "Reassign doctor" : "Assign doctor"}</Button>
          <Button variant="outline" onClick={() => setDialog("reschedule")} data-testid="action-reschedule"><CalendarClock className="h-4 w-4" /> Reschedule</Button>
          {canFinish && <Button variant="outline" onClick={() => action.mutate({ action: "complete" })} disabled={action.isPending} data-testid="action-complete"><UserCheck className="h-4 w-4" /> Completed</Button>}
          {canFinish && <Button variant="outline" onClick={() => setDialog("no_show")} data-testid="action-no-show"><UserX className="h-4 w-4" /> No-show</Button>}
          <Button variant="outline" className="col-span-2 border-[#FECACA] text-[#B91C1C] hover:bg-[#FEF2F2] hover:text-[#B91C1C]" onClick={() => setDialog("cancel")} data-testid="action-cancel"><XCircle className="h-4 w-4" /> Cancel appointment</Button>
        </section>
      )}

      <section className="mt-6">
        <h3 className="font-admin text-sm font-semibold uppercase tracking-wide text-muted-foreground">Notes</h3>
        <ul className="mt-2 space-y-2">{(a.notes || []).map((n) => <li key={n.id} className="rounded-lg border border-border bg-white px-3 py-2 text-sm"><p>{n.text}</p><p className="mt-1 text-xs text-muted-foreground">{n.author_name} · {formatDateTime(n.created_at)}</p></li>)}</ul>
        {canWrite && <div className="mt-2 flex gap-2"><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add an internal note" data-testid="drawer-note-input" /><Button onClick={() => addNote.mutate()} disabled={!note.trim() || addNote.isPending} data-testid="drawer-note-submit">Add</Button></div>}
      </section>

      <section className="mt-6">
        <h3 className="font-admin text-sm font-semibold uppercase tracking-wide text-muted-foreground">Timeline</h3>
        <ol className="mt-2 space-y-3 border-l border-border pl-4" data-testid="drawer-history">
          {data.history.map((h) => <li key={h.id} className="relative text-sm"><span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-brand" /><p className="font-medium">{h.from_status ? `${h.from_status} → ${h.to_status}` : h.to_status}</p><p className="text-xs text-muted-foreground">{h.actor_name}{h.reason ? ` · ${h.reason}` : ""} · {formatDateTime(h.created_at)}</p></li>)}
        </ol>
      </section>

      <section className="mt-6">
        <h3 className="font-admin text-sm font-semibold uppercase tracking-wide text-muted-foreground">WhatsApp notifications</h3>
        {data.notifications.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No WhatsApp notifications for this appointment.</p> : <ul className="mt-2 space-y-2">{data.notifications.map((n) => <li key={n.id} className="rounded-lg border border-border bg-white px-3 py-2 text-sm"><div className="flex items-center justify-between gap-2"><span className="font-medium capitalize">{n.template_key?.replace("_", " ")}</span><span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium">{n.status.replaceAll("_", " ")}</span></div>{n.error && <p className="mt-1 text-xs text-[#B45309]">{n.error}</p>}<p className="mt-1 text-xs text-muted-foreground">{formatDateTime(n.created_at)}</p></li>)}</ul>}
      </section>

      <AssignDoctorDialog open={dialog === "assign"} onOpenChange={() => setDialog(null)} appointment={a} onSubmit={(body) => action.mutate({ action: "assign", body })} loading={action.isPending} />
      <RescheduleDialog open={dialog === "reschedule"} onOpenChange={() => setDialog(null)} appointment={a} onSubmit={(body) => action.mutate({ action: "reschedule", body })} loading={action.isPending} />
      <CancelDialog open={dialog === "cancel"} onOpenChange={() => setDialog(null)} onSubmit={(body) => action.mutate({ action: "cancel", body })} loading={action.isPending} />
      <ConfirmDialog open={dialog === "no_show"} onOpenChange={() => setDialog(null)} title="Mark as no-show?" description="Use this only when the patient did not arrive. This is recorded separately from cancellations." confirmLabel="Mark no-show" onConfirm={() => action.mutate({ action: "no-show" })} loading={action.isPending} />
    </div>
  );
}
