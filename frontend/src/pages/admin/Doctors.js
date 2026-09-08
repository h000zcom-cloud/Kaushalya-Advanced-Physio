import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Field, PageHeader, PersonAvatar, DemoBadge } from "@/components/shared/Primitives";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/States";
import { AppointmentTable, Card } from "@/components/dashboard/Widgets";
import { useAdminMutation, useAdminQuery } from "@/features/admin/hooks";
import { useAuth } from "@/features/auth/AuthContext";
import { api } from "@/lib/api";
import { WEEKDAYS } from "@/lib/format";
import { useSeo } from "@/lib/seo";
import { cn } from "@/lib/utils";

const EMPTY = { name: "", designation: "", qualification: "", specializations: [], experience_years: "", expertise: [], bio: "", philosophy: "", photo_url: "", service_ids: [], capacity_per_slot: 1, working_hours: [], time_off: [], is_active: true, is_demo: false, display_order: 0 };
const lines = (arr) => (arr || []).join("\n");
const fromLines = (s) => s.split("\n").map((x) => x.trim()).filter(Boolean);

export default function Doctors() {
  const { data, isLoading, isError, refetch } = useAdminQuery("doctors", "/admin/doctors");
  const { can } = useAuth();
  const toggle = useAdminMutation(({ id, is_active }) => api.patch(`/admin/doctors/${id}/status`, { is_active }), { success: "Doctor status updated" });
  useSeo({ title: "Doctors · Dashboard", noindex: true });
  return (
    <div data-testid="admin-doctors">
      <PageHeader title="Doctors" description="Availability, services and capacity here drive the booking engine directly." actions={can(["OWNER", "ADMIN"]) && <Button asChild size="sm" className="bg-brand hover:bg-brand-hover"><Link to="/admin/doctors/new" data-testid="doctors-add"><Plus className="h-4 w-4" /> Add doctor</Link></Button>} />
      {isLoading && <LoadingState rows={6} />}
      {isError && <ErrorState onRetry={refetch} />}
      {data && (data.items.length === 0 ? <EmptyState title="No doctors yet" text="Add your first physiotherapist to open up bookings." /> : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" data-testid="doctors-list">
          {data.items.map((d) => (
            <div key={d.id} className={cn("flex items-start gap-4 rounded-xl border border-border bg-white p-4", !d.is_active && "opacity-60")} data-testid={`doctor-card-${d.id}`}>
              <PersonAvatar name={d.name} photoUrl={d.photo_url} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2"><Link to={`/admin/doctors/${d.id}`} className="truncate font-admin font-semibold hover:text-brand">{d.name}</Link>{d.is_demo && <DemoBadge />}</div>
                <p className="truncate text-xs text-muted-foreground">{d.designation}{d.qualification ? ` · ${d.qualification}` : ""}</p>
                <p className="mt-2 text-xs text-muted-foreground">{d.service_ids.length} service(s) · {d.capacity_per_slot}/slot · {d.working_hours.length ? "custom hours" : "clinic hours"}{d.time_off.length ? ` · ${d.time_off.length} leave` : ""}</p>
              </div>
              {can(["OWNER", "ADMIN"]) && <Switch checked={d.is_active} onCheckedChange={(v) => toggle.mutate({ id: d.id, is_active: v })} aria-label={`${d.is_active ? "Deactivate" : "Activate"} ${d.name}`} data-testid={`doctor-toggle-${d.id}`} />}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function HoursEditor({ value, onChange }) {
  const byDay = Object.fromEntries(value.map((h) => [h.weekday, h]));
  const set = (weekday, patch) => {
    const next = value.filter((h) => h.weekday !== weekday);
    if (patch) next.push({ weekday, start: "09:00", end: "19:00", ...byDay[weekday], ...patch });
    onChange(next.sort((a, b) => a.weekday - b.weekday));
  };
  return (
    <div className="space-y-2" data-testid="doctor-hours-editor">
      <p className="text-xs text-muted-foreground">Leave all days off to follow clinic hours. Enable specific days to restrict availability.</p>
      {WEEKDAYS.map((label, i) => {
        const h = byDay[i];
        return <div key={label} className="flex items-center gap-3 text-sm"><Switch checked={!!h} onCheckedChange={(v) => set(i, v ? {} : null)} aria-label={label} /><span className="w-24">{label}</span>{h && <><Input type="time" value={h.start} onChange={(e) => set(i, { start: e.target.value })} className="h-9 w-28" /><span>–</span><Input type="time" value={h.end} onChange={(e) => set(i, { end: e.target.value })} className="h-9 w-28" /></>}</div>;
      })}
    </div>
  );
}

function TimeOffEditor({ value, onChange }) {
  const [draft, setDraft] = useState({ start_date: "", end_date: "", reason: "" });
  return (
    <div data-testid="doctor-timeoff-editor">
      <ul className="space-y-1 text-sm">{value.map((t, i) => <li key={t.id || i} className="flex items-center justify-between rounded-lg border border-border px-3 py-1.5"><span>{t.start_date} → {t.end_date}{t.reason ? ` · ${t.reason}` : ""}</span><button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="text-xs text-destructive">Remove</button></li>)}</ul>
      <div className="mt-2 flex flex-wrap items-end gap-2"><Input type="date" value={draft.start_date} onChange={(e) => setDraft({ ...draft, start_date: e.target.value })} className="h-9 w-40" aria-label="Leave start" /><Input type="date" value={draft.end_date} onChange={(e) => setDraft({ ...draft, end_date: e.target.value })} className="h-9 w-40" aria-label="Leave end" /><Input placeholder="Reason" value={draft.reason} onChange={(e) => setDraft({ ...draft, reason: e.target.value })} className="h-9 w-40" /><Button type="button" size="sm" variant="outline" disabled={!draft.start_date || !draft.end_date} onClick={() => { onChange([...value, { ...draft, end_date: draft.end_date < draft.start_date ? draft.start_date : draft.end_date }]); setDraft({ start_date: "", end_date: "", reason: "" }); }} data-testid="doctor-timeoff-add">Add leave</Button></div>
    </div>
  );
}

export function DoctorDetail() {
  const { id } = useParams();
  const isNew = id === "new";
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useAdminQuery(`doctor-${id}`, `/admin/doctors/${id}`, undefined, { enabled: !isNew });
  const { data: services } = useAdminQuery("services", "/admin/services");
  const [form, setForm] = useState(EMPTY);
  useEffect(() => { if (data?.doctor) setForm({ ...EMPTY, ...data.doctor, experience_years: data.doctor.experience_years ?? "" }); }, [data]);
  const save = useAdminMutation((body) => (isNew ? api.post("/admin/doctors", body) : api.put(`/admin/doctors/${id}`, body)).then((r) => r.data), { success: isNew ? "Doctor created" : "Doctor saved", onSuccess: (d) => isNew && navigate(`/admin/doctors/${d.id}`) });
  useSeo({ title: `${isNew ? "New doctor" : form.name || "Doctor"} · Dashboard`, noindex: true });
  if (!isNew && isLoading) return <LoadingState rows={6} />;
  if (!isNew && (isError || !data)) return <ErrorState onRetry={refetch} />;
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const submit = (e) => { e.preventDefault(); save.mutate({ ...form, experience_years: form.experience_years === "" ? null : Number(form.experience_years), capacity_per_slot: Number(form.capacity_per_slot), display_order: Number(form.display_order) }); };

  return (
    <form onSubmit={submit} data-testid="doctor-form">
      <Link to="/admin/doctors" className="text-sm text-muted-foreground hover:text-foreground">← Doctors</Link>
      <PageHeader className="mt-3" title={isNew ? "Add doctor" : form.name} description="Public profile fields appear on the website; scheduling fields drive availability." actions={<><label className="flex items-center gap-2 text-sm"><Switch checked={form.is_active} onCheckedChange={(v) => set("is_active", v)} data-testid="doctor-active-switch" /> Active</label><Button type="submit" disabled={save.isPending} className="bg-brand hover:bg-brand-hover" data-testid="doctor-save">{save.isPending ? "Saving..." : "Save"}</Button></>} />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card title="Profile">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name" htmlFor="d-name" required><Input id="d-name" required value={form.name} onChange={(e) => set("name", e.target.value)} data-testid="doctor-name-input" /></Field>
              <Field label="Designation" htmlFor="d-desig"><Input id="d-desig" value={form.designation} onChange={(e) => set("designation", e.target.value)} /></Field>
              <Field label="Qualification" htmlFor="d-qual" hint="Only list verified qualifications."><Input id="d-qual" value={form.qualification} onChange={(e) => set("qualification", e.target.value)} /></Field>
              <Field label="Years of experience" htmlFor="d-exp"><Input id="d-exp" type="number" min={0} max={60} value={form.experience_years} onChange={(e) => set("experience_years", e.target.value)} /></Field>
              <Field label="Specialisations (one per line)" htmlFor="d-spec"><Textarea id="d-spec" rows={3} value={lines(form.specializations)} onChange={(e) => set("specializations", fromLines(e.target.value))} /></Field>
              <Field label="Areas of expertise (one per line)" htmlFor="d-exp2"><Textarea id="d-exp2" rows={3} value={lines(form.expertise)} onChange={(e) => set("expertise", fromLines(e.target.value))} /></Field>
              <Field label="Biography" htmlFor="d-bio" className="sm:col-span-2"><Textarea id="d-bio" rows={5} value={form.bio} onChange={(e) => set("bio", e.target.value)} /></Field>
              <Field label="Treatment philosophy" htmlFor="d-phil" className="sm:col-span-2"><Textarea id="d-phil" rows={2} value={form.philosophy} onChange={(e) => set("philosophy", e.target.value)} /></Field>
              <Field label="Photo URL" htmlFor="d-photo" hint="Leave blank to show initials."><Input id="d-photo" value={form.photo_url} onChange={(e) => set("photo_url", e.target.value)} /></Field>
              <Field label="Display order" htmlFor="d-order"><Input id="d-order" type="number" value={form.display_order} onChange={(e) => set("display_order", e.target.value)} /></Field>
              <label className="flex items-center gap-2 text-sm sm:col-span-2"><Switch checked={form.is_demo} onCheckedChange={(v) => set("is_demo", v)} /> Mark as demo profile (shows a "Demo content" label)</label>
            </div>
          </Card>
          <Card title="Working hours"><HoursEditor value={form.working_hours} onChange={(v) => set("working_hours", v)} /></Card>
          <Card title="Time off / leave"><TimeOffEditor value={form.time_off} onChange={(v) => set("time_off", v)} /></Card>
        </div>
        <div className="space-y-6">
          <Card title="Scheduling">
            <Field label="Capacity per time slot" htmlFor="d-cap" hint="Patients this doctor can see in one slot."><Input id="d-cap" type="number" min={1} max={50} value={form.capacity_per_slot} onChange={(e) => set("capacity_per_slot", e.target.value)} data-testid="doctor-capacity-input" /></Field>
          </Card>
          <Card title="Eligible services">
            <ul className="space-y-2" data-testid="doctor-services">{(services?.items || []).map((s) => <li key={s.id}><label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-brand" checked={form.service_ids.includes(s.id)} onChange={(e) => set("service_ids", e.target.checked ? [...form.service_ids, s.id] : form.service_ids.filter((x) => x !== s.id))} /> {s.name}</label></li>)}</ul>
          </Card>
          {!isNew && <Card title="Upcoming appointments"><AppointmentTable items={data.upcoming} dense emptyTitle="Nothing scheduled" /></Card>}
        </div>
      </div>
    </form>
  );
}
