import { useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/shared/Primitives";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/States";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Card, StatTile } from "@/components/dashboard/Widgets";
import { useAdminQuery } from "@/features/admin/hooks";
import { formatDate } from "@/lib/format";
import { useSeo } from "@/lib/seo";

const EVENT_LABELS = { appointment_started: "Booking started", appointment_completed: "Booking completed", whatsapp_clicked: "WhatsApp clicks", call_clicked: "Call clicks", directions_clicked: "Directions clicks", service_viewed: "Service views", doctor_viewed: "Doctor views", callback_requested: "Callback requests", page_view: "Page views" };

export default function Analytics() {
  const [days, setDays] = useState("30");
  const { data, isLoading, isError, refetch } = useAdminQuery("analytics", "/admin/analytics", { days: Number(days) });
  useSeo({ title: "Analytics · Dashboard", noindex: true });
  if (isLoading) return <LoadingState rows={6} />;
  if (isError) return <ErrorState onRetry={refetch} />;
  const t = data.totals;
  const utilization = data.utilization.map((u) => ({ ...u, pct: u.capacity ? Math.round((u.booked / u.capacity) * 100) : 0, label: formatDate(u.date, "D MMM") }));
  const avgUtil = utilization.length ? Math.round(utilization.reduce((a, b) => a + b.pct, 0) / utilization.length) : 0;
  return (
    <div data-testid="admin-analytics">
      <PageHeader title="Analytics" description={`Operational view · ${formatDate(data.range.from)} – ${formatDate(data.range.to)}`} actions={<Select value={days} onValueChange={setDays}><SelectTrigger className="h-9 w-36" data-testid="analytics-range"><SelectValue /></SelectTrigger><SelectContent>{["7", "14", "30", "90"].map((d) => <SelectItem key={d} value={d}>Last {d} days</SelectItem>)}</SelectContent></Select>} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7" data-testid="analytics-totals">
        <StatTile label="Today" value={t.today} /><StatTile label="This month" value={t.this_month} /><StatTile label="New patients" value={t.new_patients} hint="in range" /><StatTile label="Completed" value={t.completed} /><StatTile label="Cancelled" value={t.cancelled} /><StatTile label="No-shows" value={t.no_show} /><StatTile label="Avg. utilisation" value={`${avgUtil}%`} hint="last 14 days" />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card title="Appointments per day">
          {data.trend.every((d) => d.count === 0) ? <EmptyState title="No appointments in range" /> : <ResponsiveContainer width="100%" height={240}><AreaChart data={data.trend.map((d) => ({ ...d, label: formatDate(d.date, "D MMM") }))}><defs><linearGradient id="trend" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#1B362F" stopOpacity={0.25} /><stop offset="100%" stopColor="#1B362F" stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} stroke="#E5E7EB" /><XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} /><Tooltip /><Area type="monotone" dataKey="count" stroke="#1B362F" fill="url(#trend)" strokeWidth={2} /></AreaChart></ResponsiveContainer>}
        </Card>
        <Card title="Capacity utilisation (last 14 days)">
          <ResponsiveContainer width="100%" height={240}><BarChart data={utilization}><CartesianGrid vertical={false} stroke="#E5E7EB" /><XAxis dataKey="label" tick={{ fontSize: 11 }} /><YAxis unit="%" domain={[0, 100]} tick={{ fontSize: 11 }} width={36} /><Tooltip formatter={(v, n, p) => [`${p.payload.booked}/${p.payload.capacity} (${v}%)`, "Booked"]} /><Bar dataKey="pct" fill="#C87961" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>
        </Card>
        <Card title="Popular services">
          {data.popular_services.length === 0 ? <EmptyState title="No data yet" /> : <ul className="space-y-2">{data.popular_services.map((s) => { const max = data.popular_services[0].count; return <li key={s.service_name} className="text-sm"><div className="flex justify-between"><span>{s.service_name}</span><span className="tabular-nums text-muted-foreground">{s.count}</span></div><div className="mt-1 h-1.5 rounded-full bg-muted"><div className="h-full rounded-full bg-brand" style={{ width: `${(s.count / max) * 100}%` }} /></div></li>; })}</ul>}
        </Card>
        <Card title="Status breakdown & doctor load">
          <div className="grid gap-4 sm:grid-cols-2">
            <ul className="space-y-1.5">{data.status_breakdown.length === 0 ? <li className="text-sm text-muted-foreground">No appointments in range.</li> : data.status_breakdown.map((s) => <li key={s.status} className="flex items-center justify-between text-sm"><StatusBadge status={s.status} /><span className="tabular-nums">{s.count}</span></li>)}</ul>
            <ul className="space-y-1.5">{data.doctor_load.map((d) => <li key={d.doctor_name} className="flex items-center justify-between text-sm"><span className="truncate">{d.doctor_name}</span><span className="tabular-nums text-muted-foreground">{d.count}</span></li>)}</ul>
          </div>
        </Card>
        <Card title="Website engagement (privacy-safe events)" className="xl:col-span-2">
          {Object.keys(data.web_events).length === 0 ? <EmptyState title="No website events yet" text="Events are recorded when visitors start bookings, tap WhatsApp/Call or view services. No personal data is stored." /> : <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">{Object.entries(data.web_events).sort((a, b) => b[1] - a[1]).map(([k, v]) => <div key={k} className="rounded-lg border border-border p-3"><p className="text-xs text-muted-foreground">{EVENT_LABELS[k] || k}</p><p className="font-admin text-xl font-bold tabular-nums">{v}</p></div>)}</div>}
        </Card>
      </div>
    </div>
  );
}
