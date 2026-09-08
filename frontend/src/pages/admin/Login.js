import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Field } from "@/components/shared/Primitives";
import { Spinner } from "@/components/shared/States";
import { useAuth } from "@/features/auth/AuthContext";
import { api, getErrorMessage } from "@/lib/api";
import { useSeo } from "@/lib/seo";

function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="admin-shell flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center gap-2.5"><span className="flex h-9 w-9 items-center justify-center rounded-md bg-brand font-serif text-lg font-semibold text-white">K</span><span className="font-admin text-sm font-bold">Kaushalya Physio · Clinic dashboard</span></Link>
        <div className="rounded-2xl border border-border bg-white p-6 shadow-card sm:p-8">
          <h1 className="font-admin text-2xl font-bold">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
        {footer && <div className="mt-4 text-center text-sm text-muted-foreground">{footer}</div>}
      </div>
    </div>
  );
}

export default function Login() {
  const { user, login, verifyMfa } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [mfaToken, setMfaToken] = useState(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useSeo({ title: "Staff sign in", noindex: true });
  if (user) return <Navigate to={location.state?.from || "/admin"} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const res = await login(form.email.trim(), form.password);
      if (res.mfaRequired) setMfaToken(res.mfaToken); else navigate(location.state?.from || "/admin", { replace: true });
    } catch (err) { setError(getErrorMessage(err)); } finally { setBusy(false); }
  };
  const submitCode = async (e) => {
    e.preventDefault();
    setBusy(true); setError("");
    try { await verifyMfa(mfaToken, code); navigate("/admin", { replace: true }); } catch (err) { setError(getErrorMessage(err)); setCode(""); } finally { setBusy(false); }
  };

  if (mfaToken) {
    return (
      <AuthShell title="Two-factor check" subtitle="Enter the 6-digit code from your authenticator app, or a recovery code.">
        <form onSubmit={submitCode} className="space-y-5" data-testid="mfa-form">
          <div className="flex justify-center"><InputOTP maxLength={6} value={code} onChange={setCode} data-testid="mfa-code-input"><InputOTPGroup>{[0, 1, 2, 3, 4, 5].map((i) => <InputOTPSlot key={i} index={i} className="h-12 w-11 text-lg" />)}</InputOTPGroup></InputOTP></div>
          <details className="text-sm text-muted-foreground"><summary className="cursor-pointer">Use a recovery code instead</summary><Input className="mt-2" placeholder="xxxx-xxxx-xxxx" value={code.length > 6 ? code : ""} onChange={(e) => setCode(e.target.value)} data-testid="mfa-recovery-input" /></details>
          {error && <p role="alert" className="text-sm font-medium text-destructive" data-testid="login-error">{error}</p>}
          <Button type="submit" disabled={busy || code.length < 6} className="h-11 w-full bg-brand hover:bg-brand-hover" data-testid="mfa-submit-button">{busy ? <Spinner /> : <><ShieldCheck className="h-4 w-4" /> Verify and sign in</>}</Button>
          <button type="button" onClick={() => { setMfaToken(null); setCode(""); }} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" /> Back to sign in</button>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Sign in" subtitle="Clinic staff access only. All actions are logged." footer={<Link to="/" className="hover:text-foreground">← Back to website</Link>}>
      <form onSubmit={submit} className="space-y-4" data-testid="login-form">
        <Field label="Email" htmlFor="email" required><Input id="email" type="email" autoComplete="username" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required className="h-11" data-testid="login-email-input" /></Field>
        <Field label="Password" htmlFor="password" required><Input id="password" type="password" autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required className="h-11" data-testid="login-password-input" /></Field>
        {error && <p role="alert" className="text-sm font-medium text-destructive" data-testid="login-error">{error}</p>}
        <Button type="submit" disabled={busy} className="h-11 w-full bg-brand hover:bg-brand-hover" data-testid="login-submit-button">{busy ? <><Spinner /> Signing in...</> : "Sign in"}</Button>
        <p className="text-center text-sm"><Link to="/admin/forgot-password" className="text-muted-foreground hover:text-foreground" data-testid="forgot-password-link">Forgot your password?</Link></p>
      </form>
    </AuthShell>
  );
}

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useSeo({ title: "Reset password", noindex: true });
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError("");
    try { const { data } = await api.post("/auth/forgot-password", { email }); setMessage(data.message); } catch (err) { setError(getErrorMessage(err)); } finally { setBusy(false); }
  };
  return (
    <AuthShell title="Reset your password" subtitle="We'll email a reset link if the address is registered. If email delivery is not configured yet, the link is written to the server log." footer={<Link to="/admin/login" className="hover:text-foreground">← Back to sign in</Link>}>
      {message ? <p role="status" className="rounded-lg bg-brand-soft px-4 py-3 text-sm text-brand" data-testid="forgot-success">{message}</p> : (
        <form onSubmit={submit} className="space-y-4" data-testid="forgot-form">
          <Field label="Email" htmlFor="fp-email" required><Input id="fp-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-11" data-testid="forgot-email-input" /></Field>
          {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
          <Button type="submit" disabled={busy} className="h-11 w-full bg-brand hover:bg-brand-hover" data-testid="forgot-submit-button">{busy ? <Spinner /> : "Send reset link"}</Button>
        </form>
      )}
    </AuthShell>
  );
}

export function ResetPassword() {
  const [params] = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useSeo({ title: "Choose a new password", noindex: true });
  const submit = async (e) => {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords do not match."); return; }
    setBusy(true); setError("");
    try { const { data } = await api.post("/auth/reset-password", { token: params.get("token"), new_password: password }); setMessage(data.message); } catch (err) { setError(getErrorMessage(err)); } finally { setBusy(false); }
  };
  return (
    <AuthShell title="Choose a new password" subtitle="Use at least 10 characters." footer={<Link to="/admin/login" className="hover:text-foreground">← Back to sign in</Link>}>
      {message ? <p role="status" className="rounded-lg bg-brand-soft px-4 py-3 text-sm text-brand" data-testid="reset-success">{message}</p> : (
        <form onSubmit={submit} className="space-y-4" data-testid="reset-form">
          <Field label="New password" htmlFor="rp-pass" required><Input id="rp-pass" type="password" minLength={10} value={password} onChange={(e) => setPassword(e.target.value)} required className="h-11" data-testid="reset-password-input" /></Field>
          <Field label="Confirm password" htmlFor="rp-confirm" required><Input id="rp-confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required className="h-11" data-testid="reset-confirm-input" /></Field>
          {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
          <Button type="submit" disabled={busy} className="h-11 w-full bg-brand hover:bg-brand-hover" data-testid="reset-submit-button">{busy ? <Spinner /> : "Update password"}</Button>
        </form>
      )}
    </AuthShell>
  );
}
