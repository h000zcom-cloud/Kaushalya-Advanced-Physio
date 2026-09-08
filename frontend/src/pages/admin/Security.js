import { useState } from "react";
import { toast } from "sonner";
import { KeyRound, ShieldCheck, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, PageHeader } from "@/components/shared/Primitives";
import { LoadingState } from "@/components/shared/States";
import { Card } from "@/components/dashboard/Widgets";
import { useAdminMutation, useAdminQuery } from "@/features/admin/hooks";
import { useAuth } from "@/features/auth/AuthContext";
import { api, getErrorMessage } from "@/lib/api";
import { formatDateTime, fromNow } from "@/lib/format";
import { useSeo } from "@/lib/seo";

export default function Security() {
  const { user, refreshUser } = useAuth();
  const sessions = useAdminQuery("sessions", "/auth/sessions");
  const [pw, setPw] = useState({ current_password: "", new_password: "", confirm: "" });
  const [setup, setSetup] = useState(null);
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState(null);
  const [disable, setDisable] = useState({ password: "", code: "" });
  const [busy, setBusy] = useState(false);
  useSeo({ title: "Security · Dashboard", noindex: true });
  const revoke = useAdminMutation((id) => api.delete(`/auth/sessions/${id}`), { success: "Session signed out", invalidate: ["sessions"] });

  const run = async (fn, okMessage) => { setBusy(true); try { await fn(); if (okMessage) toast.success(okMessage); } catch (e) { toast.error(getErrorMessage(e)); } finally { setBusy(false); } };
  const changePassword = (e) => { e.preventDefault(); if (pw.new_password !== pw.confirm) return toast.error("New passwords do not match."); return run(async () => { await api.post("/auth/change-password", { current_password: pw.current_password, new_password: pw.new_password }); setPw({ current_password: "", new_password: "", confirm: "" }); }, "Password updated. Other sessions were signed out."); };
  const startSetup = () => run(async () => { const { data } = await api.post("/auth/mfa/setup"); setSetup(data); });
  const enable = (e) => { e.preventDefault(); return run(async () => { const { data } = await api.post("/auth/mfa/enable", { code }); setRecovery(data.recovery_codes); setSetup(null); setCode(""); await refreshUser(); }, "Two-factor authentication enabled"); };
  const disableMfa = (e) => { e.preventDefault(); return run(async () => { await api.post("/auth/mfa/disable", disable); setDisable({ password: "", code: "" }); await refreshUser(); }, "Two-factor authentication disabled"); };

  return (
    <div data-testid="admin-security">
      <PageHeader title="Security & account" description={`Signed in as ${user?.email} (${user?.role})`} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Two-factor authentication (TOTP)" testId="mfa-card">
          {user?.mfa_enabled ? (
            <div>
              <p className="flex items-center gap-2 text-sm font-medium text-[#047857]"><ShieldCheck className="h-4 w-4" /> Enabled — a code from your authenticator app is required at sign in.</p>
              <form onSubmit={disableMfa} className="mt-4 grid gap-3 sm:grid-cols-2"><Input type="password" placeholder="Current password" value={disable.password} onChange={(e) => setDisable({ ...disable, password: e.target.value })} required data-testid="mfa-disable-password" /><Input placeholder="6-digit code" value={disable.code} onChange={(e) => setDisable({ ...disable, code: e.target.value })} required data-testid="mfa-disable-code" /><Button type="submit" variant="outline" disabled={busy} className="sm:col-span-2" data-testid="mfa-disable-submit"><ShieldOff className="h-4 w-4" /> Disable two-factor</Button></form>
            </div>
          ) : setup ? (
            <form onSubmit={enable} className="space-y-4" data-testid="mfa-setup-form">
              <p className="text-sm text-muted-foreground">Scan this QR code with Google Authenticator, Authy or any TOTP app, then enter the 6-digit code.</p>
              <div className="flex flex-col items-center gap-3 sm:flex-row"><img src={setup.qr_data_url} alt="MFA QR code" className="h-44 w-44 rounded-lg border border-border" data-testid="mfa-qr" /><div className="text-xs text-muted-foreground"><p>Can't scan? Enter this key manually:</p><code className="mt-1 block break-all rounded bg-muted p-2 font-mono text-[11px]" data-testid="mfa-secret">{setup.secret}</code></div></div>
              <div className="flex gap-2"><Input placeholder="123456" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} required data-testid="mfa-enable-code" /><Button type="submit" disabled={busy || code.length !== 6} className="bg-brand hover:bg-brand-hover" data-testid="mfa-enable-submit">Verify & enable</Button></div>
            </form>
          ) : recovery ? (
            <div data-testid="mfa-recovery-codes"><p className="text-sm font-medium text-[#047857]">Two-factor is on. Save these one-time recovery codes somewhere safe — they will not be shown again.</p><ul className="mt-3 grid grid-cols-2 gap-1 font-mono text-sm">{recovery.map((c) => <li key={c} className="rounded bg-muted px-2 py-1">{c}</li>)}</ul><Button type="button" variant="outline" className="mt-3" onClick={() => setRecovery(null)}>I've saved them</Button></div>
          ) : (
            <div><p className="text-sm text-muted-foreground">Strongly recommended for the owner account. Adds a second step using an authenticator app.</p><Button type="button" onClick={startSetup} disabled={busy} className="mt-4 bg-brand hover:bg-brand-hover" data-testid="mfa-setup-button"><ShieldCheck className="h-4 w-4" /> Set up two-factor</Button></div>
          )}
        </Card>
        <Card title="Change password">
          <form onSubmit={changePassword} className="space-y-3" data-testid="change-password-form">
            <Field label="Current password" htmlFor="cp-cur"><Input id="cp-cur" type="password" autoComplete="current-password" value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} required data-testid="cp-current" /></Field>
            <Field label="New password" htmlFor="cp-new" hint="At least 10 characters."><Input id="cp-new" type="password" autoComplete="new-password" minLength={10} value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} required data-testid="cp-new" /></Field>
            <Field label="Confirm new password" htmlFor="cp-conf"><Input id="cp-conf" type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} required data-testid="cp-confirm" /></Field>
            <Button type="submit" disabled={busy} variant="outline" data-testid="cp-submit"><KeyRound className="h-4 w-4" /> Update password</Button>
          </form>
        </Card>
        <Card title="Active sessions" className="lg:col-span-2">
          {sessions.isLoading ? <LoadingState rows={2} /> : <ul className="divide-y divide-border" data-testid="sessions-list">{(sessions.data?.items || []).map((s) => <li key={s.id} className="flex items-center justify-between py-2 text-sm"><div><p className="font-medium">{s.current ? "This device" : "Other session"} <span className="text-xs text-muted-foreground">· {s.ip}</span></p><p className="text-xs text-muted-foreground">Signed in {formatDateTime(s.created_at)} · last seen {fromNow(s.last_seen_at || s.created_at)} · {s.user_agent?.slice(0, 60)}</p></div>{!s.current && <Button size="sm" variant="outline" onClick={() => revoke.mutate(s.id)}>Sign out</Button>}</li>)}</ul>}
        </Card>
      </div>
    </div>
  );
}

