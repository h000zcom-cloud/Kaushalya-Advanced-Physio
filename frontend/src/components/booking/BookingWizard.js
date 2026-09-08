import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Stepper } from "@/components/booking/Stepper";
import { StepService } from "@/components/booking/StepService";
import { StepDate } from "@/components/booking/StepDate";
import { StepTime } from "@/components/booking/StepTime";
import { StepDetails } from "@/components/booking/StepDetails";
import { StepConfirmation, StepReview } from "@/components/booking/StepReview";
import { Spinner } from "@/components/shared/States";
import { useClinic, useServices } from "@/features/public/queries";
import { api, getErrorCode, getErrorMessage } from "@/lib/api";
import { track } from "@/lib/analytics";

export function BookingWizard() {
  const { data: clinic } = useClinic();
  const { data: servicesData } = useServices();
  const [params] = useSearchParams();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [booking, setBooking] = useState({ conditionKey: null, service: null, options: null, date: null, slot: null, details: null });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [timeNotice, setTimeNotice] = useState("");
  const [result, setResult] = useState(null);
  const services = servicesData?.items;

  useEffect(() => { track("appointment_started", { source: "book_page" }); }, []);
  useEffect(() => {
    const slug = params.get("service");
    if (slug && services && !booking.service) {
      const svc = services.find((s) => s.slug === slug);
      if (svc) setBooking((b) => ({ ...b, service: svc, conditionKey: svc.condition_keys?.[0] || "other" }));
    }
  }, [params, services, booking.service]);

  const go = (next) => { setStep(next); track("appointment_step", { step: String(next) }); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const canContinue = [!!booking.service, !!booking.date, !!booking.slot, true, true][step];

  const submit = async () => {
    setSubmitting(true);
    setError("");
    try {
      const d = booking.details;
      const { data } = await api.post("/public/appointments", { name: d.name, phone: d.phone, email: d.email || null, message: d.message || null, consent: d.consent, website: d.website || "", service_id: booking.service.id, date: booking.date, slot_start: booking.slot.slot_start });
      setResult(data);
      track("appointment_completed", { service_slug: booking.service.slug });
      queryClient.invalidateQueries({ queryKey: ["public", "availability"] });
      queryClient.invalidateQueries({ queryKey: ["public", "calendar"] });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      const code = getErrorCode(e);
      const message = getErrorMessage(e, "Something went wrong while submitting your appointment. Please try again.");
      if (["slot_full", "slot_unavailable", "too_soon", "slot_in_past"].includes(code)) {
        setTimeNotice(message);
        setBooking((b) => ({ ...b, slot: null }));
        queryClient.invalidateQueries({ queryKey: ["public", "availability"] });
        go(2);
      } else {
        setError(message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (result) return <div className="mx-auto max-w-2xl"><StepConfirmation result={result} clinic={clinic} /></div>;

  return (
    <div className="mx-auto max-w-2xl">
      <Stepper current={step} />
      <div className="mt-8 min-h-[320px]" key={step}>
        {step === 0 && <StepService clinic={clinic} services={services} value={booking} onSelect={(v) => setBooking((b) => ({ ...b, ...v, date: null, slot: null }))} />}
        {step === 1 && <StepDate serviceId={booking.service?.id} horizonDays={clinic?.booking?.max_horizon_days} value={booking.date} onSelect={(date) => { setBooking((b) => ({ ...b, date, slot: null })); setTimeNotice(""); go(2); }} />}
        {step === 2 && <StepTime date={booking.date} serviceId={booking.service?.id} value={booking.slot?.slot_start} notice={timeNotice} onSelect={(slot) => { setBooking((b) => ({ ...b, slot })); setTimeNotice(""); go(3); }} />}
        {step === 3 && <StepDetails formId="details-form" value={booking.details} onSubmit={(details) => { setBooking((b) => ({ ...b, details })); go(4); }} />}
        {step === 4 && <StepReview booking={booking} onEdit={go} />}
      </div>
      {error && <p role="alert" className="mt-6 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm font-medium text-[#991B1B]" data-testid="booking-error">{error}</p>}
      <div className="mt-8 flex items-center justify-between gap-3 border-t border-line pt-6">
        <Button type="button" variant="ghost" disabled={step === 0 || submitting} onClick={() => go(step - 1)} data-testid="booking-back-button" className="h-12 rounded-lg"><ArrowLeft className="h-4 w-4" /> Back</Button>
        {step < 3 && <Button type="button" disabled={!canContinue} onClick={() => go(step + 1)} data-testid="booking-next-button" className="h-12 rounded-lg bg-brand px-7 hover:bg-brand-hover">Continue <ArrowRight className="h-4 w-4" /></Button>}
        {step === 3 && <Button type="submit" form="details-form" data-testid="booking-details-continue" className="h-12 rounded-lg bg-brand px-7 hover:bg-brand-hover">Review <ArrowRight className="h-4 w-4" /></Button>}
        {step === 4 && <Button type="button" onClick={submit} disabled={submitting} data-testid="booking-submit-button" className="h-12 rounded-lg bg-brand px-7 hover:bg-brand-hover">{submitting ? <><Spinner /> Submitting appointment...</> : "Confirm appointment"}</Button>}
      </div>
    </div>
  );
}
