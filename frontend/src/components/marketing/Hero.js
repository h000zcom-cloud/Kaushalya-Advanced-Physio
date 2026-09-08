import { Link } from "react-router-dom";
import { ArrowRight, MessageCircle, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useClinic, useNextAvailable } from "@/features/public/queries";
import { formatDate, telLink } from "@/lib/format";
import { track } from "@/lib/analytics";

const HERO_IMAGE = "https://images.unsplash.com/photo-1649751361457-01d3a696c7e6?crop=entropy&cs=srgb&fm=jpg&q=80&w=1200";

export function Hero() {
  const { data } = useClinic();
  const { next } = useNextAvailable();
  const clinic = data?.clinic;
  const content = data?.content;
  return (
    <section className="relative overflow-hidden bg-white">
      <div className="container-x grid items-center gap-12 py-14 lg:grid-cols-12 lg:py-24">
        <div className="reveal lg:col-span-6">
          <p className="eyebrow">{clinic?.city ? `Physiotherapy in ${clinic.city}` : "Physiotherapy & rehabilitation"}</p>
          <h1 className="display mt-4 text-4xl sm:text-5xl lg:text-6xl" data-testid="hero-title">{content?.hero_title || "Move better. Recover with confidence."}</h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-mute md:text-lg" data-testid="hero-subtitle">{content?.hero_subtitle}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button asChild size="lg" className="h-12 rounded-lg bg-brand px-7 text-base hover:bg-brand-hover"><Link to="/book" data-testid="hero-book-button" onClick={() => track("appointment_started", { source: "hero" })}>Book Appointment <ArrowRight className="h-4 w-4" /></Link></Button>
            {data && <Button asChild size="lg" variant="outline" className="h-12 rounded-lg border-wa/40 px-6 text-base text-wa hover:bg-wa/5 hover:text-wa"><a href={data.whatsapp_link} target="_blank" rel="noreferrer" data-testid="hero-whatsapp-button" onClick={() => track("whatsapp_clicked", { source: "hero" })}><MessageCircle className="h-4 w-4" /> WhatsApp us</a></Button>}
            {clinic && <a href={telLink(clinic.phone)} data-testid="hero-call-link" onClick={() => track("call_clicked", { source: "hero" })} className="inline-flex h-12 items-center gap-2 px-2 text-sm font-medium text-ink hover:underline"><Phone className="h-4 w-4" /> Call the clinic</a>}
          </div>
          <ul className="mt-10 grid grid-cols-2 gap-x-6 gap-y-3 text-sm text-mute sm:grid-cols-4 lg:max-w-xl" aria-label="Trust points">
            {(content?.trust_points || []).map((t) => <li key={t} className="flex items-start gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-clay" aria-hidden />{t}</li>)}
          </ul>
        </div>
        <div className="reveal reveal-delay-1 relative lg:col-span-6">
          <div className="relative ml-auto aspect-[4/5] w-full max-w-md overflow-hidden rounded-2xl lg:max-w-none lg:aspect-[5/4]">
            <img src={HERO_IMAGE} alt="Physiotherapist assessing a patient's knee during a consultation" className="h-full w-full object-cover" fetchPriority="high" />
          </div>
          {next && (
            <div data-testid="hero-next-available" className="absolute -bottom-5 left-4 flex items-center gap-3 rounded-xl border border-line bg-white px-4 py-3 shadow-soft sm:left-8">
              <span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-wa opacity-60" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-wa" /></span>
              <div><p className="text-xs uppercase tracking-wide text-mute">Next availability</p><p className="text-sm font-semibold text-ink">{formatDate(next.date)}</p></div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
