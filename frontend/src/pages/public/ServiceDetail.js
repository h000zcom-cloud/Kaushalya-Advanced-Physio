import { Link, useParams } from "react-router-dom";
import { useEffect } from "react";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Section, SectionHeading } from "@/components/marketing/Section";
import { ServiceCard } from "@/components/marketing/ServicesPreview";
import { DoctorCard } from "@/components/marketing/DoctorsPreview";
import { FaqSection, FinalCta, TestimonialCard } from "@/components/marketing/Sections";
import { useService, useServices } from "@/features/public/queries";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/States";
import { useSeo } from "@/lib/seo";
import { track } from "@/lib/analytics";

export function ServicesPage() {
  const { data, isLoading, isError, refetch } = useServices();
  useSeo({ title: "Physiotherapy Services", description: "Explore physiotherapy and rehabilitation services: back and neck pain, joint pain, sports injuries, post-surgery and paralysis rehabilitation.", path: "/services" });
  return (
    <>
      <Section tone="white" className="pb-10"><div className="container-x"><SectionHeading as="h1" eyebrow="Services" title="Physiotherapy services, explained in plain language." text="Every service starts with an assessment. Pick the one that matches your concern, or book a consultation and let us guide you." /></div></Section>
      <Section className="pt-6"><div className="container-x">
        {isLoading && <LoadingState rows={6} />}
        {isError && <ErrorState onRetry={refetch} />}
        {data && <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" data-testid="services-grid">{data.items.map((s) => <ServiceCard key={s.id} service={s} />)}</div>}
      </div></Section>
      <FinalCta />
    </>
  );
}

export default function ServiceDetail() {
  const { slug } = useParams();
  const { data, isLoading, isError, refetch } = useService(slug);
  const service = data?.service;
  useEffect(() => { if (service) track("service_viewed", { service_slug: service.slug }); }, [service]);
  useSeo({ title: service?.name, description: service?.short_description, path: `/services/${slug}`, jsonLd: service && { "@context": "https://schema.org", "@type": "MedicalTherapy", name: service.name, description: service.short_description } });

  if (isLoading) return <div className="container-x py-20"><LoadingState rows={6} /></div>;
  if (isError || !service) return <div className="container-x py-20"><EmptyState title="We couldn't find that service" text="It may have been renamed. Browse all services instead." action={<Button asChild><Link to="/services">All services</Link></Button>} /></div>;

  const Block = ({ title, children }) => <div className="rounded-xl border border-line bg-white p-6 sm:p-8"><h2 className="font-serif text-2xl font-semibold text-ink">{title}</h2><div className="mt-4 text-base leading-relaxed text-mute">{children}</div></div>;
  const List = ({ items }) => <ul className="grid gap-2.5 sm:grid-cols-2">{items.map((i) => <li key={i} className="flex items-start gap-2 text-ink"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-wa" />{i}</li>)}</ul>;

  return (
    <>
      <section className="bg-white"><div className="container-x grid gap-10 py-14 lg:grid-cols-12 lg:items-center lg:py-20">
        <div className="lg:col-span-7">
          <nav aria-label="Breadcrumb" className="text-sm text-mute"><Link to="/services" className="hover:text-ink">Services</Link> <span aria-hidden>/</span> <span className="text-ink">{service.name}</span></nav>
          <p className="eyebrow mt-6">{service.category}</p>
          <h1 className="display mt-3 text-4xl sm:text-5xl" data-testid="service-title">{service.name}</h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-mute">{service.short_description}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="h-12 rounded-lg bg-brand px-7 hover:bg-brand-hover"><Link to={`/book?service=${service.slug}`} data-testid="service-book-button" onClick={() => track("appointment_started", { source: "service_page", service_slug: service.slug })}>Book this service <ArrowRight className="h-4 w-4" /></Link></Button>
            <Button asChild size="lg" variant="outline" className="h-12 rounded-lg"><Link to="/contact">Ask a question</Link></Button>
          </div>
        </div>
        {service.hero_image_url && <div className="lg:col-span-5"><img src={service.hero_image_url} alt={service.name} className="aspect-[4/3] w-full rounded-2xl object-cover" /></div>}
      </div></section>
      <Section><div className="container-x grid gap-4 lg:grid-cols-2">
        <Block title="Overview"><p>{service.overview}</p></Block>
        <Block title="Common symptoms"><List items={service.symptoms} /></Block>
        <Block title="Who may benefit"><List items={service.who_benefits} /></Block>
        <Block title="How physiotherapy can help"><p>{service.how_it_helps}</p></Block>
        <Block title="Typical approach"><ol className="space-y-3">{service.approach.map((a, i) => <li key={a} className="flex gap-3 text-ink"><span className="font-serif text-xl font-semibold text-clay/80">{String(i + 1).padStart(2, "0")}</span><span className="pt-1">{a}</span></li>)}</ol></Block>
        <Block title="What to expect"><p>{service.what_to_expect}</p><p className="mt-4 text-sm text-mute">Results vary from person to person. Your physiotherapist will discuss realistic goals with you.</p></Block>
      </div></Section>
      {data.doctors.length > 0 && <Section tone="white"><div className="container-x"><SectionHeading eyebrow="Specialists" title="Physiotherapists for this service" /><div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{data.doctors.map((d) => <DoctorCard key={d.id} doctor={d} />)}</div></div></Section>}
      {data.testimonials.length > 0 && <Section><div className="container-x"><SectionHeading eyebrow="Patient stories" title="From patients treated for this concern" /><div className="mt-10 grid gap-4 md:grid-cols-3">{data.testimonials.map((t) => <TestimonialCard key={t.id} t={t} />)}</div></div></Section>}
      {service.faqs.length > 0 && <FaqSection items={service.faqs} title="Questions about this service" />}
      <FinalCta />
    </>
  );
}
