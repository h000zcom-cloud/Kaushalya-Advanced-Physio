import { Link, useLocation } from "react-router-dom";
import { CalendarPlus, MessageCircle, Phone } from "lucide-react";
import { useClinic } from "@/features/public/queries";
import { telLink } from "@/lib/format";
import { track } from "@/lib/analytics";

export function MobileActionBar() {
  const { data } = useClinic();
  const { pathname } = useLocation();
  if (!data || pathname.startsWith("/book")) return null;
  const clinic = data.clinic;
  return (
    <nav aria-label="Quick actions" data-testid="mobile-action-bar" className="fixed inset-x-0 bottom-0 z-40 grid h-16 grid-cols-3 border-t border-line bg-white/95 backdrop-blur-xl md:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <a href={telLink(clinic.phone)} onClick={() => track("call_clicked", { source: "mobile_bar" })} data-testid="mobile-bar-call" className="flex flex-col items-center justify-center gap-1 text-xs font-medium text-ink"><Phone className="h-5 w-5" /> Call</a>
      <a href={data.whatsapp_link} target="_blank" rel="noreferrer" onClick={() => track("whatsapp_clicked", { source: "mobile_bar" })} data-testid="mobile-bar-whatsapp" className="flex flex-col items-center justify-center gap-1 text-xs font-medium text-wa"><MessageCircle className="h-5 w-5" /> WhatsApp</a>
      <Link to="/book" data-testid="mobile-bar-book" className="m-2 flex flex-col items-center justify-center gap-0.5 rounded-lg bg-brand text-xs font-semibold text-white"><CalendarPlus className="h-5 w-5" /> Book</Link>
    </nav>
  );
}
