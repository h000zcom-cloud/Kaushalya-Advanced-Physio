import { Link } from "react-router-dom";
import { CalendarCheck2, Clock3, MessageCircle, PhoneCall, Stethoscope, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate, formatSlot, formatTime, waLink } from "@/lib/format";

export function StepReview({ booking, onEdit }) {
  const rows = [
    { icon: Stethoscope, label: "Service", value: booking.service?.name, step: 0 },
    { icon: CalendarCheck2, label: "Date", value: formatDate(booking.date), step: 1 },
    { icon: Clock3, label: "Time", value: formatSlot(booking.slot?.slot_start, booking.slot?.slot_end), step: 2 },
    { icon: User, label: "Patient", value: `${booking.details?.name} · +91 ${booking.details?.phone?.replace(/\D/g, "").slice(-10)}${booking.details?.email ? ` · ${booking.details.email}` : ""}`, step: 3 },
  ];
  return (
    <div>
      <h2 className="font-serif text-2xl font-semibold text-ink sm:text-3xl">Review your appointment</h2>
      <p className="mt-2 text-sm text-mute md:text-base">Check the details, then confirm.</p>
      <dl className="mt-6 divide-y divide-line rounded-xl border border-line bg-white" data-testid="booking-review">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-4 px-4 py-4 sm:px-5">
            <r.icon className="h-5 w-5 shrink-0 text-clay" />
            <div className="min-w-0 flex-1"><dt className="text-xs uppercase tracking-wide text-mute">{r.label}</dt><dd className="truncate text-sm font-medium text-ink sm:text-base">{r.value}</dd></div>
            <button type="button" onClick={() => onEdit(r.step)} className="text-sm font-semibold text-brand hover:underline" data-testid={`review-edit-${r.label.toLowerCase()}`}>Edit</button>
          </div>
        ))}
        {booking.details?.message && <div className="px-4 py-4 sm:px-5"><dt className="text-xs uppercase tracking-wide text-mute">Your note</dt><dd className="mt-1 text-sm text-ink">{booking.details.message}</dd></div>}
      </dl>
    </div>
  );
}

export function StepConfirmation({ result, clinic }) {
  const confirmed = result.is_confirmed;
  const waText = `Hello, I have an appointment ${result.public_id} on ${formatDate(result.date)} at ${formatTime(result.slot_start)}.`;
  return (
    <div className="text-center" role="status" aria-live="polite" data-testid="booking-confirmation">
      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#ECFDF5] text-[#047857]"><CalendarCheck2 className="h-8 w-8" /></span>
      <h2 className="display mt-6 text-3xl sm:text-4xl" data-testid="confirmation-title">{confirmed ? "Your appointment is confirmed" : "We've received your request"}</h2>
      <p className="mx-auto mt-3 max-w-md text-base text-mute">{confirmed ? "We look forward to seeing you. Please arrive 10 minutes early." : "Our team will contact you shortly on your mobile number to confirm the time."}</p>
      <div className="mx-auto mt-8 max-w-md rounded-xl border border-line bg-white p-6 text-left">
        <p className="text-xs uppercase tracking-wide text-mute">Appointment ID</p>
        <p className="font-serif text-3xl font-semibold text-ink" data-testid="confirmation-id">{result.public_id}</p>
        <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
          <div><dt className="text-mute">Date</dt><dd className="font-medium text-ink">{formatDate(result.date)}</dd></div>
          <div><dt className="text-mute">Time</dt><dd className="font-medium text-ink">{formatSlot(result.slot_start, result.slot_end)}</dd></div>
          <div><dt className="text-mute">Service</dt><dd className="font-medium text-ink">{result.service_name}</dd></div>
          <div><dt className="text-mute">Patient</dt><dd className="font-medium text-ink">{result.patient_name}</dd></div>
          {result.doctor_name && <div className="col-span-2"><dt className="text-mute">Physiotherapist</dt><dd className="font-medium text-ink">{result.doctor_name}</dd></div>}
        </dl>
        <p className="mt-5 rounded-lg bg-canvas px-3 py-2 text-xs text-mute" data-testid="confirmation-notice">
          {result.whatsapp_notifications_enabled ? "A WhatsApp message with these details is on its way to your number." : "Please save this ID. The clinic will reach you on your mobile number if anything changes."}
        </p>
      </div>
      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        {clinic && <Button asChild variant="outline" className="h-12 rounded-lg border-wa/40 text-wa hover:bg-wa/5 hover:text-wa"><a href={waLink(clinic.clinic.whatsapp_number, waText)} target="_blank" rel="noreferrer" data-testid="confirmation-whatsapp"><MessageCircle className="h-4 w-4" /> Message us on WhatsApp</a></Button>}
        {clinic && <Button asChild variant="outline" className="h-12 rounded-lg"><a href={`tel:${clinic.clinic.phone}`} data-testid="confirmation-call"><PhoneCall className="h-4 w-4" /> Call the clinic</a></Button>}
        <Button asChild className="h-12 rounded-lg bg-brand hover:bg-brand-hover"><Link to="/" data-testid="confirmation-home">Back to home</Link></Button>
      </div>
    </div>
  );
}
