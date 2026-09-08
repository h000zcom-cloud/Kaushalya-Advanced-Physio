import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, MapPin, MessageCircle, Phone, Quote } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Section, SectionHeading } from "@/components/marketing/Section";
import { useClinic, useTestimonials } from "@/features/public/queries";
import { displayPhone, telLink, WEEKDAYS } from "@/lib/format";
import { track } from "@/lib/analytics";

const IMG_ROOM = "https://images.pexels.com/photos/7789616/pexels-photo-7789616.jpeg?auto=compress&cs=tinysrgb&w=1200";
const IMG_WAIT = "https://images.unsplash.com/photo-1787496994323-59ac5cff09f9?crop=entropy&cs=srgb&fm=jpg&q=80&w=1200";
const IMG_REHAB = "https://images.unsplash.com/photo-1645005513713-9e2b92a687d3?crop=entropy&cs=srgb&fm=jpg&q=80&w=1200";

export function JourneySteps({ standalone = false }) {
  const { data } = useClinic();
  const steps = data?.content?.journey_steps || [];
  return (
    <Section tone="white">
      <div className="container-x grid gap-12 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <SectionHeading eyebrow="How it works" title="A simple path from first call to steady progress." text="We keep booking effortless so you can focus on getting better." />
          {!standalone && <Button asChild className="mt-8 h-11 rounded-lg bg-brand hover:bg-brand-hover"><Link to="/patient-journey" data-testid="journey-learn-more">See the patient journey <ArrowRight className="h-4 w-4" /></Link></Button>}
        </div>
        <ol className="grid gap-4 sm:grid-cols-2 lg:col-span-8" data-testid="journey-steps">
          {steps.map((s, i) => (
            <li key={s.title} className="relative rounded-xl border border-line bg-canvas p-6">
              <span className="font-serif text-4xl font-semibold text-clay/70">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="mt-3 font-serif text-lg font-semibold text-ink">{s.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-mute">{s.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </Section>
  );
}

export function WhyChoose() {
  const { data } = useClinic();
  const points = data?.content?.why_choose_us || [];
  return (
    <Section tone="canvas">
      <div className="container-x grid gap-10 lg:grid-cols-12 lg:items-center">
        <div className="order-2 grid grid-cols-2 gap-3 lg:order-1 lg:col-span-6">
          <img src={IMG_REHAB} alt="Patient performing guided rehabilitation exercise" loading="lazy" className="col-span-2 aspect-[16/10] w-full rounded-2xl object-cover" />
          <img src={IMG_ROOM} alt="Treatment room at the clinic" loading="lazy" className="aspect-square w-full rounded-2xl object-cover" />
          <img src={IMG_WAIT} alt="Comfortable waiting area" loading="lazy" className="aspect-square w-full rounded-2xl object-cover" />
        </div>
        <div className="order-1 lg:order-2 lg:col-span-6 lg:pl-8">
          <SectionHeading eyebrow="Why choose us" title="Serious clinical care, delivered with warmth." />
          <ul className="mt-8 space-y-5" data-testid="why-choose-list">
            {points.map((p) => (
              <li key={p.title} className="flex gap-4">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-wa" />
                <div><p className="font-semibold text-ink">{p.title}</p><p className="mt-1 text-sm leading-relaxed text-mute">{p.text}</p></div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  );
}

export function TestimonialCard({ t }) {
  return (
    <figure className="flex h-full flex-col rounded-xl border border-line bg-white p-6" data-testid={`testimonial-${t.id}`}>
      <Quote className="h-6 w-6 text-clay/70" aria-hidden />
      <blockquote className="mt-4 flex-1 font-serif text-lg leading-relaxed text-ink">“{t.content}”</blockquote>
      <figcaption className="mt-5 flex items-center justify-between text-sm">
        <div><p className="font-semibold text-ink">{t.display_name}</p>{t.service_name && <p className="text-mute">{t.service_name}</p>}</div>
        {t.is_demo && <span className="rounded-full border border-dashed border-clay/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-clay">Sample</span>}
      </figcaption>
    </figure>
  );
}

export function TestimonialsSection() {
  const { data } = useTestimonials(true);
  const items = (data?.items || []).slice(0, 3);
  return (
    <Section tone="white">
      <div className="container-x">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeading eyebrow="Patient stories" title="Progress, in patients' own words." text="Every story shown here is shared with the patient's permission." />
          <Link to="/testimonials" className="inline-flex items-center gap-2 text-sm font-semibold text-brand hover:underline">All stories <ArrowRight className="h-4 w-4" /></Link>
        </div>
        {items.length === 0 ? <p className="mt-10 rounded-xl border border-dashed border-line p-8 text-center text-sm text-mute">Patient stories will appear here once approved by the clinic.</p> : <div className="mt-10 grid gap-4 md:grid-cols-3">{items.map((t) => <TestimonialCard key={t.id} t={t} />)}</div>}
      </div>
    </Section>
  );
}

export function FaqSection({ items, title = "Questions, answered.", eyebrow = "FAQ" }) {
  const { data } = useClinic();
  const faqs = items || data?.content?.faqs || [];
  return (
    <Section tone="canvas">
      <div className="container-x grid gap-10 lg:grid-cols-12">
        <div className="lg:col-span-4"><SectionHeading eyebrow={eyebrow} title={title} text="Still unsure? Send us a WhatsApp message or request a callback." /></div>
        <Accordion type="single" collapsible className="lg:col-span-8" data-testid="faq-accordion">
          {faqs.map((f, i) => (
            <AccordionItem key={i} value={`faq-${i}`} className="border-line">
              <AccordionTrigger className="py-5 text-left font-serif text-lg font-medium text-ink hover:no-underline" data-testid={`faq-trigger-${i}`}>{f.question}</AccordionTrigger>
              <AccordionContent className="pb-5 text-base leading-relaxed text-mute">{f.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </Section>
  );
}

export function LocationSection({ embedMap = false }) {
  const { data } = useClinic();
  if (!data) return null;
  const c = data.clinic;
  const open = data.working_hours.filter((h) => h.is_open);
  const query = encodeURIComponent(`${c.address_line}, ${c.city} ${c.pincode}`);
  return (
    <Section tone="white" id="location">
      <div className="container-x grid gap-10 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <SectionHeading eyebrow="Visit us" title={`Find us in ${c.city || "the city"}.`} />
          <address className="mt-6 space-y-1 text-base not-italic text-mute">
            <p className="flex items-start gap-2"><MapPin className="mt-1 h-4 w-4 shrink-0 text-clay" /><span>{c.address_line}<br />{c.city}{c.state ? `, ${c.state}` : ""} – {c.pincode}</span></p>
            <p className="flex items-center gap-2 pt-2"><Phone className="h-4 w-4 text-clay" /><a href={telLink(c.phone)} className="font-medium text-ink hover:underline">{displayPhone(c.phone)}</a></p>
          </address>
          <div className="mt-6 rounded-xl border border-line bg-canvas p-4 text-sm" data-testid="opening-hours">
            <p className="font-semibold text-ink">Opening hours</p>
            <ul className="mt-2 space-y-1 text-mute">{data.working_hours.map((h) => <li key={h.weekday} className="flex justify-between"><span>{WEEKDAYS[h.weekday]}</span><span>{h.is_open ? `${h.open} – ${h.close}` : "Closed"}</span></li>)}</ul>
            {open.length === 0 && <p className="mt-2 text-mute">By appointment</p>}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild className="h-11 rounded-lg bg-brand hover:bg-brand-hover"><a href={c.map_url || `https://www.google.com/maps/search/?api=1&query=${query}`} target="_blank" rel="noreferrer" data-testid="get-directions-button" onClick={() => track("directions_clicked", { source: "location" })}><MapPin className="h-4 w-4" /> Get directions</a></Button>
            <Button asChild variant="outline" className="h-11 rounded-lg border-wa/40 text-wa hover:bg-wa/5 hover:text-wa"><a href={data.whatsapp_link} target="_blank" rel="noreferrer" onClick={() => track("whatsapp_clicked", { source: "location" })}><MessageCircle className="h-4 w-4" /> WhatsApp</a></Button>
          </div>
        </div>
        <div className="lg:col-span-7">
          {embedMap ? (
            <iframe title="Clinic location map" loading="lazy" className="h-[360px] w-full rounded-2xl border border-line" referrerPolicy="no-referrer-when-downgrade" src={`https://www.google.com/maps?q=${query}&output=embed`} />
          ) : (
            <a href={c.map_url} target="_blank" rel="noreferrer" onClick={() => track("directions_clicked", { source: "map_card" })} className="lift relative block h-full min-h-[280px] overflow-hidden rounded-2xl border border-line bg-brand-soft" data-testid="map-card">
              <div className="absolute inset-0 grain" />
              <div className="absolute inset-x-6 bottom-6 rounded-xl bg-white/95 p-5 shadow-soft">
                <p className="eyebrow">Google Maps</p>
                <p className="mt-1 font-serif text-lg font-semibold text-ink">{c.short_name}</p>
                <p className="text-sm text-mute">Near City Center Mall · Open in Maps for directions</p>
              </div>
            </a>
          )}
        </div>
      </div>
    </Section>
  );
}

export function FinalCta() {
  const { data } = useClinic();
  return (
    <section className="relative overflow-hidden bg-brand py-20 text-white grain">
      <div className="container-x relative flex flex-col items-start gap-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-clay">Ready when you are</p>
          <h2 className="display mt-3 text-3xl text-white sm:text-4xl lg:text-5xl">Book your first visit in under a minute.</h2>
          <p className="mt-4 text-base text-white/75 md:text-lg">No account needed. Choose a time that suits you and we'll take it from there.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg" className="h-12 rounded-lg bg-white px-7 text-base text-brand hover:bg-white/90"><Link to="/book" data-testid="final-cta-book" onClick={() => track("appointment_started", { source: "final_cta" })}>Book Appointment <ArrowRight className="h-4 w-4" /></Link></Button>
          {data && <Button asChild size="lg" variant="outline" className="h-12 rounded-lg border-white/30 bg-transparent px-6 text-base text-white hover:bg-white/10 hover:text-white"><a href={data.whatsapp_link} target="_blank" rel="noreferrer" data-testid="final-cta-whatsapp" onClick={() => track("whatsapp_clicked", { source: "final_cta" })}><MessageCircle className="h-4 w-4" /> WhatsApp</a></Button>}
        </div>
      </div>
    </section>
  );
}
