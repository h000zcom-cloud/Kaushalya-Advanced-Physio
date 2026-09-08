import { useEffect, useState } from "react";
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Activity, BarChart3, CalendarDays, ClipboardList, LayoutDashboard, LogOut, Menu, MessageSquare, PhoneIncoming, Quote, Search, Settings, ShieldCheck, Stethoscope, Users, X } from "lucide-react";
import { useAuth } from "@/features/auth/AuthContext";
import { AppointmentDrawerProvider, useAppointmentDrawer } from "@/components/dashboard/AppointmentDrawer";
import { LoadingState } from "@/components/shared/States";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { fetcher } from "@/lib/api";
import { displayPhone, formatDate, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/admin/appointments", label: "Appointments", icon: ClipboardList },
  { to: "/admin/patients", label: "Patients", icon: Users },
  { to: "/admin/doctors", label: "Doctors", icon: Stethoscope },
  { to: "/admin/services", label: "Services", icon: Activity },
  { to: "/admin/schedule", label: "Schedule", icon: CalendarDays },
  { to: "/admin/messages", label: "Messages", icon: MessageSquare },
  { to: "/admin/callbacks", label: "Callbacks", icon: PhoneIncoming },
  { to: "/admin/testimonials", label: "Testimonials", icon: Quote },
  { to: "/admin/analytics", label: "Analytics", icon: BarChart3, roles: ["OWNER", "ADMIN"] },
  { to: "/admin/settings", label: "Settings", icon: Settings, roles: ["OWNER", "ADMIN"] },
];

function Sidebar({ onNavigate }) {
  const { user } = useAuth();
  return (
    <nav aria-label="Admin" className="flex h-full flex-col" data-testid="admin-sidebar">
      <Link to="/admin" className="flex h-16 items-center gap-2.5 border-b border-border px-5"><span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand font-serif text-base font-semibold text-white">K</span><span className="font-admin text-sm font-bold leading-tight text-foreground">Kaushalya Physio<br /><span className="text-[11px] font-medium text-muted-foreground">Clinic operations</span></span></Link>
      <ul className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {NAV.filter((n) => !n.roles || n.roles.includes(user?.role)).map((n) => (
          <li key={n.to}><NavLink to={n.to} end={n.end} onClick={onNavigate} data-testid={`sidebar-${n.label.toLowerCase()}`} className={({ isActive }) => cn("flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground", isActive && "bg-brand-soft text-brand hover:bg-brand-soft hover:text-brand")}><n.icon className="h-4 w-4" /> {n.label}</NavLink></li>
        ))}
      </ul>
      <div className="border-t border-border p-3"><NavLink to="/admin/security" onClick={onNavigate} data-testid="sidebar-security" className={({ isActive }) => cn("flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground", isActive && "bg-brand-soft text-brand")}><ShieldCheck className="h-4 w-4" /> Security & account</NavLink></div>
    </nav>
  );
}

function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const { openAppointment } = useAppointmentDrawer();
  const navigate = useNavigate();
  useEffect(() => {
    if (query.trim().length < 2) { setResults(null); return undefined; }
    const t = setTimeout(() => fetcher("/admin/search", { query }).then(setResults).catch(() => setResults(null)), 250);
    return () => clearTimeout(t);
  }, [query]);
  useEffect(() => {
    const onKey = (e) => { if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setOpen(true); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} data-testid="global-search-button" className="flex h-10 w-full max-w-md items-center gap-2 rounded-lg border border-border bg-white px-3 text-sm text-muted-foreground hover:border-brand/40"><Search className="h-4 w-4" /> Search patients, phone or appointment ID <kbd className="ml-auto hidden rounded border border-border px-1.5 text-[10px] sm:block">⌘K</kbd></button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search by name, phone or PT-ID..." value={query} onValueChange={setQuery} data-testid="global-search-input" />
        <CommandList>
          <CommandEmpty>{query.length < 2 ? "Type at least 2 characters." : "No matches found."}</CommandEmpty>
          {results?.appointments?.length > 0 && <CommandGroup heading="Appointments">{results.appointments.map((a) => <CommandItem key={a.id} value={`${a.public_id} ${a.patient_name}`} onSelect={() => { setOpen(false); openAppointment(a.id); }} data-testid={`search-result-appt-${a.public_id}`}><div className="flex w-full items-center justify-between gap-3"><span><span className="font-mono text-xs text-muted-foreground">{a.public_id}</span> · {a.patient_name}<span className="block text-xs text-muted-foreground">{formatDate(a.date)} · {formatTime(a.slot_start)} · {a.service_name}</span></span><StatusBadge status={a.status} /></div></CommandItem>)}</CommandGroup>}
          {results?.patients?.length > 0 && <CommandGroup heading="Patients">{results.patients.map((p) => <CommandItem key={p.id} value={`${p.name} ${p.phone}`} onSelect={() => { setOpen(false); navigate(`/admin/patients/${p.id}`); }}><span>{p.name}<span className="block text-xs text-muted-foreground">{displayPhone(p.phone)} · {p.total_appointments} appointment(s)</span></span></CommandItem>)}</CommandGroup>}
        </CommandList>
      </CommandDialog>
    </>
  );
}

function Shell() {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setMobileOpen(false), [pathname]);
  return (
    <div className="admin-shell min-h-screen bg-background font-sans text-foreground">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-border bg-white lg:block"><Sidebar /></aside>
      {mobileOpen && <div className="fixed inset-0 z-40 lg:hidden"><div className="absolute inset-0 bg-black/30" onClick={() => setMobileOpen(false)} aria-hidden /><aside className="absolute inset-y-0 left-0 w-72 bg-white shadow-xl"><button type="button" onClick={() => setMobileOpen(false)} aria-label="Close menu" className="absolute right-3 top-4 rounded-md p-1.5 text-muted-foreground"><X className="h-5 w-5" /></button><Sidebar onNavigate={() => setMobileOpen(false)} /></aside></div>}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-white/90 px-4 backdrop-blur-xl sm:px-6">
          <button type="button" onClick={() => setMobileOpen(true)} aria-label="Open menu" data-testid="admin-menu-toggle" className="rounded-lg p-2 text-muted-foreground lg:hidden"><Menu className="h-5 w-5" /></button>
          <GlobalSearch />
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right sm:block"><p className="text-sm font-semibold leading-tight" data-testid="admin-user-name">{user?.name}</p><p className="text-[11px] uppercase tracking-wide text-muted-foreground">{user?.role}</p></div>
            <Button variant="outline" size="sm" onClick={logout} data-testid="admin-logout-button" className="h-9"><LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Sign out</span></Button>
          </div>
        </header>
        <main className="p-4 sm:p-6 lg:p-8"><Outlet /></main>
      </div>
    </div>
  );
}

export default function AdminLayout() {
  const { user } = useAuth();
  const location = useLocation();
  if (user === null) return <div className="admin-shell flex min-h-screen items-center justify-center bg-background p-8"><LoadingState rows={3} className="w-full max-w-md" label="Checking your session" /></div>;
  if (user === false) return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  return <AppointmentDrawerProvider><Shell /></AppointmentDrawerProvider>;
}
