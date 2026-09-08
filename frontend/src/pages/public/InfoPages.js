import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Section, SectionHeading } from "@/components/marketing/Section";
import { FaqSection, FinalCta, JourneySteps, LocationSection, TestimonialCard, WhyChoose } from "@/components/marketing/Sections";
import { CallbackForm } from "@/components/marketing/CallbackForm";
import { EmptyState, LoadingState } from "@/components/shared/States";
import { useClinic, useTestimonials } from "@/features/public/queries";
import { useSeo } from "@/lib/seo";

const IMG_TEAM = "https://images.unsplash.com/photo-1706353399656-210cca727a33?crop=entropy&cs=srgb&fm=jpg&q=80&w=1400";

export function AboutPage() {
  const { data } = useClinic();
  useSeo({ title: "About the Clinic", description: "About Kaushalya Advanced Physio Therapy and Paralysis Center, Nashik: our team, approach and facilities.", path: "/about" });
  return (
    <>
      <Section tone="white"><div className="container-x grid gap-10 lg:grid-cols-12 lg:items-center">
        <div className="lg:col-span-6"><SectionHeading as="h1" eyebrow="About us" title={data?.clinic?.name || "About the clinic"} text={data?.content?.about_text} /></div>
        <div className="lg:col-span-6"><img src={IMG_TEAM} alt="Physiotherapist treating a patient" className="aspect-[4/3] w-full rounded-2xl object-cover" /></div>
      </div></Section>
      <WhyChoose />
      <LocationSection />
      <FinalCta />
    </>
  );
}

export function PatientJourneyPage() {
  useSeo({ title: "Patient Journey", description: "What to expect from your first booking to ongoing recovery at our physiotherapy clinic.", path: "/patient-journey" });
  return (
    <>
      <Section tone="canvas" className="pb-0"><div className="container-x"><SectionHeading as="h1" eyebrow="Patient journey" title="What to expect, step by step." text="No surprises. Here's how care works from the moment you book." /></div></Section>
      <JourneySteps standalone />
      <Section><div className="container-x grid gap-4 md:grid-cols-3">
        {[["Before your visit", "Book online or call us. Bring any reports, scans or a referral if you have them. Wear comfortable clothing."], ["Your first session", "Up to an hour: history, physical assessment, a plain-language explanation and your first exercises."], ["Ongoing care", "Sessions are scheduled around your plan. We review progress regularly and adjust as you improve."]].map(([t, x]) => <div key={t} className="surface p-6 sm:p-8"><h2 className="font-serif text-xl font-semibold text-ink">{t}</h2><p className="mt-3 text-base leading-relaxed text-mute">{x}</p></div>)}
      </div></Section>
      <FaqSection />
      <FinalCta />
    </>
  );
}