export function AuditLog() {
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState("");
  const { data, isLoading } = useAdminQuery("audit", "/admin/audit-logs", { page, page_size: 50, resource: filter || undefined });
  useSeo({ title: "Audit log · Dashboard", noindex: true });
  return (
    <div data-testid="admin-audit">
      <PageHeader title="Audit log" description="Who did what, and when. Sensitive data is never stored in log metadata." actions={<select value={filter} onChange={(e) => { setFilter(e.target.value); setPage(1); }} className="h-9 rounded-md border border-input bg-white px-3 text-sm" aria-label="Resource filter" data-testid="audit-resource-filter"><option value="">All resources</option>{["appointment", "patient", "doctor", "service", "clinic_settings", "user", "testimonial", "capacity_override", "appointments", "patients", "callback_request"].map((r) => <option key={r} value={r}>{r}</option>)}</select>} />
      {isLoading ? <LoadingState rows={8} /> : (
        <div className="overflow-x-auto rounded-xl border border-border bg-white"><table className="admin-table w-full min-w-[720px]" data-testid="audit-table"><thead className="border-b border-border bg-muted/50"><tr><th>When</th><th>User</th><th>Action</th><th>Resource</th><th>Details</th><th>IP</th></tr></thead><tbody className="divide-y divide-border">{(data?.items || []).map((a) => <tr key={a.id}><td className="whitespace-nowrap text-xs">{formatDateTime(a.created_at)}</td><td className="text-xs">{a.user_name || a.user_email || "System"}</td><td className="font-medium">{a.action.replaceAll("_", " ")}</td><td className="text-xs text-muted-foreground">{a.resource}</td><td className="max-w-xs truncate font-mono text-[11px] text-muted-foreground">{Object.entries(a.metadata || {}).filter(([, v]) => v !== null && v !== "").map(([k, v]) => `${k}=${Array.isArray(v) ? v.join(",") : v}`).join(" ")}</td><td className="text-xs text-muted-foreground">{a.ip}</td></tr>)}</tbody></table></div>
      )}
      {data && data.total > 50 && <div className="mt-3 flex justify-end gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button><Button variant="outline" size="sm" disabled={page * 50 >= data.total} onClick={() => setPage(page + 1)}>Next</Button></div>}
    </div>
  );
}
