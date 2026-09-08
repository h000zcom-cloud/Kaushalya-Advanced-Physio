import { Hero } from "@/components/marketing/Hero";
import { ConditionsGrid } from "@/components/marketing/ConditionsGrid";
import { ServicesPreview } from "@/components/marketing/ServicesPreview";
import { DoctorsPreview } from "@/components/marketing/DoctorsPreview";
import { FaqSection, FinalCta, JourneySteps, LocationSection, TestimonialsSection, WhyChoose } from "@/components/marketing/Sections";
import { useClinic } from "@/features/public/queries";
import { useSeo } from "@/lib/seo";

export default function Home() {
  const { data } = useClinic();
  const c = data?.clinic;
  useSeo({
    title: "Physiotherapy & Paralysis Rehabilitation in Nashik",
    description: c?.tagline || "Personalised physiotherapy and paralysis rehabilitation in Nashik. Book an appointment online in under a minute.",
    path: "/",
    jsonLd: c && {
      "@context": "https://schema.org", "@type": "MedicalClinic", name: c.name, telephone: c.phone, medicalSpecialty: "Physiotherapy",
      address: { "@type": "PostalAddress", streetAddress: c.address_line, addressLocality: c.city, addressRegion: c.state, postalCode: c.pincode, addressCountry: "IN" },
      url: window.location.origin, hasMap: c.map_url,
      openingHoursSpecification: (data.working_hours || []).filter((h) => h.is_open).map((h) => ({ "@type": "OpeningHoursSpecification", dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][h.weekday], opens: h.open, closes: h.close })),
    },
  });
  return (
    <>
      <Hero />
      <div className="border-y border-line bg-canvas"><div className="container-x flex flex-wrap items-center justify-between gap-4 py-5 text-sm text-mute" data-testid="trust-bar"><span className="font-serif text-base text-ink">Trusted care in Nashik</span>{(data?.content?.trust_points || []).map((t) => <span key={t} className="hidden sm:inline">{t}</span>)}<span className="sm:hidden">Orthopaedic · Neuro · Sports rehab</span></div></div>
      <ConditionsGrid />
      <ServicesPreview />
      <DoctorsPreview />
      <JourneySteps />
      <WhyChoose />
      <TestimonialsSection />
      <FaqSection />
      <LocationSection />
      <FinalCta />
    </>
  );
}
