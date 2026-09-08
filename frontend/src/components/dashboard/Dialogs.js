import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "@/components/shared/Primitives";
import { CapacityBadge } from "@/components/shared/StatusBadge";
import { adminApi, useAdminMutation } from "@/features/admin/hooks";
import { formatTime, todayIso } from "@/lib/format";
import { cn } from "@/lib/utils";

export function SlotPicker({ date, serviceId, value, onChange }) {
  const { data, isLoading } = useQuery({ queryKey: ["admin", "availability", date, serviceId], queryFn: () => adminApi.availability(date, serviceId), enabled: !!date });
  if (!date) return <p className="text-sm text-muted-foreground">Choose a date to see time slots.</p>;
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading slots...</p>;
  const slots = data?.slots || [];
  if (slots.length === 0) return <p className="text-sm text-muted-foreground">Clinic is closed on this day.</p>;
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" data-testid="admin-slot-picker">
      {slots.map((s) => <button key={s.slot_start} type="button" disabled={s.status === "FULL"} onClick={() => onChange(s.slot_start)} data-testid={`admin-slot-${s.slot_start}`} className={cn("flex flex-col items-start rounded-lg border p-2 text-left text-xs", value === s.slot_start ? "border-brand bg-brand text-white" : "border-border bg-white", s.status === "FULL" && "opacity-40")}><span className="font-semibold">{formatTime(s.slot_start)}</span><span className={cn("mt-1", value === s.slot_start ? "text-white/80" : "text-muted-foreground")}>{s.remaining} left</span></button>)}
    </div>
  );
}

export function DoctorSelect({ value, onChange, serviceId, allowNone = true, label = "Doctor" }) {
  const { data } = useQuery({ queryKey: ["admin", "doctors"], queryFn: adminApi.doctors });
  const doctors = (data?.items || []).filter((d) => d.is_active);
  return (
    <Field label={label} htmlFor="doctor-select">
      <Select value={value || "none"} onValueChange={(v) => onChange(v === "none" ? null : v)}>
        <SelectTrigger id="doctor-select" data-testid="doctor-select"><SelectValue placeholder="Select doctor" /></SelectTrigger>
        <SelectContent>
          {allowNone && <SelectItem value="none">Unassigned / let system decide</SelectItem>}
          {doctors.map((d) => <SelectItem key={d.id} value={d.id} data-testid={`doctor-option-${d.id}`}>{d.name}{serviceId && !(d.service_ids || []).includes(serviceId) ? " (not eligible for this service)" : ""}</SelectItem>)}
        </SelectContent>
      </Select>
    </Field>
  );
}

