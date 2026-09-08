import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { AlertTriangle, Download, Mail, MessageCircle, Pencil, Phone, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, PageHeader, PersonAvatar } from "@/components/shared/Primitives";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/States";
import { AppointmentTable, Card, Pagination } from "@/components/dashboard/Widgets";
import { useAdminMutation, useAdminQuery } from "@/features/admin/hooks";
import { useAuth } from "@/features/auth/AuthContext";
import { API_BASE, api } from "@/lib/api";
import { displayPhone, formatDateTime, fromNow, telLink, waLink } from "@/lib/format";
import { useSeo } from "@/lib/seo";

export default function Patients() {
  const [params, setParams] = useSearchParams();
  const { can } = useAuth();
  const query = { search: params.get("q") || undefined, duplicate_review: params.get("dup") ? true : undefined, page: Number(params.get("page") || 1), page_size: 25 };
  const { data, isLoading, isError, refetch } = useAdminQuery("patients", "/admin/patients", query);
  useSeo({ title: "Patients · Dashboard", noindex: true });
  return (
    <div data-testid="admin-patients">
      <PageHeader title="Patients" description="One record per person, linked to every appointment." actions={can(["OWNER", "ADMIN"]) && <Button asChild variant="outline" size="sm"><a href={`${API_BASE}/admin/patients/export.csv`} data-testid="patients-export"><Download className="h-4 w-4" /> Export CSV</a></Button>} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input defaultValue={params.get("q") || ""} onKeyDown={(e) => e.key === "Enter" && setParams({ q: e.target.value })} placeholder="Search by name or phone, then Enter" className="bg-white pl-9" data-testid="patients-search" /></div>
        <Button variant={params.get("dup") ? "default" : "outline"} onClick={() => setParams(params.get("dup") ? {} : { dup: "1" })} data-testid="patients-duplicates-filter"><AlertTriangle className="h-4 w-4" /> Needs review</Button>
      </div>
      <div className="mt-4">
        {isLoading && <LoadingState rows={8} />}
        {isError && <ErrorState onRetry={refetch} />}
        {data && (data.items.length === 0 ? <EmptyState title="No patients found" text="Patients are created automatically when appointments are booked." /> : (
          <div className="overflow-x-auto rounded-xl border border-border bg-white"><table className="admin-table w-full min-w-[640px]" data-testid="patients-table"><thead className="border-b border-border bg-muted/50"><tr><th>Patient</th><th>Phone</th><th>Appointments</th><th>Last visit</th><th>Registered</th><th /></tr></thead><tbody className="divide-y divide-border">
            {data.items.map((p) => <tr key={p.id} className="hover:bg-brand-soft/40" data-testid={`patient-row-${p.id}`}><td><Link to={`/admin/patients/${p.id}`} className="font-medium hover:text-brand">{p.name}</Link>{p.duplicate_review && <span className="ml-2 rounded-full bg-[#FFFBEB] px-2 py-0.5 text-[10px] font-semibold text-[#B45309]">Review</span>}</td><td>{displayPhone(p.phone)}</td><td>{p.total_appointments}</td><td>{p.last_appointment_at ? formatDateTime(p.last_appointment_at) : "—"}</td><td className="text-muted-foreground">{fromNow(p.created_at)}</td><td className="text-right"><Link to={`/admin/patients/${p.id}`} className="text-xs font-semibold text-brand hover:underline">Open</Link></td></tr>)}
          </tbody></table></div>
        ))}
        {data && <Pagination page={data.page} pageSize={data.page_size} total={data.total} onChange={(p) => setParams({ ...Object.fromEntries(params), page: String(p) })} />}
      </div>
    </div>
  );
}

