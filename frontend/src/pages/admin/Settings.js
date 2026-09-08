import { useEffect, useState } from "react";
import { cloneDeep, set as setPath } from "lodash";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, PageHeader } from "@/components/shared/Primitives";
import { ErrorState, LoadingState } from "@/components/shared/States";
import { Card } from "@/components/dashboard/Widgets";
import { IntegrationBanner } from "@/pages/admin/Messages";
import { useAdminMutation, useAdminQuery } from "@/features/admin/hooks";
import { useAuth } from "@/features/auth/AuthContext";
import { api } from "@/lib/api";
import { WEEKDAYS } from "@/lib/format";
import { useSeo } from "@/lib/seo";

const TEMPLATE_VARS = "{patient_name} {clinic_name} {appointment_id} {date} {time} {service} {doctor} {address}";

function ListEditor({ items, onChange, fields, addLabel = "Add" }) {
  const update = (i, k, v) => onChange(items.map((it, j) => (j === i ? { ...it, [k]: v } : it)));
  return (
    <div className="space-y-2">
      {items.map((it, i) => <div key={i} className="flex items-start gap-2 rounded-lg border border-border p-2"><div className="grid flex-1 gap-2 sm:grid-cols-2">{fields.map((f) => f.type === "textarea" ? <Textarea key={f.key} rows={2} value={it[f.key] || ""} onChange={(e) => update(i, f.key, e.target.value)} placeholder={f.label} className={f.full ? "sm:col-span-2" : ""} /> : <Input key={f.key} value={it[f.key] || ""} onChange={(e) => update(i, f.key, e.target.value)} placeholder={f.label} className={f.full ? "sm:col-span-2" : ""} />)}</div><Button type="button" variant="ghost" size="icon" onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label="Remove"><Trash2 className="h-4 w-4 text-destructive" /></Button></div>)}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...items, Object.fromEntries(fields.map((f) => [f.key, ""]))])}><Plus className="h-4 w-4" /> {addLabel}</Button>
    </div>
  );
}

