import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const STEPS = ["Concern", "Date", "Time", "Details", "Review"];

export function Stepper({ current }) {
  return (
    <ol className="flex items-center gap-2" aria-label="Booking progress" data-testid="booking-stepper">
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex flex-1 items-center gap-2" aria-current={active ? "step" : undefined}>
            <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors", done && "border-brand bg-brand text-white", active && "border-brand text-brand", !done && !active && "border-line text-mute")}>{done ? <Check className="h-3.5 w-3.5" /> : i + 1}</span>
            <span className={cn("hidden text-xs font-medium sm:block", active ? "text-ink" : "text-mute")}>{label}</span>
            {i < STEPS.length - 1 && <span className={cn("h-px flex-1", done ? "bg-brand" : "bg-line")} aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}
