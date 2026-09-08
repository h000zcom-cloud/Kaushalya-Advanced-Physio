import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/Primitives";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/States";
import { CapacityIndicator } from "@/components/shared/CapacityIndicator";
import { ActivityList, AppointmentTable, Card, StatTile } from "@/components/dashboard/Widgets";
import { NewAppointmentDialog } from "@/components/dashboard/Dialogs";
import { useAdminQuery } from "@/features/admin/hooks";
import { useAuth } from "@/features/auth/AuthContext";
import { displayPhone, formatDate, fromNow } from "@/lib/format";
import { useSeo } from "@/lib/seo";

export default function Overview() {
  const { user } = useAuth();
  const { data, isLoading, isError, refetch } = useAdminQuery("overview", "/admin/dashboard/overview", undefined, { refetchInterval: 60_000 });
  const [newOpen, setNewOpen] = useState(false);
  useSeo({ title: "Overview · Dashboard", noindex: true });
  if (isLoading) return <LoadingState rows={6} />;
  if (isError) return <ErrorState onRetry={refetch} />;
  const s = data.stats;
  return (
    <div data-testid="admin-overview">
      <PageHeader title={`Good ${new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"}, ${user?.name?.split(" ")[0]}`} description={`${formatDate(data.date)} · what needs your attention today`} actions={<><Button variant="outline" size="sm" onClick={() => refetch()} aria-label="Refresh"><RefreshCw className="h-4 w-4" /></Button><Button size="sm" onClick={() => setNewOpen(true)} className="bg-brand hover:bg-brand-hover" data-testid="overview-new-appointment"><Plus className="h-4 w-4" /> New appointment</Button></>} />
      {!data.integrations.whatsapp_configured && <p role="status" data-testid="whatsapp-config-banner" className="mb-4 rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-4 py-2.5 text-sm text-[#92400E]">WhatsApp Business API is not configured — patient messages are logged but not sent. <Link to="/admin/messages" className="font-semibold underline">Set up</Link></p>}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6" data-testid="overview-stats">
        <StatTile label="Today's appointments" value={s.today_total} to="/admin/appointments?date=today" testId="stat-today" />
        <StatTile label="New requests" value={s.new_requests} tone="alert" to="/admin/appointments?status=NEW" testId="stat-new" />
        <StatTile label="Awaiting confirmation" value={s.awaiting_confirmation} to="/admin/appointments?status=NEW,CONTACTED,RESCHEDULED" testId="stat-awaiting" />
        <StatTile label="Confirmed today" value={s.confirmed_today} to="/admin/appointments?date=today&status=CONFIRMED,ASSIGNED" testId="stat-confirmed" />
        <StatTile label="Completed today" value={s.completed_today} testId="stat-completed" />
        <StatTile label="Needs doctor" value={s.needs_assignment} tone="alert" to="/admin/appointments?needs_assignment=1" hint={s.pending_callbacks ? `${s.pending_callbacks} callback(s) pending` : undefined} testId="stat-needs-assignment" />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card title="Today's schedule" action={<Link to="/admin/schedule" className="text-xs font-semibold text-brand hover:underline">Open schedule</Link>} testId="overview-today">
            <AppointmentTable items={data.today} showDate={false} emptyTitle="Your schedule is clear" emptyText="No appointments booked for today yet." dense />
          </Card>
          <Card title="Upcoming (next 7 days)" action={<Link to="/admin/appointments" className="text-xs font-semibold text-brand hover:underline">All appointments</Link>} testId="overview-upcoming">
            <AppointmentTable items={data.upcoming} emptyTitle="Nothing upcoming yet" emptyText="New bookings from the website will appear here." dense />
          </Card>
        </div>
        <div className="space-y-6">
          <Card title="Capacity today" testId="overview-capacity">
            {data.capacity.length === 0 ? <EmptyState title="Clinic closed today" text="Working hours and holidays are set in Settings." /> : <div className="space-y-2">{data.capacity.map((slot) => <CapacityIndicator key={slot.slot_start} slot={slot} compact />)}</div>}
          </Card>
          <Card title="Recent patients" testId="overview-patients">
            {data.recent_patients.length === 0 ? <EmptyState title="No patients yet" /> : <ul className="divide-y divide-border">{data.recent_patients.map((p) => <li key={p.id}><Link to={`/admin/patients/${p.id}`} className="flex items-center justify-between py-2 text-sm hover:text-brand"><span><span className="font-medium">{p.name}</span><span className="block text-xs text-muted-foreground">{displayPhone(p.phone)}</span></span><span className="text-xs text-muted-foreground">{fromNow(p.created_at)}</span></Link></li>)}</ul>}
          </Card>
          <Card title="Recent activity" action={<Link to="/admin/audit" className="text-xs font-semibold text-brand hover:underline">Audit log</Link>} testId="overview-activity"><ActivityList items={data.activity} /></Card>
        </div>
      </div>
      <NewAppointmentDialog open={newOpen} onOpenChange={setNewOpen} />
    </div>
  );
}
