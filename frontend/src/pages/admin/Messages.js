import { useState } from "react";
import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/shared/Primitives";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/States";
import { Card } from "@/components/dashboard/Widgets";
import { useAppointmentDrawer } from "@/components/dashboard/AppointmentDrawer";
import { useAdminMutation, useAdminQuery } from "@/features/admin/hooks";
import { useAuth } from "@/features/auth/AuthContext";
import { api } from "@/lib/api";
import { displayPhone, formatDateTime, fromNow, telLink, waLink } from "@/lib/format";
import { useSeo } from "@/lib/seo";
import { cn } from "@/lib/utils";

const STATUS_TONE = { sent: "bg-[#ECFDF5] text-[#047857]", delivered: "bg-[#ECFDF5] text-[#047857]", queued: "bg-[#EFF6FF] text-[#1D4ED8]", sending: "bg-[#EFF6FF] text-[#1D4ED8]", failed: "bg-[#FEF2F2] text-[#B91C1C]", skipped_not_configured: "bg-[#FFFBEB] text-[#B45309]" };

export function IntegrationBanner({ configured, title, text, envVars, extra }) {
  return (
    <div role="status" data-testid={`integration-banner-${configured ? "ok" : "required"}`} className={cn("flex items-start gap-3 rounded-xl border p-4 text-sm", configured ? "border-[#A7F3D0] bg-[#ECFDF5] text-[#065F46]" : "border-[#FDE68A] bg-[#FFFBEB] text-[#92400E]")}>
      {configured ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
      <div><p className="font-semibold">{title}</p><p className="mt-0.5">{text}</p>{!configured && envVars && <p className="mt-2 font-mono text-xs">{envVars.join(" · ")}</p>}{extra}</div>
    </div>
  );
}

export default function Messages() {
  const [status, setStatus] = useState("");
  const { can } = useAuth();
  const { openAppointment } = useAppointmentDrawer();
  const notifications = useAdminQuery("notifications", "/admin/notifications", { channel: "whatsapp", status: status || undefined, page_size: 100 });
  const integrations = useAdminQuery("integrations", "/admin/settings/integrations", undefined, { retry: false, enabled: can(["OWNER", "ADMIN"]) });
  const conversations = useAdminQuery("conversations", "/admin/conversations");
  const [convId, setConvId] = useState(null);
  const messages = useAdminQuery(`conv-${convId}`, `/admin/conversations/${convId}/messages`, undefined, { enabled: !!convId });
  const outbox = useAdminQuery("email-outbox", "/admin/email-outbox", undefined, { retry: false, enabled: can(["OWNER"]) });
  const retry = useAdminMutation((id) => api.post(`/admin/notifications/${id}/retry`), { success: (d) => (d.data?.retried ? "Retry queued" : d.data?.reason || "Could not retry") });
  useSeo({ title: "Messages · Dashboard", noindex: true });
  const wa = integrations.data?.whatsapp;
  const configured = notifications.data?.whatsapp_configured ?? wa?.configured;

  return (
    <div data-testid="admin-messages">
      <PageHeader title="Messages" description="WhatsApp Business API activity: automated notifications, delivery status and inbound replies." />
      {configured !== undefined && <IntegrationBanner configured={configured} title={configured ? "WhatsApp Business API connected" : "WhatsApp Business API — configuration required"} text={configured ? "Transactional messages are sent through the official Cloud API. Webhook status updates appear below." : "Messages are composed and logged but not sent until Meta credentials are added to the backend environment and the service is restarted."} envVars={wa?.required_env} extra={wa && <p className="mt-2 text-xs">Webhook URL: <code className="font-mono">{wa.webhook_url}</code> · Webhook verify: {wa.webhook_configured ? "configured" : "not configured"}</p>} />}
      <Tabs defaultValue="notifications" className="mt-6">
        <TabsList><TabsTrigger value="notifications" data-testid="tab-notifications">Notifications</TabsTrigger><TabsTrigger value="conversations" data-testid="tab-conversations">Conversations</TabsTrigger>{can(["OWNER"]) && <TabsTrigger value="email" data-testid="tab-email">Email outbox</TabsTrigger>}</TabsList>
        <TabsContent value="notifications" className="mt-4">
          <div className="mb-3 flex items-center gap-2"><Select value={status || "all"} onValueChange={(v) => setStatus(v === "all" ? "" : v)}><SelectTrigger className="h-9 w-56" data-testid="notifications-status-filter"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem>{["queued", "sent", "failed", "skipped_not_configured"].map((s) => <SelectItem key={s} value={s}>{s.replaceAll("_", " ")}</SelectItem>)}</SelectContent></Select></div>
          {notifications.isLoading && <LoadingState rows={6} />}
          {notifications.isError && <ErrorState onRetry={notifications.refetch} />}
          {notifications.data && (notifications.data.items.length === 0 ? <EmptyState title="No notifications yet" text="Automated messages are created when appointments are booked, confirmed, rescheduled or cancelled." /> : (
            <ul className="space-y-2" data-testid="notifications-list">{notifications.data.items.map((n) => (
              <li key={n.id} className="rounded-xl border border-border bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2 text-sm"><button type="button" onClick={() => openAppointment(n.appointment_id)} className="font-mono text-xs text-brand hover:underline">{n.appointment_public_id}</button><span className="font-medium capitalize">{n.template_key?.replaceAll("_", " ")}</span><span className="text-muted-foreground">→ {displayPhone(n.to_phone)}</span></div>
                  <div className="flex items-center gap-2"><span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", STATUS_TONE[n.status] || "bg-muted")}>{n.status.replaceAll("_", " ")}{n.delivery_status ? ` · ${n.delivery_status}` : ""}</span>{n.status === "failed" && configured && <Button size="sm" variant="outline" onClick={() => retry.mutate(n.id)} data-testid={`retry-${n.id}`}><RefreshCw className="h-3.5 w-3.5" /> Retry</Button>}</div>
                </div>
                <details className="mt-2 text-sm"><summary className="cursor-pointer text-xs text-muted-foreground">Message preview · {formatDateTime(n.created_at)}{n.attempts ? ` · ${n.attempts} attempt(s)` : ""}</summary><pre className="mt-2 whitespace-pre-wrap rounded-lg bg-muted p-3 font-sans text-xs">{n.body}</pre>{n.error && <p className="mt-1 text-xs text-[#B45309]">{n.error}</p>}</details>
              </li>
            ))}</ul>
          ))}
        </TabsContent>
        <TabsContent value="conversations" className="mt-4">
          {conversations.data && !conversations.data.webhook_configured && <p className="mb-3 text-sm text-muted-foreground">Inbound replies appear here only after the WhatsApp webhook is configured and verified with Meta. Until then, use the WhatsApp button on any appointment or patient to chat from your phone.</p>}
          {conversations.isLoading && <LoadingState rows={4} />}
          {conversations.data && (conversations.data.items.length === 0 ? <EmptyState title="No conversations yet" text="Sent and received WhatsApp messages will be grouped by patient number here." /> : (
            <div className="grid gap-4 lg:grid-cols-3">
              <ul className="space-y-1 lg:col-span-1">{conversations.data.items.map((c) => <li key={c.id}><button type="button" onClick={() => setConvId(c.id)} className={cn("w-full rounded-lg border px-3 py-2 text-left text-sm", convId === c.id ? "border-brand bg-brand-soft/40" : "border-border bg-white")}><span className="font-medium">{c.display_name || displayPhone(c.phone)}</span><span className="block text-xs text-muted-foreground">{displayPhone(c.phone)} · {fromNow(c.last_message_at)}</span>{c.unread_count > 0 && <span className="ml-1 rounded-full bg-brand px-1.5 text-[10px] text-white">{c.unread_count}</span>}</button></li>)}</ul>
              <Card className="lg:col-span-2" title="Messages" action={convId && <a href={waLink(conversations.data.items.find((c) => c.id === convId)?.phone)} target="_blank" rel="noreferrer" className="text-xs font-semibold text-wa">Reply in WhatsApp</a>}>
                {!convId ? <p className="text-sm text-muted-foreground">Select a conversation.</p> : messages.isLoading ? <LoadingState rows={3} /> : <ul className="space-y-2">{(messages.data?.items || []).map((m) => <li key={m.id} className={cn("max-w-[85%] rounded-lg px-3 py-2 text-sm", m.direction === "outbound" ? "ml-auto bg-brand text-white" : "bg-muted")}><p className="whitespace-pre-wrap">{m.body}</p><p className={cn("mt-1 text-[10px]", m.direction === "outbound" ? "text-white/70" : "text-muted-foreground")}>{formatDateTime(m.created_at)}{m.delivery_status ? ` · ${m.delivery_status}` : ""}</p></li>)}</ul>}
              </Card>
            </div>
          ))}
        </TabsContent>
        {can(["OWNER"]) && <TabsContent value="email" className="mt-4">
          {outbox.data && <IntegrationBanner configured={outbox.data.email_configured} title={outbox.data.email_configured ? "Email provider connected" : "Email — configuration required"} text={outbox.data.email_configured ? "Password-reset and operational emails are delivered via Resend." : "Emails (e.g. password reset links) are logged to the server log instead of being sent. Add RESEND_API_KEY and EMAIL_FROM to enable delivery."} envVars={["RESEND_API_KEY", "EMAIL_FROM"]} />}
          <ul className="mt-4 space-y-2">{(outbox.data?.items || []).map((e) => <li key={e.id} className="flex items-center justify-between rounded-lg border border-border bg-white px-3 py-2 text-sm"><span><span className="font-medium">{e.subject}</span><span className="block text-xs text-muted-foreground">to {e.to} · {formatDateTime(e.created_at)}</span></span><span className="rounded-full bg-muted px-2 py-0.5 text-[11px]">{e.status.replaceAll("_", " ")}</span></li>)}</ul>
        </TabsContent>}
      </Tabs>
    </div>
  );
}

export function Callbacks() {
  const [status, setStatus] = useState("");
  const { data, isLoading, isError, refetch } = useAdminQuery("callbacks", "/admin/callbacks", { status: status || undefined, page_size: 100 });
  const [notes, setNotes] = useState({});
  const update = useAdminMutation(({ id, body }) => api.patch(`/admin/callbacks/${id}`, body), { success: "Callback updated" });
  useSeo({ title: "Callbacks · Dashboard", noindex: true });
  return (
    <div data-testid="admin-callbacks">
      <PageHeader title="Callback requests" description="Visitors who asked to be called back instead of booking." actions={<Select value={status || "all"} onValueChange={(v) => setStatus(v === "all" ? "" : v)}><SelectTrigger className="h-9 w-40" data-testid="callbacks-status-filter"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem>{["NEW", "CONTACTED", "CLOSED"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>} />
      {isLoading && <LoadingState rows={5} />}
      {isError && <ErrorState onRetry={refetch} />}
      {data && (data.items.length === 0 ? <EmptyState title="No callback requests" text="Requests from the website contact page appear here." /> : (
        <ul className="space-y-2" data-testid="callbacks-list">{data.items.map((c) => (
          <li key={c.id} className="rounded-xl border border-border bg-white p-4" data-testid={`callback-${c.id}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><p className="font-admin font-semibold">{c.name} <span className={cn("ml-2 rounded-full px-2 py-0.5 text-[11px] font-semibold", c.status === "NEW" ? "bg-[#EFF6FF] text-[#1D4ED8]" : c.status === "CONTACTED" ? "bg-[#F5F3FF] text-[#6D28D9]" : "bg-muted text-muted-foreground")}>{c.status}</span></p><p className="text-sm text-muted-foreground">{displayPhone(c.phone)}{c.preferred_time ? ` · prefers ${c.preferred_time}` : ""} · {fromNow(c.created_at)}</p>{c.reason && <p className="mt-1 text-sm">{c.reason}</p>}</div>
              <div className="flex gap-2"><Button asChild size="sm" variant="outline"><a href={telLink(c.phone)}>Call</a></Button><Button asChild size="sm" variant="outline" className="border-wa/40 text-wa"><a href={waLink(c.phone)} target="_blank" rel="noreferrer">WhatsApp</a></Button></div>
            </div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row"><Textarea rows={1} placeholder="Outcome note" defaultValue={c.note || ""} onChange={(e) => setNotes({ ...notes, [c.id]: e.target.value })} className="min-h-9" /><div className="flex gap-2">{c.status !== "CONTACTED" && <Button size="sm" variant="outline" onClick={() => update.mutate({ id: c.id, body: { status: "CONTACTED", note: notes[c.id] ?? c.note } })} data-testid={`callback-contacted-${c.id}`}>Mark contacted</Button>}{c.status !== "CLOSED" && <Button size="sm" onClick={() => update.mutate({ id: c.id, body: { status: "CLOSED", note: notes[c.id] ?? c.note } })} className="bg-brand hover:bg-brand-hover" data-testid={`callback-close-${c.id}`}>Close</Button>}</div></div>
          </li>
        ))}</ul>
      ))}
    </div>
  );
}
