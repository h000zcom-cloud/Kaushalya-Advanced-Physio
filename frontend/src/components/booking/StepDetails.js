import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/shared/Primitives";
import { patientDetailsSchema } from "@/features/booking/validation";

export function StepDetails({ value, onSubmit, formId }) {
  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm({ resolver: zodResolver(patientDetailsSchema), defaultValues: { name: "", phone: "", email: "", message: "", consent: false, website: "", ...value } });
  const consent = watch("consent");
  return (
    <form id={formId} onSubmit={handleSubmit(onSubmit)} noValidate data-testid="booking-details-form">
      <h2 className="font-serif text-2xl font-semibold text-ink sm:text-3xl">Your details</h2>
      <p className="mt-2 text-sm text-mute md:text-base">Just the essentials — no account, no medical history.</p>
      <div className="mt-6 grid gap-5">
        <Field label="Patient's full name" htmlFor="name" required error={errors.name?.message}><Input id="name" data-testid="booking-name-input" autoComplete="name" className="h-12 text-base" placeholder="e.g. Rahul Sharma" {...register("name")} /></Field>
        <Field label="Mobile / WhatsApp number" htmlFor="phone" required error={errors.phone?.message} hint="We'll use this to confirm your appointment.">
          <div className="flex"><span className="flex h-12 items-center rounded-l-md border border-r-0 border-input bg-muted px-3 text-sm text-mute">+91</span><Input id="phone" data-testid="booking-phone-input" type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={14} className="h-12 rounded-l-none text-base" placeholder="10-digit number" {...register("phone")} /></div>
        </Field>
        <Field label="Email (optional)" htmlFor="email" error={errors.email?.message}><Input id="email" data-testid="booking-email-input" type="email" inputMode="email" autoComplete="email" className="h-12 text-base" placeholder="you@example.com" {...register("email")} /></Field>
        <Field label="Anything you'd like us to know? (optional)" htmlFor="message" error={errors.message?.message}><Textarea id="message" data-testid="booking-message-input" rows={3} className="text-base" placeholder="e.g. Pain started after a fall last week" {...register("message")} /></Field>
        <input type="text" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" {...register("website")} />
        <div className="flex items-start gap-3 rounded-lg border border-line bg-white p-4">
          <Checkbox id="consent" data-testid="booking-consent-checkbox" checked={consent} onCheckedChange={(v) => setValue("consent", v === true, { shouldValidate: true })} className="mt-0.5" />
          <label htmlFor="consent" className="text-sm leading-relaxed text-ink">I agree that the clinic may use these details to arrange my appointment and contact me about it, as described in the <Link to="/privacy" target="_blank" className="font-medium text-brand underline">privacy notice</Link>.</label>
        </div>
        {errors.consent && <p role="alert" className="-mt-3 text-xs font-medium text-destructive" data-testid="consent-error">{errors.consent.message}</p>}
      </div>
    </form>
  );
}
