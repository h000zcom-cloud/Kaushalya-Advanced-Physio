import { Activity, Bone, Brain, Dumbbell, Footprints, HelpCircle, PersonStanding, Stethoscope } from "lucide-react";
import { cn } from "@/lib/utils";
import { LoadingState } from "@/components/shared/States";

const ICONS = { back_pain: Activity, neck_pain: PersonStanding, knee_joint_pain: Bone, sports_injury: Dumbbell, post_surgery: Stethoscope, neuro: Brain, mobility: Footprints, other: HelpCircle };

export function StepService({ clinic, services, value, onSelect }) {
  if (!clinic || !services) return <LoadingState rows={4} />;
  const conditions = clinic.content.conditions;
  const bySlug = Object.fromEntries(services.map((s) => [s.slug, s]));
  const relatedFor = (key) => services.filter((s) => (s.condition_keys || []).includes(key));

  return (
    <div>
      <h2 className="font-serif text-2xl font-semibold text-ink sm:text-3xl">What would you like help with?</h2>
      <p className="mt-2 text-sm text-mute md:text-base">Choose the closest match. You can change this later.</p>
      <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3" role="list" data-testid="booking-conditions">
        {conditions.map((c) => {
          const Icon = ICONS[c.key] || HelpCircle;
          const related = relatedFor(c.key);
          const primary = bySlug[c.service_slug] || related[0];
          const selected = value?.conditionKey === c.key;
          return (
            <li key={c.key}>
              <button type="button" data-testid={`booking-condition-${c.key}`} onClick={() => onSelect({ conditionKey: c.key, service: primary, options: related.length > 1 ? related : null })} aria-pressed={selected} className={cn("flex min-h-[112px] w-full flex-col items-start rounded-xl border bg-white p-4 text-left transition-[border-color,box-shadow] hover:border-brand/50", selected ? "border-brand shadow-[0_0_0_2px_rgba(27,54,47,0.15)]" : "border-line")}>
                <Icon className={cn("h-5 w-5", selected ? "text-brand" : "text-clay")} />
                <span className="mt-3 text-sm font-semibold text-ink sm:text-base">{c.label}</span>
                {primary && <span className="mt-1 text-xs text-mute">{primary.name}</span>}
              </button>
            </li>
          );
        })}
      </ul>
      {value?.options && (
        <fieldset className="mt-6 rounded-xl border border-line bg-white p-4" data-testid="booking-service-options">
          <legend className="px-1 text-sm font-medium text-ink">Which service fits best?</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {value.options.map((s) => (
              <label key={s.id} className={cn("flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm", value.service?.id === s.id ? "border-brand bg-brand-soft/40" : "border-line")}>
                <input type="radio" name="service" className="mt-1 accent-brand" checked={value.service?.id === s.id} onChange={() => onSelect({ ...value, service: s })} data-testid={`booking-service-option-${s.slug}`} />
                <span><span className="block font-semibold text-ink">{s.name}</span><span className="text-mute">{s.short_description}</span></span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
    </div>
  );
}
