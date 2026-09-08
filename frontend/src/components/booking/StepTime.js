import { useAvailability } from "@/features/public/queries";
import { formatDate, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CapacityBadge } from "@/components/shared/StatusBadge";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/States";

export function StepTime({ date, serviceId, value, onSelect, notice }) {
  const { data, isLoading, isError, refetch } = useAvailability(date, serviceId);
  const slots = data?.slots || [];
  const bookable = slots.filter((s) => s.bookable);
  return (
    <div>
      <h2 className="font-serif text-2xl font-semibold text-ink sm:text-3xl">Choose a time</h2>
      <p className="mt-2 text-sm text-mute md:text-base">{formatDate(date)} · times shown in clinic local time.</p>
      {notice && <p role="alert" className="mt-4 rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3 text-sm text-[#92400E]" data-testid="booking-time-notice">{notice}</p>}
      <div className="mt-6">
        {isLoading && <LoadingState rows={4} />}
        {isError && <ErrorState onRetry={refetch} />}
        {data && bookable.length === 0 && <EmptyState title="No times left on this day" text="Please choose another date — nearby days often have space." testId="booking-no-slots" />}
        {data && bookable.length > 0 && (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4" role="listbox" aria-label="Available times" data-testid="booking-time-slots">
            {slots.filter((s) => s.bookable || s.status === "FULL").map((s) => {
              const selected = value === s.slot_start;
              return (
                <button key={s.slot_start} type="button" role="option" aria-selected={selected} disabled={!s.bookable} onClick={() => onSelect(s)} data-testid={`time-slot-${s.slot_start}`} className={cn("flex min-h-[64px] flex-col items-start justify-between rounded-xl border bg-white p-3 text-left transition-[border-color,background-color]", selected ? "border-brand bg-brand text-white" : "border-line hover:border-brand/50", !s.bookable && "cursor-not-allowed opacity-50 hover:border-line")}>
                  <span className="text-sm font-semibold">{formatTime(s.slot_start)}</span>
                  <CapacityBadge status={s.status} className={cn(selected && "border-white/30 bg-white/15 text-white")} />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
