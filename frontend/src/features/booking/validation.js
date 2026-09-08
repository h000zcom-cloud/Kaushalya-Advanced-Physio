import { z } from "zod";

export const phoneSchema = z.string().trim().refine((v) => {
  let d = v.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return d.length === 10 && /^[6-9]/.test(d);
}, "Please enter a valid 10-digit Indian mobile number");

export const patientDetailsSchema = z.object({
  name: z.string().trim().min(2, "Please enter the patient's full name").max(80, "Name is too long").regex(/^[A-Za-z .'-]+$/, "Please use letters only"),
  phone: phoneSchema,
  email: z.union([z.literal(""), z.string().trim().email("Please enter a valid email address")]).optional(),
  message: z.string().trim().max(500, "Please keep your message under 500 characters").optional(),
  consent: z.literal(true, { errorMap: () => ({ message: "Please accept the privacy notice to continue" }) }),
  website: z.string().max(0).optional(),
});
