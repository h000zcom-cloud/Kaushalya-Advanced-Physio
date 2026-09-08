import { useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Menu, MessageCircle, Phone, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useClinic } from "@/features/public/queries";
import { telLink, waLink } from "@/lib/format";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

const LINKS = [
  { to: "/services", label: "Services" },
  { to: "/doctors", label: "Doctors" },
  { to: "/patient-journey", label: "Patient Journey" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
];

export function Navbar() {
  const { data } = useClinic();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const clinic = data?.clinic;

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/85 backdrop-blur-xl">
      <div className="container-x flex h-16 items-center justify-between gap-6 lg:h-[72px]">
        <Link to="/" data-testid="nav-logo" className="flex items-center gap-2.5" aria-label="Home">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand font-serif text-base font-semibold text-white">K</span>
          <span className="font-serif text-lg font-semibold leading-none text-ink sm:text-xl">{clinic?.short_name || "Kaushalya Advanced Physio"}</span>
        </Link>
        <nav aria-label="Primary" className="hidden items-center gap-7 lg:flex">
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} data-testid={`nav-link-${l.label.toLowerCase().replace(/\s+/g, "-")}`} className={({ isActive }) => cn("text-sm font-medium text-mute transition-colors hover:text-ink", isActive && "text-ink")}>{l.label}</NavLink>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          {clinic && <a href={telLink(clinic.phone)} onClick={() => track("call_clicked", { source: "nav" })} data-testid="nav-call-link" className="hidden items-center gap-2 px-3 text-sm font-medium text-mute transition-colors hover:text-ink lg:flex"><Phone className="h-4 w-4" /> Call</a>}
          {data && <Button asChild variant="outline" className="h-10 rounded-lg border-wa/30 text-wa hover:bg-wa/5 hover:text-wa"><a href={data.whatsapp_link} target="_blank" rel="noreferrer" onClick={() => track("whatsapp_clicked", { source: "nav" })} data-testid="nav-whatsapp-link"><MessageCircle className="h-4 w-4" /> WhatsApp</a></Button>}
          <Button asChild className="h-10 rounded-lg bg-brand px-5 hover:bg-brand-hover"><Link to="/book" data-testid="nav-book-button">Book Appointment</Link></Button>
        </div>
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-controls="mobile-menu" aria-label={open ? "Close menu" : "Open menu"} data-testid="nav-menu-toggle" className="flex h-11 w-11 items-center justify-center rounded-lg text-ink lg:hidden">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {open && (
        <div id="mobile-menu" className="border-t border-line bg-white lg:hidden" data-testid="mobile-menu">
          <nav aria-label="Mobile" className="container-x flex flex-col py-3">
            {LINKS.map((l) => <NavLink key={l.to} to={l.to} onClick={() => setOpen(false)} className={({ isActive }) => cn("rounded-lg px-3 py-3 text-base font-medium text-mute", isActive && "bg-brand-soft text-brand")}>{l.label}</NavLink>)}
            <Link to="/book" onClick={() => setOpen(false)} className="mt-2 rounded-lg bg-brand px-3 py-3 text-center text-base font-semibold text-white" data-testid="mobile-menu-book">Book Appointment</Link>
            {location.pathname !== "/admin" && <Link to="/admin/login" onClick={() => setOpen(false)} className="mt-1 px-3 py-2 text-xs text-mute">Clinic staff sign in</Link>}
          </nav>
        </div>
      )}
    </header>
  );
}
