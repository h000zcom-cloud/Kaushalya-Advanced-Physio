import { Link } from "react-router-dom";
import { Activity, ArrowRight, Bone, Brain, Dumbbell, Footprints, HelpCircle, PersonStanding, Stethoscope } from "lucide-react";
import { Section, SectionHeading } from "@/components/marketing/Section";
import { useClinic } from "@/features/public/queries";

const ICONS = { back_pain: Activity, neck_pain: PersonStanding, knee_joint_pain: Bone, sports_injury: Dumbbell, post_surgery: Stethoscope, neuro: Brain, mobility: Footprints, other: HelpCircle };

export function ConditionsGrid({ compact = false }) {
  const { data } = useClinic();
  const conditions = data?.content?.conditions || [];
  return (
    <Section id="conditions" tone="canvas">
      <div className="container-x">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeading eyebrow="What brings you here?" title="Start with what you feel, not what it's called." text="You don't need a diagnosis to book. Choose the concern that fits best and we'll guide you to the right care." />
          {!compact && <Link to="/services" className="inline-flex items-center gap-2 text-sm font-semibold text-brand hover:underline" data-testid="conditions-all-services">All services <ArrowRight className="h-4 w-4" /></Link>}
        </div>
        <ul className="mt-10 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4" data-testid="conditions-grid">
          {conditions.map((c, i) => {
            const Icon = ICONS[c.key] || HelpCircle;
            const to = c.key === "other" ? "/book" : `/services/${c.service_slug}`;
            return (
              <li key={c.key} className={`reveal reveal-delay-${Math.min(i % 4, 3)}`}>
                <Link to={to} data-testid={`condition-card-${c.key}`} className="lift group flex h-full flex-col rounded-xl border border-line bg-white p-5 sm:p-6">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-soft text-brand transition-colors group-hover:bg-brand group-hover:text-white"><Icon className="h-5 w-5" /></span>
                  <span className="mt-4 font-serif text-lg font-semibold text-ink">{c.label}</span>
                  <span className="mt-1.5 hidden text-sm leading-relaxed text-mute sm:block">{c.description}</span>
                  <span className="mt-auto pt-4 text-xs font-semibold uppercase tracking-wide text-clay">Learn more</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </Section>
  );
}
