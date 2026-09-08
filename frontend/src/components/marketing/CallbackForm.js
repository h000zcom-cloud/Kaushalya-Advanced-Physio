import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PhoneCall } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/shared/Primitives";
import { Spinner } from "@/components/shared/States";
import { api, getErrorMessage } from "@/lib/api";
import { phoneSchema } from "@/features/booking/validation";
import { track } from "@/lib/analytics";

const schema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(80),
  phone: phoneSchema,
  reason: z.string().trim().max(300).optional(),
  preferred_time: z.string().trim().max(80).optional(),
  website: z.string().max(0).optional(),
});

export function CallbackForm({ compact = false }) {
  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState("");
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = async (values) => {
    setServerError("");
    try {
      await api.post("/public/callbacks", values);
      track("callback_requested", { source: compact ? "page" : "contact" });
      setDone(true);
    } catch (e) {
      setServerError(getErrorMessage(e, "We couldn't send your request. Please call us instead."));
    }
  };

  if (done) {
    return (
      <div role="status" data-testid="callback-success" className="rounded-xl border border-[#A7F3D0] bg-[#ECFDF5] p-6 text-[#065F46]">
        <p className="font-serif text-lg font-semibold">Thanks — we'll call you back.</p>
        <p className="mt-1 text-sm">Our team will reach you on the number you shared, usually within working hours.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="surface p-6 sm:p-8" data-testid="callback-form">
      <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-clay-soft text-clay"><PhoneCall className="h-5 w-5" /></span><div><h3 className="font-serif text-xl font-semibold text-ink">Request a callback</h3><p className="text-sm text-mute">Not sure what you need? We'll call and help you decide.</p></div></div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Field label="Your name" htmlFor="cb-name" required error={errors.name?.message}><Input id="cb-name" data-testid="callback-name-input" autoComplete="name" className="h-11" {...register("name")} /></Field>
        <Field label="Mobile number" htmlFor="cb-phone" required error={errors.phone?.message}><Input id="cb-phone" data-testid="callback-phone-input" type="tel" inputMode="numeric" autoComplete="tel" placeholder="10-digit mobile" className="h-11" {...register("phone")} /></Field>
        <Field label="Preferred time (optional)" htmlFor="cb-time" error={errors.preferred_time?.message}><Input id="cb-time" data-testid="callback-time-input" placeholder="e.g. Weekday mornings" className="h-11" {...register("preferred_time")} /></Field>
        <Field label="Reason (optional)" htmlFor="cb-reason" error={errors.reason?.message} className="sm:col-span-2"><Textarea id="cb-reason" data-testid="callback-reason-input" rows={2} placeholder="Briefly, what would you like help with?" {...register("reason")} /></Field>
        <input type="text" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" {...register("website")} />
      </div>
      {serverError && <p role="alert" className="mt-4 text-sm font-medium text-destructive" data-testid="callback-error">{serverError}</p>}
      <Button type="submit" disabled={isSubmitting} data-testid="callback-submit-button" className="mt-6 h-11 w-full rounded-lg bg-brand hover:bg-brand-hover sm:w-auto sm:px-8">{isSubmitting ? <><Spinner /> Sending...</> : "Request callback"}</Button>
      <p className="mt-3 text-xs text-mute">We only use your number to call you back about your enquiry.</p>
    </form>
  );
}
