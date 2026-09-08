import { cn } from "@/lib/utils";
import { humanStatus } from "@/lib/format";

const STATUS_STYLES = {
  NEW: "bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]",
  CONTACTED: "bg-[#F5F3FF] text-[#6D28D9] border-[#DDD6FE]",
  CONFIRMED: "bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]",
  ASSIGNED: "bg-[#EEF2FF] text-[#4338CA] border-[#C7D2FE]",
  COMPLETED: "bg-[#F0FDFA] text-[#0F766E] border-[#99F6E4]",
  CANCELLED: "bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]",
  NO_SHOW: "bg-[#FFF7ED] text-[#C2410C] border-[#FED7AA]",
  RESCHEDULED: "bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]",
  CLOSED: "bg-muted text-muted-foreground border-border",
};

export const CAPACITY_STYLES = {
  AVAILABLE: "bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]",
  LIMITED: "bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]",
  FULL: "bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]",
  CLOSED: "bg-muted text-muted-foreground border-border",
};

export function StatusBadge({ status, className, ...props }) {
  return (
    <span data-testid={`status-badge-${status?.toLowerCase()}`} className={cn("inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold", STATUS_STYLES[status] || STATUS_STYLES.CLOSED, className)} {...props}>
      {humanStatus(status)}
    </span>
  );
}

export function CapacityBadge({ status, className }) {
  const label = { AVAILABLE: "Available", LIMITED: "Limited", FULL: "Full", CLOSED: "Closed" }[status] || status;
  return <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold", CAPACITY_STYLES[status] || CAPACITY_STYLES.CLOSED, className)}>{label}</span>;
}
