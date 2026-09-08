CLINIC_NAME = "Kaushalya Advanced Physio Therapy and Paralysis Center"

DEFAULT_TEMPLATES = {
    "confirmation": "Hello {patient_name},\n\nYour appointment with {clinic_name} has been confirmed.\n\nAppointment ID: {appointment_id}\nDate: {date}\nTime: {time}\nService: {service}\n\nClinic: {clinic_name}\n{address}\n\nWe look forward to seeing you.",
    "request_received": "Hello {patient_name},\n\nWe have received your appointment request with {clinic_name}.\n\nAppointment ID: {appointment_id}\nRequested date: {date}\nRequested time: {time}\n\nOur team will contact you shortly to confirm your appointment.",
    "reminder": "Hello {patient_name},\n\nThis is a reminder of your appointment with {clinic_name}.\n\nAppointment ID: {appointment_id}\nDate: {date}\nTime: {time}\nService: {service}\n\nPlease arrive 10 minutes early. Contact us if you need to reschedule.",
    "rescheduled": "Hello {patient_name},\n\nYour appointment with {clinic_name} has been rescheduled.\n\nAppointment ID: {appointment_id}\nNew date: {date}\nNew time: {time}\nService: {service}\n\nIf this does not work for you, please contact us.",
    "cancelled": "Hello {patient_name},\n\nYour appointment {appointment_id} with {clinic_name} on {date} at {time} has been cancelled.\n\nIf you would like to book another time, please contact us or visit our website.",
}

DEFAULT_CONDITIONS = [
    {"key": "back_pain", "label": "Back pain", "description": "Lower or upper back pain, stiffness, disc-related discomfort.", "service_slug": "back-pain-physiotherapy"},
    {"key": "neck_pain", "label": "Neck pain", "description": "Neck stiffness, cervical pain, headaches linked to posture.", "service_slug": "neck-pain-physiotherapy"},
    {"key": "knee_joint_pain", "label": "Knee / joint pain", "description": "Knee, shoulder, hip or other joint pain and stiffness.", "service_slug": "knee-and-joint-pain-physiotherapy"},
    {"key": "sports_injury", "label": "Sports injuries", "description": "Sprains, strains, ligament and overuse injuries.", "service_slug": "sports-injury-rehabilitation"},
    {"key": "post_surgery", "label": "Post-surgery rehabilitation", "description": "Recovery after orthopaedic or other surgery.", "service_slug": "post-surgery-rehabilitation"},
    {"key": "neuro", "label": "Neurological rehabilitation", "description": "Paralysis, stroke, and other neurological conditions.", "service_slug": "paralysis-and-stroke-rehabilitation"},
    {"key": "mobility", "label": "Mobility problems", "description": "Difficulty walking, balance concerns, reduced independence.", "service_slug": "mobility-and-balance-therapy"},
    {"key": "other", "label": "Something else", "description": "Not sure? Start with a consultation and we will guide you.", "service_slug": "physiotherapy-consultation"},
]

DEFAULT_FAQS = [
    {"question": "Do I need a doctor's referral to book?", "answer": "No. You can book a physiotherapy consultation directly. If you have reports or a referral, please bring them along."},
    {"question": "How long is a session?", "answer": "Most sessions are scheduled within a one-hour window. Your first visit includes an assessment and a treatment plan discussion."},
    {"question": "What should I wear?", "answer": "Comfortable clothing that allows movement of the area being treated."},
    {"question": "Can I book for a family member?", "answer": "Yes. Enter the patient's name and a mobile number we can reach for confirmation."},
    {"question": "Do you treat paralysis and stroke patients?", "answer": "Yes. Neurological and paralysis rehabilitation is one of our core focus areas. Please book a consultation so we can assess and plan care."},
    {"question": "How will my appointment be confirmed?", "answer": "You receive an on-screen confirmation with an appointment ID. Where WhatsApp notifications are enabled, you also receive a WhatsApp message."},
]

DEFAULT_JOURNEY = [
    {"title": "Tell us what's bothering you", "text": "Choose the concern that fits best. You do not need to know the exact treatment."},
    {"title": "Pick a convenient time", "text": "See live availability and choose a slot that suits you. No account needed."},
    {"title": "Assessment with a physiotherapist", "text": "Your first visit focuses on understanding your condition, history and goals."},
    {"title": "A plan built around you", "text": "Hands-on therapy, guided exercise and progress reviews tailored to your recovery."},
]

DEFAULT_WHY = [
    {"title": "Experienced clinical team", "text": "Qualified physiotherapists with focused experience in orthopaedic and neurological rehabilitation."},
    {"title": "Personalised care plans", "text": "Every plan starts with an assessment and is adjusted as you progress."},
    {"title": "Modern rehabilitation approach", "text": "Evidence-informed techniques combined with guided exercise and education."},
    {"title": "Patient-first experience", "text": "Simple booking, clear communication and respect for your time."},
]


def default_settings(org_id: str) -> dict:
    return {
        "_id": org_id,
        "organization_id": org_id,
        "clinic": {
            "name": CLINIC_NAME,
            "short_name": "Kaushalya Advanced Physio",
            "tagline": "Advanced physiotherapy and paralysis rehabilitation in Nashik",
            "contact_person": "Sunny Roy",
            "phone": "+918690092409",
            "whatsapp_number": "+918690092409",
            "email": "",
            "address_line": "3rd & 4th Floor, BKV Square, Near City Center Mall, Govind Nagar, Link Road",
            "city": "Nashik",
            "state": "Maharashtra",
            "pincode": "422008",
            "map_url": "https://www.google.com/maps/search/?api=1&query=BKV+Square+Near+City+Center+Mall+Govind+Nagar+Link+Road+Nashik+422008",
            "timezone": "Asia/Kolkata",
            "country_code": "+91",
        },
        "working_hours": [
            {"weekday": i, "is_open": i < 6, "open": "09:00", "close": "19:00"} for i in range(7)
        ],
        "holidays": [],
        "booking": {
            "slot_minutes": 60,
            "acceptance_mode": "AUTO",
            "assignment_mode": "HYBRID",
            "min_notice_hours": 2,
            "max_horizon_days": 30,
            "limited_threshold": 0.3,
            "default_doctor_capacity": 1,
        },
        "notifications": {
            "whatsapp_enabled": True,
            "send_request_received": True,
            "send_confirmation": True,
            "send_reschedule": True,
            "send_cancellation": True,
            "reminders_enabled": True,
            "reminder_hours_before": 24,
            "same_day_reminder_enabled": False,
            "same_day_reminder_hours_before": 3,
            "templates": DEFAULT_TEMPLATES,
        },
        "whatsapp": {
            "language_code": "en",
            "template_names": {"confirmation": "", "request_received": "", "reminder": "", "rescheduled": "", "cancelled": ""},
        },
        "content": {
            "hero_title": "Move better. Recover with confidence.",
            "hero_subtitle": "Personalised physiotherapy and paralysis rehabilitation from an experienced clinical team in Nashik. Book in under a minute — no account needed.",
            "about_text": "Kaushalya Advanced Physio Therapy and Paralysis Center provides assessment-led physiotherapy for orthopaedic, sports, post-surgical and neurological conditions. Our team focuses on understanding each patient's goals and building a practical, progressive rehabilitation plan.",
            "conditions": DEFAULT_CONDITIONS,
            "faqs": DEFAULT_FAQS,
            "journey_steps": DEFAULT_JOURNEY,
            "why_choose_us": DEFAULT_WHY,
            "trust_points": ["Assessment-led care", "Orthopaedic & neuro rehab", "Same-week appointments", "WhatsApp updates"],
        },
    }
