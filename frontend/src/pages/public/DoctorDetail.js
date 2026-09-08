import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Section, SectionHeading } from "@/components/marketing/Section";
import { DoctorCard } from "@/components/marketing/DoctorsPreview";
import { FinalCta } from "@/components/marketing/Sections";
import { DemoBadge, PersonAvatar } from "@/components/shared/Primitives";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/States";
import { useDoctor, useDoctors } from "@/features/public/queries";
import { useSeo } from "@/lib/seo";
import { track } from "@/lib/analytics";

export function DoctorsPage() {
  const { data, isLoading, isError, refetch } = useDoctors();
  useSeo({ title: "Our Physiotherapists", description: "Meet the physiotherapy team: qualified specialists in orthopaedic, sports and neurological rehabilitation.", path: "/doctors" });
  return (
    <>
      <Section tone="white" className="pb-10"><div className="container-x"><SectionHeading as="h1" eyebrow="Doctors" title="Meet the clinical team." text="Profiles are maintained by the clinic. Qualifications and experience are shown exactly as provided by each physiotherapist." /></div></Section>
      <Section className="pt-6"><div className="container-x">
        {isLoading && <LoadingState rows={6} />}
        {isError && <ErrorState onRetry={refetch} />}
        {data && (data.items.length === 0 ? <EmptyState title="Team profiles coming soon" text="Doctor profiles will appear here once added by the clinic." /> : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="doctors-grid">{data.items.map((d) => <DoctorCard key={d.id} doctor={d} />)}</div>)}
      </div></Section>
      <FinalCta />
    </>
  );
}

export default function DoctorDetail() {
  const { slug } = useParams();
  const { data, isLoading, isError } = useDoctor(slug);
  const doctor = data?.doctor;
  useEffect(() => { if (doctor) track("doctor_viewed", { doctor_slug: doctor.slug }); }, [doctor]);
  useSeo({ title: doctor?.name, description: doctor ? `${doctor.name}, ${doctor.designation}. ${doctor.specializations.join(", ")}.` : "", path: `/doctors/${slug}`, jsonLd: doctor && { "@context": "https://schema.org", "@type": "Physician", name: doctor.name, jobTitle: doctor.designation, medicalSpecialty: doctor.specializations } });

  if (isLoading) return <div className="container-x py-20"><LoadingState rows={5} /></div>;
  if (isError || !doctor) return <div className="container-x py-20"><EmptyState title="Profile not found" text="This doctor profile may have been removed." action={<Button asChild><Link to="/doctors">All doctors</Link></Button>} /></div>;

  return (
    <>
      <section className="bg-white"><div className="container-x grid gap-10 py-14 lg:grid-cols-12 lg:py-20">
        <div className="lg:col-span-4"><PersonAvatar name={doctor.name} photoUrl={doctor.photo_url} size="xl" className="h-40 w-40 text-4xl sm:h-56 sm:w-56" /></div>
        <div className="lg:col-span-8">
          <nav aria-label="Breadcrumb" className="text-sm text-mute"><Link to="/doctors" className="hover:text-ink">Doctors</Link> <span aria-hidden>/</span> <span className="text-ink">{doctor.name}</span></nav>
          <div className="mt-6 flex flex-wrap items-center gap-3"><h1 className="display text-4xl sm:text-5xl" data-testid="doctor-name">{doctor.name}</h1>{doctor.is_demo && <DemoBadge />}</div>
          <p className="mt-3 text-lg text-mute">{doctor.designation}{doctor.qualification ? ` · ${doctor.qualification}` : ""}</p>
          <dl className="mt-6 grid gap-4 sm:grid-cols-3">
            {doctor.experience_years != null && <div><dt className="text-xs uppercase tracking-wide text-mute">Experience</dt><dd className="mt-1 font-semibold text-ink">{doctor.experience_years}+ years</dd></div>}
            <div><dt className="text-xs uppercase tracking-wide text-mute">Availability</dt><dd className="mt-1 flex items-center gap-1.5 font-semibold text-ink"><CalendarDays className="h-4 w-4 text-clay" /> {doctor.availability_summary}</dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-mute">Specialisation</dt><dd className="mt-1 font-semibold text-ink">{doctor.specializations.join(", ")}</dd></div>
          </dl>
          <div className="mt-8 flex flex-wrap gap-3"><Button asChild size="lg" className="h-12 rounded-lg bg-brand px-7 hover:bg-brand-hover"><Link to="/book" data-testid="doctor-book-button">Book an appointment <ArrowRight className="h-4 w-4" /></Link></Button></div>
        </div>
      </div></section>
      <Section><div className="container-x grid gap-4 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-8">
          <div className="surface p-6 sm:p-8"><h2 className="font-serif text-2xl font-semibold text-ink">About</h2><p className="mt-4 whitespace-pre-line text-base leading-relaxed text-mute">{doctor.bio || "Biography to be added by the clinic."}</p></div>
          {doctor.philosophy && <div className="rounded-xl bg-brand p-6 text-white sm:p-8"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-clay">Treatment philosophy</p><p className="mt-3 font-serif text-2xl leading-snug">“{doctor.philosophy}”</p></div>}
        </div>
        <div className="space-y-4 lg:col-span-4">
          <div className="surface p-6"><h3 className="font-serif text-lg font-semibold text-ink">Areas of expertise</h3><ul className="mt-3 flex flex-wrap gap-2">{doctor.expertise.map((e) => <li key={e} className="rounded-full bg-brand-soft px-3 py-1 text-sm text-brand">{e}</li>)}</ul></div>
          <div className="surface p-6"><h3 className="font-serif text-lg font-semibold text-ink">Services</h3><ul className="mt-3 space-y-2">{data.services.map((s) => <li key={s.id}><Link to={`/services/${s.slug}`} className="text-sm font-medium text-ink hover:text-brand hover:underline">{s.name}</Link></li>)}</ul></div>
        </div>
      </div></Section>
      <FinalCta />
    </>
  );
}
