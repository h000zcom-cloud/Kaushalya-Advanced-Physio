import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(relativeTime);

export const DEFAULT_TZ = "Asia/Kolkata";
export { dayjs };

export const formatDate = (iso, fmt = "ddd, D MMM YYYY") => (iso ? dayjs(iso).format(fmt) : "");
export const formatShortDate = (iso) => formatDate(iso, "D MMM");
export const formatTime = (hm) => (hm ? dayjs(`2000-01-01T${hm}`).format("h:mm A") : "");
export const formatSlot = (start, end) => (end ? `${formatTime(start)} – ${formatTime(end)}` : formatTime(start));
export const formatDateTime = (iso, tz = DEFAULT_TZ) => (iso ? dayjs(iso).tz(tz).format("D MMM YYYY, h:mm A") : "");
export const fromNow = (iso) => (iso ? dayjs(iso).fromNow() : "");
export const todayIso = (tz = DEFAULT_TZ) => dayjs().tz(tz).format("YYYY-MM-DD");

export const phoneDigits = (phone = "") => phone.replace(/\D/g, "");
export const displayPhone = (phone = "") => {
  const d = phoneDigits(phone);
  return d.length > 10 ? `+${d.slice(0, -10)} ${d.slice(-10, -5)} ${d.slice(-5)}` : phone;
};
export const waLink = (phone, text) => `https://wa.me/${phoneDigits(phone)}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
export const telLink = (phone) => `tel:+${phoneDigits(phone)}`;
export const initials = (name = "") => name.replace(/^Dr\.?\s+/i, "").split(" ").filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("");
export const humanStatus = (status = "") => status.replace("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