export default function Settings() {
  const { can } = useAuth();
  const canWrite = can(["OWNER"]);
  const { data, isLoading, isError, refetch } = useAdminQuery("settings", "/admin/settings");
  const integrations = useAdminQuery("integrations", "/admin/settings/integrations");
  const users = useAdminQuery("users", "/admin/users", undefined, { enabled: canWrite, retry: false });
  const [form, setForm] = useState(null);
  const [newUser, setNewUser] = useState({ email: "", name: "", password: "", role: "STAFF" });
  useEffect(() => { if (data) setForm(cloneDeep(data)); }, [data]);
  const save = useAdminMutation((body) => api.put("/admin/settings", body), { success: "Settings saved" });
  const createUser = useAdminMutation((body) => api.post("/admin/users", body), { success: "User created", onSuccess: () => setNewUser({ email: "", name: "", password: "", role: "STAFF" }) });
  const updateUser = useAdminMutation(({ id, body }) => api.patch(`/admin/users/${id}`, body), { success: "User updated" });
  useSeo({ title: "Settings · Dashboard", noindex: true });
  if (isLoading || !form) return <LoadingState rows={6} />;
  if (isError) return <ErrorState onRetry={refetch} />;
  const set = (path, value) => setForm((f) => { const next = cloneDeep(f); setPath(next, path, value); return next; });
  const submit = (e) => { e.preventDefault(); const { created_at, updated_at, organization_id, ...body } = form; save.mutate(body); };
  const T = ({ path, label, hint, rows = 4 }) => <Field label={label} htmlFor={path} hint={hint}><Textarea id={path} rows={rows} value={form.notifications.templates[path] || ""} onChange={(e) => set(`notifications.templates.${path}`, e.target.value)} disabled={!canWrite} /></Field>;

  return (
    <form onSubmit={submit} data-testid="admin-settings">
      <PageHeader title="Settings" description="Every business rule lives here — nothing is hard-coded." actions={canWrite && <Button type="submit" disabled={save.isPending} className="bg-brand hover:bg-brand-hover" data-testid="settings-save">{save.isPending ? "Saving..." : "Save all changes"}</Button>} />
      {!canWrite && <p className="mb-4 text-sm text-muted-foreground">Read-only: only the owner can change settings.</p>}
      <Tabs defaultValue="clinic">
        <TabsList className="flex h-auto flex-wrap justify-start">{[["clinic", "Clinic"], ["hours", "Hours & holidays"], ["booking", "Booking rules"], ["notifications", "Notifications"], ["whatsapp", "WhatsApp"], ["content", "Website content"], ...(canWrite ? [["users", "Users"]] : [])].map(([v, l]) => <TabsTrigger key={v} value={v} data-testid={`settings-tab-${v}`}>{l}</TabsTrigger>)}</TabsList>

        <TabsContent value="clinic" className="mt-4"><Card title="Clinic information"><fieldset disabled={!canWrite} className="grid gap-4 sm:grid-cols-2">
          <Field label="Clinic name" htmlFor="c-name" className="sm:col-span-2"><Input id="c-name" value={form.clinic.name} onChange={(e) => set("clinic.name", e.target.value)} data-testid="settings-clinic-name" /></Field>
          <Field label="Short name" htmlFor="c-short"><Input id="c-short" value={form.clinic.short_name} onChange={(e) => set("clinic.short_name", e.target.value)} /></Field>
          <Field label="Tagline" htmlFor="c-tag"><Input id="c-tag" value={form.clinic.tagline} onChange={(e) => set("clinic.tagline", e.target.value)} /></Field>
          <Field label="Contact person" htmlFor="c-person"><Input id="c-person" value={form.clinic.contact_person} onChange={(e) => set("clinic.contact_person", e.target.value)} /></Field>
          <Field label="Phone" htmlFor="c-phone"><Input id="c-phone" value={form.clinic.phone} onChange={(e) => set("clinic.phone", e.target.value)} data-testid="settings-clinic-phone" /></Field>
          <Field label="WhatsApp number" htmlFor="c-wa"><Input id="c-wa" value={form.clinic.whatsapp_number} onChange={(e) => set("clinic.whatsapp_number", e.target.value)} /></Field>
          <Field label="Email" htmlFor="c-email"><Input id="c-email" type="email" value={form.clinic.email} onChange={(e) => set("clinic.email", e.target.value)} /></Field>
          <Field label="Address line" htmlFor="c-addr" className="sm:col-span-2"><Input id="c-addr" value={form.clinic.address_line} onChange={(e) => set("clinic.address_line", e.target.value)} /></Field>
          <Field label="City" htmlFor="c-city"><Input id="c-city" value={form.clinic.city} onChange={(e) => set("clinic.city", e.target.value)} /></Field>
          <Field label="State" htmlFor="c-state"><Input id="c-state" value={form.clinic.state} onChange={(e) => set("clinic.state", e.target.value)} /></Field>
          <Field label="Pincode" htmlFor="c-pin"><Input id="c-pin" value={form.clinic.pincode} onChange={(e) => set("clinic.pincode", e.target.value)} /></Field>
          <Field label="Timezone" htmlFor="c-tz"><Input id="c-tz" value={form.clinic.timezone} onChange={(e) => set("clinic.timezone", e.target.value)} /></Field>
          <Field label="Google Maps URL" htmlFor="c-map" className="sm:col-span-2"><Input id="c-map" value={form.clinic.map_url} onChange={(e) => set("clinic.map_url", e.target.value)} /></Field>
        </fieldset></Card></TabsContent>

        <TabsContent value="hours" className="mt-4 space-y-4">
          <Card title="Clinic working hours"><fieldset disabled={!canWrite} className="space-y-2" data-testid="settings-hours">{form.working_hours.map((h, i) => <div key={h.weekday} className="flex items-center gap-3 text-sm"><Switch checked={h.is_open} onCheckedChange={(v) => set(`working_hours.${i}.is_open`, v)} aria-label={WEEKDAYS[h.weekday]} /><span className="w-24">{WEEKDAYS[h.weekday]}</span>{h.is_open ? <><Input type="time" value={h.open} onChange={(e) => set(`working_hours.${i}.open`, e.target.value)} className="h-9 w-28" /><span>–</span><Input type="time" value={h.close} onChange={(e) => set(`working_hours.${i}.close`, e.target.value)} className="h-9 w-28" /></> : <span className="text-muted-foreground">Closed</span>}</div>)}</fieldset></Card>
          <Card title="Holidays"><fieldset disabled={!canWrite}><ListEditor items={form.holidays} onChange={(v) => set("holidays", v)} fields={[{ key: "date", label: "YYYY-MM-DD" }, { key: "label", label: "Label" }]} addLabel="Add holiday" /></fieldset></Card>
        </TabsContent>

        <TabsContent value="booking" className="mt-4"><Card title="Booking & scheduling rules"><fieldset disabled={!canWrite} className="grid gap-4 sm:grid-cols-2">
          <Field label="Acceptance mode" htmlFor="b-acc" hint="AUTO confirms instantly when capacity exists. MANUAL sends every request to 'New'. PER_SERVICE uses each service's setting."><Select value={form.booking.acceptance_mode} onValueChange={(v) => set("booking.acceptance_mode", v)}><SelectTrigger id="b-acc" data-testid="settings-acceptance-mode"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="AUTO">Auto-confirm</SelectItem><SelectItem value="MANUAL">Manual confirmation</SelectItem><SelectItem value="PER_SERVICE">Per service</SelectItem></SelectContent></Select></Field>
          <Field label="Doctor assignment mode" htmlFor="b-asg" hint="AUTO/HYBRID pick the least-loaded eligible doctor; MANUAL leaves it to staff. You can always override."><Select value={form.booking.assignment_mode} onValueChange={(v) => set("booking.assignment_mode", v)}><SelectTrigger id="b-asg" data-testid="settings-assignment-mode"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="HYBRID">Hybrid (auto, staff can override)</SelectItem><SelectItem value="AUTO">Automatic</SelectItem><SelectItem value="MANUAL">Manual</SelectItem></SelectContent></Select></Field>
          <Field label="Slot length (minutes)" htmlFor="b-slot"><Input id="b-slot" type="number" min={15} max={240} step={15} value={form.booking.slot_minutes} onChange={(e) => set("booking.slot_minutes", Number(e.target.value))} /></Field>
          <Field label="Default capacity per doctor per slot" htmlFor="b-cap"><Input id="b-cap" type="number" min={1} value={form.booking.default_doctor_capacity} onChange={(e) => set("booking.default_doctor_capacity", Number(e.target.value))} /></Field>
          <Field label="Minimum notice (hours)" htmlFor="b-notice" hint="Patients cannot book closer than this to the slot."><Input id="b-notice" type="number" min={0} value={form.booking.min_notice_hours} onChange={(e) => set("booking.min_notice_hours", Number(e.target.value))} data-testid="settings-min-notice" /></Field>
          <Field label="Booking horizon (days)" htmlFor="b-horizon"><Input id="b-horizon" type="number" min={1} max={365} value={form.booking.max_horizon_days} onChange={(e) => set("booking.max_horizon_days", Number(e.target.value))} /></Field>
          <Field label="'Limited availability' threshold" htmlFor="b-lim" hint="Fraction of capacity remaining below which a slot shows as Limited (0.3 = 30%)."><Input id="b-lim" type="number" min={0} max={1} step={0.05} value={form.booking.limited_threshold} onChange={(e) => set("booking.limited_threshold", Number(e.target.value))} /></Field>
        </fieldset></Card></TabsContent>

        <TabsContent value="notifications" className="mt-4 space-y-4">
          <Card title="Channels & reminders"><fieldset disabled={!canWrite} className="grid gap-3 text-sm sm:grid-cols-2">
            <label className="flex items-center gap-2"><Switch checked={form.notifications.whatsapp_enabled} onCheckedChange={(v) => set("notifications.whatsapp_enabled", v)} data-testid="settings-whatsapp-enabled" /> WhatsApp notifications</label>
            <label className="flex items-center gap-2"><Switch checked={form.notifications.reminders_enabled} onCheckedChange={(v) => set("notifications.reminders_enabled", v)} data-testid="settings-reminders-enabled" /> Appointment reminders</label>
            <label className="flex items-center gap-2"><Switch checked={form.notifications.send_request_received} onCheckedChange={(v) => set("notifications.send_request_received", v)} /> Send "request received"</label>
            <label className="flex items-center gap-2"><Switch checked={form.notifications.send_confirmation} onCheckedChange={(v) => set("notifications.send_confirmation", v)} /> Send confirmation</label>
            <label className="flex items-center gap-2"><Switch checked={form.notifications.send_reschedule} onCheckedChange={(v) => set("notifications.send_reschedule", v)} /> Send reschedule update</label>
            <label className="flex items-center gap-2"><Switch checked={form.notifications.send_cancellation} onCheckedChange={(v) => set("notifications.send_cancellation", v)} /> Send cancellation</label>
            <Field label="Reminder lead time (hours before)" htmlFor="n-hours"><Input id="n-hours" type="number" min={1} max={168} value={form.notifications.reminder_hours_before} onChange={(e) => set("notifications.reminder_hours_before", Number(e.target.value))} /></Field>
            <div className="flex flex-col gap-2"><label className="flex items-center gap-2"><Switch checked={form.notifications.same_day_reminder_enabled} onCheckedChange={(v) => set("notifications.same_day_reminder_enabled", v)} /> Same-day reminder</label>{form.notifications.same_day_reminder_enabled && <Input type="number" min={1} max={24} value={form.notifications.same_day_reminder_hours_before} onChange={(e) => set("notifications.same_day_reminder_hours_before", Number(e.target.value))} aria-label="Same-day reminder hours before" />}</div>
          </fieldset><p className="mt-3 text-xs text-muted-foreground">Reminders are sent only for confirmed appointments, once per window, and never for bookings made after the reminder time has already passed.</p></Card>
          <Card title="Message templates"><p className="mb-3 text-xs text-muted-foreground">Placeholders: <code className="font-mono">{TEMPLATE_VARS}</code></p><div className="grid gap-4 lg:grid-cols-2"><T path="confirmation" label="Confirmation" /><T path="request_received" label="Request received (manual mode)" /><T path="reminder" label="Reminder" /><T path="rescheduled" label="Rescheduled" /><T path="cancelled" label="Cancelled" /></div></Card>
        </TabsContent>

        <TabsContent value="whatsapp" className="mt-4 space-y-4">
          {integrations.data && <IntegrationBanner configured={integrations.data.whatsapp.configured} title={integrations.data.whatsapp.configured ? "WhatsApp Business Cloud API connected" : "WhatsApp Business Cloud API — configuration required"} text="Credentials are read from the backend environment only and never exposed to the browser. After adding them, restart the backend." envVars={integrations.data.whatsapp.required_env} extra={<p className="mt-2 text-xs">Webhook URL for Meta: <code className="font-mono">{integrations.data.whatsapp.webhook_url}</code> · API {integrations.data.whatsapp.api_version}</p>} />}
          <Card title="Approved message templates (optional)"><p className="mb-3 text-xs text-muted-foreground">Business-initiated WhatsApp messages outside the 24-hour window require Meta-approved templates. Enter the approved template name per event; parameters are passed in this order: patient name, appointment ID, date, time, service, clinic name. Leave blank to send plain text (works within an open conversation window).</p><fieldset disabled={!canWrite} className="grid gap-4 sm:grid-cols-2"><Field label="Language code" htmlFor="w-lang"><Input id="w-lang" value={form.whatsapp.language_code} onChange={(e) => set("whatsapp.language_code", e.target.value)} /></Field>{["confirmation", "request_received", "reminder", "rescheduled", "cancelled"].map((k) => <Field key={k} label={`Template: ${k.replace("_", " ")}`} htmlFor={`w-${k}`}><Input id={`w-${k}`} value={form.whatsapp.template_names[k] || ""} onChange={(e) => set(`whatsapp.template_names.${k}`, e.target.value)} placeholder="meta_template_name" /></Field>)}</fieldset></Card>
        </TabsContent>

        <TabsContent value="content" className="mt-4 space-y-4">
          <Card title="Homepage"><fieldset disabled={!canWrite} className="grid gap-4"><Field label="Hero title" htmlFor="ct-hero"><Input id="ct-hero" value={form.content.hero_title} onChange={(e) => set("content.hero_title", e.target.value)} /></Field><Field label="Hero subtitle" htmlFor="ct-sub"><Textarea id="ct-sub" rows={2} value={form.content.hero_subtitle} onChange={(e) => set("content.hero_subtitle", e.target.value)} /></Field><Field label="About text" htmlFor="ct-about"><Textarea id="ct-about" rows={4} value={form.content.about_text} onChange={(e) => set("content.about_text", e.target.value)} /></Field><Field label="Trust points (one per line)" htmlFor="ct-trust"><Textarea id="ct-trust" rows={3} value={form.content.trust_points.join("\n")} onChange={(e) => set("content.trust_points", e.target.value.split("\n").filter(Boolean))} /></Field></fieldset></Card>
          <Card title="'What brings you here?' conditions"><fieldset disabled={!canWrite}><ListEditor items={form.content.conditions} onChange={(v) => set("content.conditions", v)} fields={[{ key: "key", label: "key (e.g. back_pain)" }, { key: "label", label: "Label" }, { key: "description", label: "Description", full: true }, { key: "service_slug", label: "Service slug", full: true }]} addLabel="Add condition" /></fieldset></Card>
          <Card title="FAQs"><fieldset disabled={!canWrite}><ListEditor items={form.content.faqs} onChange={(v) => set("content.faqs", v)} fields={[{ key: "question", label: "Question", full: true }, { key: "answer", label: "Answer", type: "textarea", full: true }]} addLabel="Add FAQ" /></fieldset></Card>
          <Card title="Patient journey steps"><fieldset disabled={!canWrite}><ListEditor items={form.content.journey_steps} onChange={(v) => set("content.journey_steps", v)} fields={[{ key: "title", label: "Title", full: true }, { key: "text", label: "Text", type: "textarea", full: true }]} addLabel="Add step" /></fieldset></Card>
          <Card title="Why choose us"><fieldset disabled={!canWrite}><ListEditor items={form.content.why_choose_us} onChange={(v) => set("content.why_choose_us", v)} fields={[{ key: "title", label: "Title", full: true }, { key: "text", label: "Text", type: "textarea", full: true }]} addLabel="Add point" /></fieldset></Card>
        </TabsContent>

        {canWrite && <TabsContent value="users" className="mt-4 space-y-4">
          <Card title="Team accounts">
            <ul className="divide-y divide-border" data-testid="users-list">{(users.data?.items || []).map((u) => <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"><div><p className="font-medium">{u.name} <span className="text-xs text-muted-foreground">· {u.email}</span></p><p className="text-xs text-muted-foreground">{u.role}{u.mfa_enabled ? " · MFA on" : ""}{!u.is_active ? " · inactive" : ""}</p></div>{u.role !== "OWNER" && <div className="flex items-center gap-2"><Select value={u.role} onValueChange={(v) => updateUser.mutate({ id: u.id, body: { role: v } })}><SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger><SelectContent>{["ADMIN", "STAFF", "DOCTOR"].map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select><Switch checked={u.is_active} onCheckedChange={(v) => updateUser.mutate({ id: u.id, body: { is_active: v } })} aria-label="Active" /></div>}</li>)}</ul>
          </Card>
          <Card title="Invite a team member"><div className="grid gap-3 sm:grid-cols-4"><Input placeholder="Name" value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} data-testid="new-user-name" /><Input type="email" placeholder="Email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} data-testid="new-user-email" /><Input type="password" placeholder="Temporary password (10+)" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} data-testid="new-user-password" /><Select value={newUser.role} onValueChange={(v) => setNewUser({ ...newUser, role: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["ADMIN", "STAFF", "DOCTOR"].map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select></div><Button type="button" className="mt-3 bg-brand hover:bg-brand-hover" disabled={!newUser.email || !newUser.name || newUser.password.length < 10 || createUser.isPending} onClick={() => createUser.mutate(newUser)} data-testid="new-user-submit">Create account</Button><p className="mt-2 text-xs text-muted-foreground">Roles: ADMIN manages everything except settings/users; STAFF handles appointments and patients; DOCTOR is read-only.</p></Card>
        </TabsContent>}
      </Tabs>
    </form>
  );
}