export function PatientDetail() {
  const { id } = useParams();
  const { can } = useAuth();
  const { data, isLoading, isError, refetch } = useAdminQuery(`patient-${id}`, `/admin/patients/${id}`);
  const [edit, setEdit] = useState(null);
  const [note, setNote] = useState("");
  const save = useAdminMutation((body) => api.patch(`/admin/patients/${id}`, body), { success: "Patient updated", onSuccess: () => setEdit(null) });
  const addNote = useAdminMutation(() => api.post(`/admin/patients/${id}/notes`, { text: note }), { success: "Note added", onSuccess: () => setNote("") });
  useSeo({ title: "Patient · Dashboard", noindex: true });
  if (isLoading) return <LoadingState rows={6} />;
  if (isError || !data) return <ErrorState onRetry={refetch} />;
  const p = data.patient;
  const upcoming = data.appointments.filter((a) => ["NEW", "CONTACTED", "CONFIRMED", "ASSIGNED", "RESCHEDULED"].includes(a.status));
  return (
    <div data-testid="admin-patient-detail">
      <Link to="/admin/patients" className="text-sm text-muted-foreground hover:text-foreground">← Patients</Link>
      <div className="mt-3 flex flex-col gap-4 rounded-xl border border-border bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4"><PersonAvatar name={p.name} size="lg" /><div><h1 className="font-admin text-2xl font-bold" data-testid="patient-name">{p.name}</h1><p className="text-sm text-muted-foreground">{displayPhone(p.phone)}{p.email ? ` · ${p.email}` : ""} · {p.total_appointments} appointment(s) · since {formatDateTime(p.created_at)}</p>{p.duplicate_review && <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-[#FFFBEB] px-2 py-0.5 text-xs font-semibold text-[#B45309]"><AlertTriangle className="h-3 w-3" /> Same number as another patient — please review</p>}</div></div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm"><a href={telLink(p.phone)} data-testid="patient-call"><Phone className="h-4 w-4" /> Call</a></Button>
          <Button asChild variant="outline" size="sm" className="border-wa/40 text-wa hover:bg-wa/5 hover:text-wa"><a href={waLink(p.phone)} target="_blank" rel="noreferrer" data-testid="patient-whatsapp"><MessageCircle className="h-4 w-4" /> WhatsApp</a></Button>
          {p.email && <Button asChild variant="outline" size="sm"><a href={`mailto:${p.email}`} data-testid="patient-email"><Mail className="h-4 w-4" /> Email</a></Button>}
          {can(["OWNER", "ADMIN", "STAFF"]) && <Button size="sm" onClick={() => setEdit({ name: p.name, phone: p.phone, email: p.email || "", status: p.status || "ACTIVE", duplicate_review: p.duplicate_review })} data-testid="patient-edit" className="bg-brand hover:bg-brand-hover"><Pencil className="h-4 w-4" /> Edit</Button>}
        </div>
      </div>
      {data.duplicates.length > 0 && <Card title="Other records with this number" className="mt-4"><ul className="space-y-1 text-sm">{data.duplicates.map((d) => <li key={d.id}><Link to={`/admin/patients/${d.id}`} className="font-medium text-brand hover:underline">{d.name}</Link> · {d.total_appointments} appointment(s)</li>)}</ul></Card>}
      <Tabs defaultValue="appointments" className="mt-6">
        <TabsList><TabsTrigger value="appointments" data-testid="tab-appointments">Appointments</TabsTrigger><TabsTrigger value="notes" data-testid="tab-notes">Notes</TabsTrigger><TabsTrigger value="messages" data-testid="tab-messages">Messages</TabsTrigger><TabsTrigger value="activity" data-testid="tab-activity">Activity</TabsTrigger></TabsList>
        <TabsContent value="appointments" className="mt-4 space-y-4">
          {upcoming.length > 0 && <Card title="Upcoming"><AppointmentTable items={upcoming} dense /></Card>}
          <Card title="History"><AppointmentTable items={data.appointments} dense emptyTitle="No appointments yet" /></Card>
        </TabsContent>
        <TabsContent value="notes" className="mt-4">
          <Card title="Internal notes">
            {can(["OWNER", "ADMIN", "STAFF"]) && <div className="mb-4 flex gap-2"><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note visible to staff only" data-testid="patient-note-input" /><Button onClick={() => addNote.mutate()} disabled={!note.trim() || addNote.isPending} data-testid="patient-note-submit">Add</Button></div>}
            {data.notes.length === 0 ? <EmptyState title="No notes" /> : <ul className="space-y-2">{data.notes.map((n) => <li key={n.id} className="rounded-lg border border-border px-3 py-2 text-sm"><p>{n.text}</p><p className="mt-1 text-xs text-muted-foreground">{n.author_name} · {formatDateTime(n.created_at)}</p></li>)}</ul>}
          </Card>
        </TabsContent>
        <TabsContent value="messages" className="mt-4"><Card title="WhatsApp notifications">{data.notifications.length === 0 ? <EmptyState title="No messages logged" text="Automated WhatsApp notifications for this patient appear here." /> : <ul className="space-y-2">{data.notifications.map((n) => <li key={n.id} className="rounded-lg border border-border px-3 py-2 text-sm"><div className="flex justify-between"><span className="font-medium capitalize">{n.template_key?.replace("_", " ")} · {n.appointment_public_id}</span><span className="rounded-full bg-muted px-2 py-0.5 text-[11px]">{n.status.replaceAll("_", " ")}</span></div><p className="mt-1 whitespace-pre-line text-xs text-muted-foreground">{n.body}</p></li>)}</ul>}</Card></TabsContent>
        <TabsContent value="activity" className="mt-4"><Card title="Audit activity">{data.audit.length === 0 ? <EmptyState title="No activity" /> : <ul className="divide-y divide-border">{data.audit.map((a) => <li key={a.id} className="flex justify-between py-2 text-sm"><span>{a.action.replaceAll("_", " ")} <span className="text-muted-foreground">· {a.user_name || "System"}</span></span><span className="text-xs text-muted-foreground">{formatDateTime(a.created_at)}</span></li>)}</ul>}</Card></TabsContent>
      </Tabs>
      <Dialog open={!!edit} onOpenChange={() => setEdit(null)}>
        <DialogContent data-testid="patient-edit-dialog">
          <DialogHeader><DialogTitle className="font-admin">Edit patient</DialogTitle></DialogHeader>
          {edit && <div className="grid gap-4">
            <Field label="Name" htmlFor="pe-name"><Input id="pe-name" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label="Phone" htmlFor="pe-phone"><Input id="pe-phone" value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} /></Field>
            <Field label="Email" htmlFor="pe-email"><Input id="pe-email" type="email" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></Field>
            <Field label="Status" htmlFor="pe-status"><Select value={edit.status} onValueChange={(v) => setEdit({ ...edit, status: v })}><SelectTrigger id="pe-status"><SelectValue /></SelectTrigger><SelectContent>{["ACTIVE", "INACTIVE", "BLOCKED"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={edit.duplicate_review} onChange={(e) => setEdit({ ...edit, duplicate_review: e.target.checked })} className="accent-brand" /> Flag for duplicate review</label>
          </div>}
          <DialogFooter><Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button><Button onClick={() => save.mutate(edit)} disabled={save.isPending} className="bg-brand hover:bg-brand-hover" data-testid="patient-edit-save">Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
