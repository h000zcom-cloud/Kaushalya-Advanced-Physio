import { Link } from "react-router-dom";
import { PhoneCall } from "lucide-react";
import { BookingWizard } from "@/components/booking/BookingWizard";
import { useClinic } from "@/features/public/queries";
import { displayPhone, telLink } from "@/lib/format";
import { useSeo } from "@/lib/seo";

export default function Book() {
  const { data } = useClinic();
  useSeo({ title: "Book an Appointment", description: "Book a physiotherapy appointment online in under a minute. Choose your concern, date and time — no account needed.", path: "/book" });
  return (
    <div className="bg-canvas">
      <div className="container-x py-8 sm:py-12">
        <div className="mx-auto mb-8 max-w-2xl">
          <p className="eyebrow">Book an appointment</p>
          <h1 className="display mt-2 text-3xl sm:text-4xl">A few quick steps.</h1>
          {data && <p className="mt-2 text-sm text-mute">Prefer to talk? <a href={telLink(data.clinic.phone)} className="inline-flex items-center gap-1 font-medium text-ink hover:underline" data-testid="book-call-link"><PhoneCall className="h-3.5 w-3.5" /> {displayPhone(data.clinic.phone)}</a> or <Link to="/contact" className="font-medium text-ink underline">request a callback</Link>.</p>}
        </div>
        <BookingWizard />
      </div>
    </div>
  );
}