export function TestimonialsPage() {
  const { data, isLoading } = useTestimonials();
  useSeo({ title: "Patient Stories", description: "Approved patient testimonials about physiotherapy and rehabilitation at our Nashik clinic.", path: "/testimonials" });
  return (
    <>
      <Section tone="white" className="pb-10"><div className="container-x"><SectionHeading as="h1" eyebrow="Patient stories" title="Real experiences, shared with permission." text="We only publish stories that patients have approved. Names may be shortened or withheld on request." /></div></Section>
      <Section className="pt-6"><div className="container-x">
        {isLoading && <LoadingState rows={4} />}
        {data && (data.items.length === 0 ? <EmptyState title="No stories published yet" text="Approved patient stories will appear here." /> : <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" data-testid="testimonials-grid">{data.items.map((t) => <TestimonialCard key={t.id} t={t} />)}</div>)}
      </div></Section>
      <FinalCta />
    </>
  );
}

export function FaqPage() {
  useSeo({ title: "Frequently Asked Questions", description: "Answers to common questions about booking, sessions, and physiotherapy at our clinic.", path: "/faq" });
  return (
    <>
      <Section tone="white" className="pb-4"><div className="container-x"><SectionHeading as="h1" eyebrow="FAQ" title="Frequently asked questions." /></div></Section>
      <FaqSection title="Everything you might want to know" eyebrow="Answers" />
      <FinalCta />
    </>
  );
}

export function ContactPage() {
  useSeo({ title: "Contact & Location", description: "Contact Kaushalya Advanced Physio Therapy and Paralysis Center in Govind Nagar, Nashik. Call, WhatsApp, or request a callback.", path: "/contact" });
  return (
    <>
      <Section tone="white" className="pb-4"><div className="container-x"><SectionHeading as="h1" eyebrow="Contact" title="We're easy to reach." text="Call, WhatsApp, book online or ask us to call you back." /></div></Section>
      <LocationSection embedMap />
      <Section><div className="container-x grid gap-10 lg:grid-cols-12"><div className="lg:col-span-5"><SectionHeading eyebrow="Prefer a call?" title="Request a callback." text="Ideal if you're unsure which service you need or want help choosing a time." /></div><div className="lg:col-span-7"><CallbackForm /></div></div></Section>
    </>
  );
}

export function LegalPage({ kind }) {
  const { data } = useClinic();
  const name = data?.clinic?.name || "the clinic";
  const isPrivacy = kind === "privacy";
  useSeo({ title: isPrivacy ? "Privacy Notice" : "Terms of Use", description: isPrivacy ? "How we collect, use and protect your information when you book an appointment." : "Terms of use for this website and online appointment booking.", path: isPrivacy ? "/privacy" : "/terms", noindex: true });
  return (
    <Section tone="white"><div className="container-x max-w-3xl">
      <SectionHeading as="h1" eyebrow="Legal" title={isPrivacy ? "Privacy notice" : "Terms of use"} />
      <div className="prose-custom mt-8 space-y-6 text-base leading-relaxed text-mute">
        {isPrivacy ? (
          <>
            <p>{name} collects only the information needed to arrange and manage your appointment: your name, mobile number, the service you request, your chosen date and time, and optionally your email and a short message.</p>
            <p><strong className="text-ink">How we use it.</strong> To confirm, remind you about, reschedule or cancel appointments (including via WhatsApp where enabled), to contact you about your enquiry, and to maintain clinical scheduling records.</p>
            <p><strong className="text-ink">What we do not collect online.</strong> We do not ask for medical history in the online booking form. Clinical details are discussed with your physiotherapist during your visit.</p>
            <p><strong className="text-ink">Storage and security.</strong> Data is stored on secured systems with access limited to authorised clinic staff. Actions on your records are logged.</p>
            <p><strong className="text-ink">Analytics.</strong> We measure anonymous website usage (for example, which pages are viewed). We never send your name, phone number or health details to analytics tools.</p>
            <p><strong className="text-ink">Your choices.</strong> You may ask us to correct or delete your contact information by calling the clinic. This notice is intended to align with Indian data protection principles and will be reviewed with professional advice.</p>
          </>
        ) : (
          <>
            <p>This website provides general information about physiotherapy services offered by {name} and lets you request or book appointments online.</p>
            <p><strong className="text-ink">Not medical advice.</strong> Content on this site is general and does not replace an individual assessment by a qualified professional. Outcomes vary between individuals and no result is guaranteed.</p>
            <p><strong className="text-ink">Appointments.</strong> A booking is a request for a time slot. Where confirmation is automatic you will see this on screen; otherwise our team will contact you to confirm. Please inform us if you cannot attend so the slot can be offered to another patient.</p>
            <p><strong className="text-ink">Acceptable use.</strong> Do not submit false information or use automated tools to make bookings. We may cancel bookings that appear to be misuse.</p>
            <p><strong className="text-ink">Changes.</strong> We may update these terms from time to time; the current version is always available on this page.</p>
          </>
        )}
      </div>
      <Button asChild variant="outline" className="mt-10"><Link to="/">Back to home</Link></Button>
    </div></Section>
  );
}

export function NotFoundPage() {
  useSeo({ title: "Page not found", noindex: true });
  return <Section><div className="container-x"><EmptyState title="We couldn't find that page" text="The link may be outdated. Head back home or book an appointment." action={<div className="flex gap-2"><Button asChild variant="outline"><Link to="/">Home</Link></Button><Button asChild className="bg-brand hover:bg-brand-hover"><Link to="/book">Book appointment</Link></Button></div>} /></div></Section>;
}