export function AssignDoctorDialog({ open, onOpenChange, appointment, onSubmit, loading }) {
  const [doctorId, setDoctorId] = useState(appointment?.doctor_id || null);
  const [force, setForce] = useState(false);
  useEffect(() => { setDoctorId(appointment?.doctor_id || null); setForce(false); }, [appointment, open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="assign-dialog">
        <DialogHeader><DialogTitle className="font-admin">Assign doctor</DialogTitle><DialogDescription>Capacity for the chosen doctor is re-checked before saving.</DialogDescription></DialogHeader>
        <DoctorSelect value={doctorId} onChange={setDoctorId} serviceId={appointment?.service_id} />
        <label className="flex items-start gap-2 text-sm"><Checkbox checked={force} onCheckedChange={(v) => setForce(v === true)} data-testid="assign-force-checkbox" className="mt-0.5" /><span>Override capacity check (owner decision — may exceed the doctor's slot capacity)</span></label>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={() => onSubmit({ doctor_id: doctorId, force })} disabled={loading} data-testid="assign-submit" className="bg-brand hover:bg-brand-hover">{loading ? "Saving..." : "Save assignment"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RescheduleDialog({ open, onOpenChange, appointment, onSubmit, loading }) {
  const [date, setDate] = useState(appointment?.date || todayIso());
  const [slot, setSlot] = useState(null);
  const [reason, setReason] = useState("");
  const [keep, setKeep] = useState(true);
  useEffect(() => { setDate(appointment?.date || todayIso()); setSlot(null); setReason(""); setKeep(true); }, [appointment, open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" data-testid="reschedule-dialog">
        <DialogHeader><DialogTitle className="font-admin">Reschedule appointment</DialogTitle><DialogDescription>Capacity and doctor availability are re-checked. The patient is notified where enabled.</DialogDescription></DialogHeader>
        <Field label="New date" htmlFor="reschedule-date"><Input id="reschedule-date" type="date" min={todayIso()} value={date} onChange={(e) => { setDate(e.target.value); setSlot(null); }} data-testid="reschedule-date-input" /></Field>
        <SlotPicker date={date} serviceId={appointment?.service_id} value={slot} onChange={setSlot} />
        {appointment?.doctor_id && <label className="flex items-center gap-2 text-sm"><Checkbox checked={keep} onCheckedChange={(v) => setKeep(v === true)} /> Keep {appointment.doctor_name} if available</label>}
        <Field label="Reason (optional)" htmlFor="reschedule-reason"><Input id="reschedule-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Patient requested a later time" data-testid="reschedule-reason-input" /></Field>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button disabled={!slot || loading} onClick={() => onSubmit({ date, slot_start: slot, reason: reason || null, keep_doctor: keep })} data-testid="reschedule-submit" className="bg-brand hover:bg-brand-hover">{loading ? "Saving..." : "Reschedule"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CancelDialog({ open, onOpenChange, onSubmit, loading }) {
  const [reason, setReason] = useState("");
  useEffect(() => setReason(""), [open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="cancel-dialog">
        <DialogHeader><DialogTitle className="font-admin">Cancel appointment</DialogTitle><DialogDescription>The slot is released immediately and the patient is notified where enabled.</DialogDescription></DialogHeader>
        <Field label="Reason" htmlFor="cancel-reason"><Textarea id="cancel-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Patient requested cancellation" data-testid="cancel-reason-input" /></Field>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Keep appointment</Button><Button variant="destructive" disabled={loading} onClick={() => onSubmit({ reason: reason || null })} data-testid="cancel-submit">{loading ? "Cancelling..." : "Cancel appointment"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function NewAppointmentDialog({ open, onOpenChange, onCreated }) {
  const { data: services } = useQuery({ queryKey: ["admin", "services"], queryFn: adminApi.services, enabled: open });
  const [form, setForm] = useState({ service_id: "", date: todayIso(), slot_start: null, doctor_id: null, name: "", phone: "", email: "", message: "" });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  useEffect(() => { if (open) setForm({ service_id: "", date: todayIso(), slot_start: null, doctor_id: null, name: "", phone: "", email: "", message: "" }); }, [open]);
  const create = useAdminMutation(() => adminApi.createAppointment({ ...form, email: form.email || null, message: form.message || null, consent: true }), { success: (d) => `Appointment ${d.public_id} created`, onSuccess: (d) => { onOpenChange(false); onCreated?.(d); } });
  const ready = form.service_id && form.date && form.slot_start && form.name.trim().length >= 2 && form.phone.replace(/\D/g, "").length >= 10;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl" data-testid="new-appointment-dialog">
        <DialogHeader><DialogTitle className="font-admin">New appointment</DialogTitle><DialogDescription>Book on behalf of a patient (walk-in or phone). Booking rules and capacity apply; minimum notice is waived for staff.</DialogDescription></DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Service" htmlFor="new-service" required className="sm:col-span-2">
            <Select value={form.service_id} onValueChange={(v) => { set("service_id", v); set("slot_start", null); }}>
              <SelectTrigger id="new-service" data-testid="new-appt-service"><SelectValue placeholder="Select service" /></SelectTrigger>
              <SelectContent>{(services?.items || []).filter((s) => s.is_active).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Date" htmlFor="new-date" required><Input id="new-date" type="date" min={todayIso()} value={form.date} onChange={(e) => { set("date", e.target.value); set("slot_start", null); }} data-testid="new-appt-date" /></Field>
          <div className="sm:col-span-2"><p className="mb-1.5 text-sm font-medium">Time slot <span className="text-clay">*</span></p>{form.service_id ? <SlotPicker date={form.date} serviceId={form.service_id} value={form.slot_start} onChange={(v) => set("slot_start", v)} /> : <p className="text-sm text-muted-foreground">Select a service first.</p>}</div>
          <div className="sm:col-span-2"><DoctorSelect value={form.doctor_id} onChange={(v) => set("doctor_id", v)} serviceId={form.service_id} label="Preferred doctor (optional)" /></div>
          <Field label="Patient name" htmlFor="new-name" required><Input id="new-name" value={form.name} onChange={(e) => set("name", e.target.value)} data-testid="new-appt-name" /></Field>
          <Field label="Mobile number" htmlFor="new-phone" required><Input id="new-phone" type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} data-testid="new-appt-phone" /></Field>
          <Field label="Email (optional)" htmlFor="new-email"><Input id="new-email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} /></Field>
          <Field label="Note (optional)" htmlFor="new-message"><Input id="new-message" value={form.message} onChange={(e) => set("message", e.target.value)} /></Field>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button disabled={!ready || create.isPending} onClick={() => create.mutate()} data-testid="new-appt-submit" className="bg-brand hover:bg-brand-hover">{create.isPending ? "Creating..." : "Create appointment"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
