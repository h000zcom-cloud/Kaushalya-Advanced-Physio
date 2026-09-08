import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { Section, SectionHeading } from "@/components/marketing/Section";
import { useServices } from "@/features/public/queries";
import { LoadingState } from "@/components/shared/States";
import { cn } from "@/lib/utils";

export function ServiceCard({ service, featured = false }) {
  return (
    <Link to={`/services/${service.slug}`} data-testid={`service-card-${service.slug}`} className={cn("lift group relative flex flex-col overflow-hidden rounded-xl border border-line bg-white", featured ? "md:row-span-2" : "")}>
      {featured && service.hero_image_url && <img src={service.hero_image_url} alt="" loading="lazy" className="h-48 w-full object-cover md:h-64" />}
      <div className="flex flex-1 flex-col p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-clay">{service.category}</p>
        <h3 className="mt-2 font-serif text-xl font-semibold text-ink">{service.name}</h3>
        <p className="mt-2 text-sm leading-relaxed text-mute">{service.short_description}</p>
        <span className="mt-auto inline-flex items-center gap-1.5 pt-5 text-sm font-semibold text-brand">Explore <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" /></span>
      </div>
    </Link>
  );
}

export function ServicesPreview() {
  const { data, isLoading } = useServices();
  const items = (data?.items || []).slice(0, 5);
  return (
    <Section tone="white">
      <div className="container-x">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeading eyebrow="Key treatments" title="Care built around your recovery goals." text="From back pain to paralysis rehabilitation, every plan begins with an assessment and is adjusted as you progress." />
          <Link to="/services" className="inline-flex items-center gap-2 text-sm font-semibold text-brand hover:underline" data-testid="services-view-all">View all services <ArrowRight className="h-4 w-4" /></Link>
        </div>
        {isLoading ? <LoadingState className="mt-10" /> : (
          <div className="mt-10 grid gap-4 md:grid-cols-3" data-testid="services-preview-grid">
            {items.map((s, i) => <ServiceCard key={s.id} service={s} featured={i === 0} />)}
          </div>
        )}
      </div>
    </Section>
  );
}
