import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useAvailabilityCalendar } from "@/features/public/queries";
import { dayjs, formatDate, todayIso } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ErrorState, LoadingState } from "@/components/shared/States";

const DOT = { AVAILABLE: "bg-wa", LIMITED: "bg-[#B45309]", FULL: "bg-[#B91C1C]", CLOSED: "bg-transparent" };

export function StepDate({ serviceId, horizonDays, value, onSelect }) {
  const [month, setMonth] = useState(dayjs(todayIso()).startOf("month"));
  const today = dayjs(todayIso());
  const horizonEnd = today.add(horizonDays || 30, "day");
  const from = month.isBefore(today) ? today : month;
  const to = month.endOf("month").isAfter(horizonEnd) ? horizonEnd : month.endOf("month");
  const { data, isLoading, isError, refetch } = useAvailabilityCalendar(serviceId, from.format("YYYY-MM-DD"), to.format("YYYY-MM-DD"));
  const byDate = Object.fromEntries((data?.days || []).map((d) => [d.date, d]));

  const startPad = (month.day() + 6) % 7;
  const cells = Array.from({ length: startPad + month.daysInMonth() }, (_, i) => (i < startPad ? null : month.date(i - startPad + 1)));
  const canPrev = month.isAfter(today.startOf("month"));
  const canNext = month.add(1, "month").startOf("month").isBefore(horizonEnd);

  return (
    <div>
      <h2 className="font-serif text-2xl font-semibold text-ink sm:text-3xl">Choose a date</h2>
      <p className="mt-2 text-sm text-mute md:text-base">Live availability for the next {horizonDays} days.</p>
      <div className="mt-6 rounded-xl border border-line bg-white p-4 sm:p-6" data-testid="booking-calendar">
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => setMonth(month.subtract(1, "month"))} disabled={!canPrev} aria-label="Previous month" data-testid="calendar-prev" className="flex h-10 w-10 items-center justify-center rounded-lg border border-line text-ink disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
          <p className="font-serif text-lg font-semibold text-ink">{month.format("MMMM YYYY")}</p>
          <button type="button" onClick={() => setMonth(month.add(1, "month"))} disabled={!canNext} aria-label="Next month" data-testid="calendar-next" className="flex h-10 w-10 items-center justify-center rounded-lg border border-line text-ink disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
        </div>
        <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs font-medium text-mute">{["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => <span key={d} className="py-1">{d}</span>)}</div>
        {isLoading && <LoadingState rows={3} className="mt-2" />}
        {isError && <ErrorState onRetry={refetch} className="mt-2" />}
        {data && (
          <div className="mt-1 grid grid-cols-7 gap-1" role="grid">
            {cells.map((d, i) => {
              if (!d) return <span key={`pad-${i}`} aria-hidden />;
              const iso = d.format("YYYY-MM-DD");
              const info = byDate[iso];
              const disabled = !info || info.status === "CLOSED" || info.status === "FULL";
              const selected = value === iso;
              return (
                <button key={iso} type="button" role="gridcell" disabled={disabled} onClick={() => onSelect(iso)} aria-label={`${formatDate(iso)} ${info ? info.status.toLowerCase() : "unavailable"}`} aria-pressed={selected} data-testid={`calendar-day-${iso}`} className={cn("relative flex h-12 flex-col items-center justify-center rounded-lg border text-sm font-medium transition-colors sm:h-14", selected ? "border-brand bg-brand text-white" : "border-transparent text-ink hover:border-brand/40", disabled && "text-mute/50 hover:border-transparent", info?.status === "FULL" && "line-through")}>
                  {d.date()}
                  {info && <span className={cn("mt-1 h-1.5 w-1.5 rounded-full", selected ? "bg-white" : DOT[info.status])} aria-hidden />}
                </button>
              );
            })}
          </div>
        )}
        <div className="mt-5 flex flex-wrap gap-4 text-xs text-mute" aria-hidden>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-wa" /> Available</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#B45309]" /> Limited</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#B91C1C]" /> Full</span>
        </div>
      </div>
    </div>
  );
}
