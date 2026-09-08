import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Section, SectionHeading } from "@/components/marketing/Section";
import { useDoctors } from "@/features/public/queries";
import { DemoBadge, PersonAvatar } from "@/components/shared/Primitives";
import { LoadingState } from "@/components/shared/States";

export function DoctorCard({ doctor }) {
  return (
    <Link to={`/doctors/${doctor.slug}`} data-testid={`doctor-card-${doctor.slug}`} className="lift group flex flex-col rounded-xl border border-line bg-white p-6">
      <div className="flex items-start justify-between gap-3">
        <PersonAvatar name={doctor.name} photoUrl={doctor.photo_url} size="lg" />
        {doctor.is_demo && <DemoBadge />}
      </div>
      <h3 className="mt-5 font-serif text-xl font-semibold text-ink">{doctor.name}</h3>
      <p className="text-sm text-mute">{doctor.designation}{doctor.qualification ? ` · ${doctor.qualification}` : ""}</p>
      <ul className="mt-4 flex flex-wrap gap-1.5">
        {(doctor.specializations || []).slice(0, 3).map((s) => <li key={s} className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand">{s}</li>)}
      </ul>
      <div className="mt-auto flex items-center justify-between pt-5 text-sm">
        <span className="text-mute">{doctor.experience_years ? `${doctor.experience_years}+ years` : doctor.availability_summary}</span>
        <span className="inline-flex items-center gap-1 font-semibold text-brand">Profile <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></span>
      </div>
    </Link>
  );
}

export function DoctorsPreview() {
  const { data, isLoading } = useDoctors();
  const items = (data?.items || []).slice(0, 4);
  return (
    <Section tone="canvas">
      <div className="container-x">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeading eyebrow="Meet the specialists" title="An experienced team, focused on you." text="Qualified physiotherapists across orthopaedic, sports and neurological rehabilitation." />
          <Link to="/doctors" className="inline-flex items-center gap-2 text-sm font-semibold text-brand hover:underline" data-testid="doctors-view-all">Meet the whole team <ArrowRight className="h-4 w-4" /></Link>
        </div>
        {isLoading ? <LoadingState className="mt-10" /> : <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="doctors-preview-grid">{items.map((d) => <DoctorCard key={d.id} doctor={d} />)}</div>}
      </div>
    </Section>
  );
}
