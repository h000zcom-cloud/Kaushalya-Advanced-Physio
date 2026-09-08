import { cn } from "@/lib/utils";
import { CapacityBadge } from "@/components/shared/StatusBadge";
import { formatSlot } from "@/lib/format";

export function CapacityIndicator({ slot, compact = false, onClick }) {
  const ratio = slot.capacity ? Math.min(slot.booked / slot.capacity, 1) : 0;
  const bar = slot.status === "FULL" ? "bg-[#B91C1C]" : slot.status === "LIMITED" ? "bg-[#B45309]" : "bg-brand";
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper type={onClick ? "button" : undefined} onClick={onClick} data-testid={`capacity-slot-${slot.slot_start}`} className={cn("w-full text-left rounded-lg border border-border bg-white px-3 py-2.5", onClick && "hover:border-brand/40 transition-colors")}>
      <div className="flex items-center justify-between gap-3">
        <span className={cn("font-admin font-semibold text-foreground", compact ? "text-xs" : "text-sm")}>{formatSlot(slot.slot_start, slot.slot_end)}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs tabular-nums text-muted-foreground">{slot.booked} / {slot.capacity} booked</span>
          <CapacityBadge status={slot.status} />
        </div>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full transition-[width] duration-500", bar)} style={{ width: `${ratio * 100}%` }} />
      </div>
    </Wrapper>
  );
}
