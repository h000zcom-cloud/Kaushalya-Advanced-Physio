import { Link } from "react-router-dom";
import { useClinic, useServices } from "@/features/public/queries";
import { displayPhone, telLink, WEEKDAYS } from "@/lib/format";

export function Footer() {
  const { data } = useClinic();
  const { data: services } = useServices();
  const clinic = data?.clinic;
  const hours = data?.working_hours || [];
  const openDays = hours.filter((h) => h.is_open);
  const hoursLabel = openDays.length ? `${WEEKDAYS[openDays[0].weekday].slice(0, 3)}–${WEEKDAYS[openDays[openDays.length - 1].weekday].slice(0, 3)} · ${openDays[0].open}–${openDays[0].close}` : "";

  return (
    <footer className="border-t border-line bg-white" data-testid="site-footer">
      <div className="container-x grid gap-10 py-14 md:grid-cols-12">
        <div className="md:col-span-5">
          <p className="font-serif text-xl font-semibold text-ink">{clinic?.name || "Kaushalya Advanced Physio Therapy and Paralysis Center"}</p>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-mute">{clinic?.tagline}</p>
          {clinic && (
            <address className="mt-5 space-y-1 text-sm not-italic text-mute">
              <p>{clinic.address_line}</p>
              <p>{clinic.city}{clinic.state ? `, ${clinic.state}` : ""} {clinic.pincode}</p>
              <p><a href={telLink(clinic.phone)} className="font-medium text-ink hover:underline" data-testid="footer-phone">{displayPhone(clinic.phone)}</a>{clinic.contact_person && <span> · {clinic.contact_person}</span>}</p>
              {hoursLabel && <p>{hoursLabel}</p>}
            </address>
          )}
        </div>
        <div className="md:col-span-3">
          <p className="eyebrow">Services</p>
          <ul className="mt-4 space-y-2 text-sm">
            {(services?.items || []).slice(0, 7).map((s) => <li key={s.id}><Link to={`/services/${s.slug}`} className="text-mute transition-colors hover:text-ink">{s.name}</Link></li>)}
          </ul>
        </div>
        <div className="md:col-span-2">
          <p className="eyebrow">Clinic</p>
          <ul className="mt-4 space-y-2 text-sm">
            {[["/about", "About"], ["/doctors", "Doctors"], ["/patient-journey", "Patient journey"], ["/testimonials", "Patient stories"], ["/faq", "FAQ"], ["/contact", "Contact"]].map(([to, label]) => <li key={to}><Link to={to} className="text-mute transition-colors hover:text-ink">{label}</Link></li>)}
          </ul>
        </div>
        <div className="md:col-span-2">
          <p className="eyebrow">Legal</p>
          <ul className="mt-4 space-y-2 text-sm">
            <li><Link to="/privacy" className="text-mute hover:text-ink">Privacy notice</Link></li>
            <li><Link to="/terms" className="text-mute hover:text-ink">Terms of use</Link></li>
            <li><Link to="/admin/login" className="text-mute hover:text-ink" data-testid="footer-admin-link">Staff sign in</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line">
        <div className="container-x flex flex-col gap-2 py-5 text-xs text-mute sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} {clinic?.short_name || "Kaushalya Advanced Physio"}. All rights reserved.</p>
          <p>Information on this website is general and not a substitute for individual medical advice.</p>
        </div>
      </div>
    </footer>
  );
}
