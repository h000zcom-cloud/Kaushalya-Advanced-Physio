import logging
from datetime import timedelta

from app.core.config import cfg
from app.core.database import db, q
from app.core.models import new_id, utc_now
from app.core.security import hash_password, verify_password
from app.core.slug import slugify
from app.core.timeutil import now_local
from app.domain.appointments import service as appointments
from app.domain.appointments.schemas import BookingCreate
from app.domain.scheduling import engine
from app.domain.settings.service import get_settings

logger = logging.getLogger("app.seed")

IMG_THERAPY = "https://images.unsplash.com/photo-1706353399656-210cca727a33?crop=entropy&cs=srgb&fm=jpg&q=85&w=1600"
IMG_EXAM = "https://images.unsplash.com/photo-1649751361457-01d3a696c7e6?crop=entropy&cs=srgb&fm=jpg&q=85&w=1600"
IMG_REHAB = "https://images.unsplash.com/photo-1645005513713-9e2b92a687d3?crop=entropy&cs=srgb&fm=jpg&q=85&w=1600"

SERVICES = [
    {"name": "Back Pain Physiotherapy", "category": "Orthopaedic", "condition_keys": ["back_pain"], "hero_image_url": IMG_THERAPY,
     "short_description": "Assessment-led care for lower and upper back pain, stiffness and disc-related discomfort.",
     "overview": "Back pain is one of the most common reasons people visit a physiotherapist. It can come from muscles, joints, discs or posture and daily habits. Our approach starts with understanding what is driving your pain, then building a plan that reduces discomfort and restores confident movement.",
     "symptoms": ["Dull or sharp lower back pain", "Stiffness after sitting or in the morning", "Pain radiating to the hip or leg", "Difficulty bending, lifting or standing for long"],
     "who_benefits": ["Desk workers with postural back pain", "People recovering from a back strain", "Patients with disc-related pain referred for conservative care", "Anyone whose back pain is limiting daily activity"],
     "how_it_helps": "Physiotherapy can help reduce pain, improve mobility and strengthen the muscles that support your spine. Education about posture, movement and pacing helps prevent recurrence. Progress is reviewed regularly and the plan adjusts to how you respond.",
     "approach": ["Detailed movement and posture assessment", "Manual therapy and mobilisation where appropriate", "Targeted strengthening and mobility exercises", "Ergonomic and activity guidance"],
     "what_to_expect": "Your first session lasts up to an hour and includes a history, physical assessment and an explanation of findings in plain language. You leave with a clear plan and the first set of exercises.",
     "faqs": [{"question": "Should I rest completely?", "answer": "Usually not. Gentle, guided movement typically helps recovery. Your physiotherapist will advise what is appropriate for you."}]},
    {"name": "Neck Pain Physiotherapy", "category": "Orthopaedic", "condition_keys": ["neck_pain"], "hero_image_url": IMG_EXAM,
     "short_description": "Relief and recovery for neck stiffness, cervical pain and posture-related headaches.",
     "overview": "Neck pain often builds up gradually from long hours at a screen, poor sleep positions or stress, and sometimes follows an injury. Treatment focuses on restoring comfortable movement and addressing the habits that keep pain returning.",
     "symptoms": ["Neck stiffness or reduced rotation", "Pain spreading to the shoulders", "Headaches starting at the base of the skull", "Tingling into the arm in some cases"],
     "who_benefits": ["Professionals with screen-related neck strain", "People with recurring neck stiffness", "Patients recovering from whiplash-type injuries"],
     "how_it_helps": "Hands-on treatment can ease stiffness, while specific exercises rebuild strength and endurance in the neck and upper back. Guidance on workstation setup and sleep posture supports long-term relief.",
     "approach": ["Cervical and thoracic assessment", "Mobilisation and soft tissue techniques", "Deep neck flexor and postural strengthening", "Workstation and lifestyle advice"],
     "what_to_expect": "An initial assessment, a clear explanation of what we found and a plan. Most patients notice improvement within the first few sessions, though timelines vary.", "faqs": []},
    {"name": "Knee & Joint Pain Physiotherapy", "category": "Orthopaedic", "condition_keys": ["knee_joint_pain"], "hero_image_url": IMG_EXAM,
     "short_description": "Care for knee, shoulder, hip and other joint pain, stiffness and weakness.",
     "overview": "Joint pain can come from wear and tear, overuse, instability or after an injury. Physiotherapy aims to reduce pain, improve joint mechanics and strengthen surrounding muscles so joints are better supported in daily life.",
     "symptoms": ["Pain on stairs, squatting or walking", "Swelling or a feeling of giving way", "Shoulder pain when reaching overhead", "Morning stiffness in joints"],
     "who_benefits": ["Adults with knee osteoarthritis symptoms", "People with shoulder impingement or frozen shoulder", "Active individuals with joint overuse"],
     "how_it_helps": "A structured exercise programme can improve strength and stability around the joint, often reducing pain and delaying the need for more invasive options. Manual therapy and activity modification support the process.",
     "approach": ["Joint and biomechanical assessment", "Progressive strengthening", "Mobility and balance work", "Activity and footwear guidance"],
     "what_to_expect": "Assessment, goal setting and a home programme. Progress is measured against your goals, whether that is climbing stairs comfortably or returning to sport.", "faqs": []},
    {"name": "Sports Injury Rehabilitation", "category": "Sports", "condition_keys": ["sports_injury"], "hero_image_url": IMG_REHAB,
     "short_description": "Structured recovery from sprains, strains, ligament and overuse injuries.",
     "overview": "Returning to sport too early risks re-injury; returning too late costs fitness and confidence. Our rehabilitation follows clear stages from pain control through to sport-specific loading.",
     "symptoms": ["Ankle or knee sprain", "Muscle strain or tear", "Tendon pain from overuse", "Reduced performance after an injury"],
     "who_benefits": ["Recreational and competitive athletes", "Runners with recurring niggles", "Anyone returning to activity after injury"],
     "how_it_helps": "Progressive loading rebuilds tissue tolerance, while movement retraining addresses the patterns that contributed to injury. Return-to-play criteria help you decide when you are ready.",
     "approach": ["Injury and movement assessment", "Staged rehabilitation plan", "Strength, agility and sport-specific drills", "Return-to-play testing"],
     "what_to_expect": "Clear milestones and honest feedback on where you are in your recovery.", "faqs": []},
    {"name": "Post-Surgery Rehabilitation", "category": "Rehabilitation", "condition_keys": ["post_surgery"], "hero_image_url": IMG_REHAB,
     "short_description": "Guided recovery after orthopaedic and other surgeries, working with your surgeon's protocol.",
     "overview": "Surgery is only part of recovery. Rehabilitation restores movement, strength and function while protecting the surgical repair. We follow your surgeon's protocol and adapt it to how you progress.",
     "symptoms": ["Stiffness after joint replacement", "Weakness following ligament reconstruction", "Difficulty walking after fracture fixation", "Swelling and reduced range of motion"],
     "who_benefits": ["Patients after knee or hip replacement", "ACL or rotator cuff repair recovery", "Post-fracture and spinal surgery patients"],
     "how_it_helps": "Early, appropriate movement reduces stiffness; progressive strengthening restores function. Education helps you understand precautions and milestones.",
     "approach": ["Protocol-based planning with your surgeon's guidance", "Range of motion and swelling management", "Progressive strength and gait training", "Functional and return-to-work goals"],
     "what_to_expect": "Bring your discharge summary and surgical notes if available. Sessions are paced to your surgical timeline.", "faqs": []},
    {"name": "Paralysis & Stroke Rehabilitation", "category": "Neurological", "condition_keys": ["neuro"], "hero_image_url": IMG_THERAPY,
     "short_description": "Focused neuro-rehabilitation to help regain movement, balance and independence after stroke or paralysis.",
     "overview": "Recovery after stroke or paralysis is a journey that benefits from early, consistent and goal-directed therapy. Our neuro-rehabilitation programme focuses on regaining functional movement, safe mobility and independence in everyday tasks, with family involvement where helpful.",
     "symptoms": ["Weakness or paralysis on one side of the body", "Difficulty standing, walking or balancing", "Reduced hand and arm function", "Stiffness (spasticity) or muscle tightness"],
     "who_benefits": ["Patients recovering after stroke", "People living with hemiplegia or paraplegia", "Families seeking a structured home and clinic programme"],
     "how_it_helps": "Task-oriented practice, strengthening and balance training help the nervous system relearn movement. Caregiver training and home programmes extend progress beyond clinic sessions. Outcomes vary from person to person and depend on many factors; we set realistic goals together.",
     "approach": ["Neurological and functional assessment", "Task-specific movement retraining", "Balance, gait and transfer training", "Caregiver guidance and home programme"],
     "what_to_expect": "A thorough first assessment, realistic goal setting with the patient and family, and a plan reviewed at regular intervals.",
     "faqs": [{"question": "How soon after a stroke should therapy start?", "answer": "Generally as early as medically safe. Please follow your treating doctor's advice and book a consultation so we can plan appropriately."}]},
    {"name": "Neurological Rehabilitation", "category": "Neurological", "condition_keys": ["neuro"], "hero_image_url": IMG_REHAB,
     "short_description": "Therapy for Parkinson's, nerve injuries, balance disorders and other neurological conditions.",
     "overview": "Neurological conditions affect movement, balance and coordination in different ways. Physiotherapy helps people maintain function, move more safely and stay active for longer.",
     "symptoms": ["Tremor, rigidity or slowness of movement", "Frequent loss of balance or falls", "Weakness following nerve injury", "Fatigue affecting mobility"],
     "who_benefits": ["People with Parkinson's disease", "Peripheral nerve injury recovery", "Patients with balance and coordination difficulties"],
     "how_it_helps": "Targeted exercise, balance training and movement strategies support day-to-day function and confidence.",
     "approach": ["Comprehensive neurological assessment", "Individualised exercise programme", "Balance and falls prevention training", "Regular progress review"],
     "what_to_expect": "Care that is paced to your condition, with practical strategies for daily life.", "faqs": []},
    {"name": "Mobility & Balance Therapy", "category": "Rehabilitation", "condition_keys": ["mobility"], "hero_image_url": IMG_REHAB,
     "short_description": "Help with walking difficulty, balance concerns and staying independent at any age.",
     "overview": "Reduced mobility affects independence and confidence. Whether due to ageing, deconditioning after illness or a specific condition, a structured programme can improve strength, balance and walking ability.",
     "symptoms": ["Unsteadiness when walking", "Fear of falling", "Difficulty getting up from a chair", "Reduced walking distance"],
     "who_benefits": ["Older adults wanting to stay independent", "People deconditioned after illness or hospital stay", "Anyone with walking or balance concerns"],
     "how_it_helps": "Strength and balance exercise reduces falls risk and improves everyday function. Guidance on walking aids and home safety supports independence.",
     "approach": ["Mobility and falls risk assessment", "Strength and balance programme", "Gait training", "Home safety and aid advice"],
     "what_to_expect": "A gentle, encouraging start with exercises tailored to your current ability.", "faqs": []},
    {"name": "Physiotherapy Consultation", "category": "General", "condition_keys": ["other"], "hero_image_url": IMG_EXAM,
     "short_description": "Not sure where to start? Begin with an assessment and we will guide you to the right care.",
     "overview": "If you are unsure which treatment fits your problem, a consultation is the right first step. A physiotherapist assesses your concern, explains what is likely going on and recommends a plan.",
     "symptoms": ["Pain or stiffness you cannot place", "A recent injury you want checked", "Advice on exercise or posture"],
     "who_benefits": ["Anyone new to physiotherapy", "Patients seeking a second opinion", "People wanting a movement check-up"],
     "how_it_helps": "You get clarity about your condition and a plan, without committing to a specific programme first.",
     "approach": ["History and examination", "Explanation of findings", "Recommended next steps"],
     "what_to_expect": "About an hour with a physiotherapist and a clear recommendation at the end.", "faqs": []},
]

DEMO_DOCTORS = [
    {"name": "Dr. Ananya Kulkarni", "designation": "Senior Physiotherapist", "qualification": "BPT, MPT (Neurology)", "specializations": ["Neurological rehabilitation", "Stroke recovery"], "experience_years": 12, "expertise": ["Hemiplegia rehabilitation", "Balance and gait training", "Caregiver training"], "bio": "Demo profile. Replace with the real physiotherapist's biography from Admin → Doctors.", "philosophy": "Recovery is a partnership between the patient, the family and the therapist.", "services": ["paralysis-and-stroke-rehabilitation", "neurological-rehabilitation", "mobility-and-balance-therapy", "physiotherapy-consultation"]},
    {"name": "Dr. Rohan Deshmukh", "designation": "Consultant Physiotherapist", "qualification": "BPT, MPT (Orthopaedics)", "specializations": ["Orthopaedic physiotherapy", "Spine care"], "experience_years": 9, "expertise": ["Back and neck pain", "Manual therapy", "Postural correction"], "bio": "Demo profile. Replace with the real physiotherapist's biography from Admin → Doctors.", "philosophy": "Understand the cause, treat the person, prevent the recurrence.", "services": ["back-pain-physiotherapy", "neck-pain-physiotherapy", "knee-and-joint-pain-physiotherapy", "physiotherapy-consultation"]},
    {"name": "Dr. Sneha Patil", "designation": "Sports Physiotherapist", "qualification": "BPT, MPT (Sports)", "specializations": ["Sports injuries", "Return to play"], "experience_years": 7, "expertise": ["Ligament rehabilitation", "Running injuries", "Strength and conditioning"], "bio": "Demo profile. Replace with the real physiotherapist's biography from Admin → Doctors.", "philosophy": "Rehabilitation should be measurable, progressive and honest.", "services": ["sports-injury-rehabilitation", "knee-and-joint-pain-physiotherapy", "post-surgery-rehabilitation", "physiotherapy-consultation"]},
    {"name": "Dr. Vikram Joshi", "designation": "Physiotherapist", "qualification": "BPT, MPT (Orthopaedics)", "specializations": ["Post-surgical rehabilitation", "Joint replacement recovery"], "experience_years": 8, "expertise": ["Knee and hip replacement rehab", "Fracture rehabilitation", "Gait training"], "bio": "Demo profile. Replace with the real physiotherapist's biography from Admin → Doctors.", "philosophy": "Every milestone matters, from the first step to the last stair.", "services": ["post-surgery-rehabilitation", "knee-and-joint-pain-physiotherapy", "mobility-and-balance-therapy", "physiotherapy-consultation"]},
    {"name": "Dr. Priya Shinde", "designation": "Neuro Physiotherapist", "qualification": "BPT, MPT (Neurology)", "specializations": ["Paralysis rehabilitation", "Parkinson's care"], "experience_years": 10, "expertise": ["Spasticity management", "Functional retraining", "Falls prevention"], "bio": "Demo profile. Replace with the real physiotherapist's biography from Admin → Doctors.", "philosophy": "Small, consistent gains build lasting independence.", "services": ["paralysis-and-stroke-rehabilitation", "neurological-rehabilitation", "mobility-and-balance-therapy", "physiotherapy-consultation"]},
    {"name": "Dr. Aditya Pawar", "designation": "Physiotherapist", "qualification": "BPT", "specializations": ["Musculoskeletal physiotherapy"], "experience_years": 4, "expertise": ["Neck and shoulder pain", "Ergonomic advice", "Exercise therapy"], "bio": "Demo profile. Replace with the real physiotherapist's biography from Admin → Doctors.", "philosophy": "Clear explanations lead to better recovery.", "services": ["back-pain-physiotherapy", "neck-pain-physiotherapy", "physiotherapy-consultation"]},
    {"name": "Dr. Meera Nair", "designation": "Physiotherapist", "qualification": "BPT, MPT (Cardiopulmonary)", "specializations": ["Geriatric mobility", "Deconditioning recovery"], "experience_years": 6, "expertise": ["Balance training", "Post-illness rehabilitation", "Walking aid assessment"], "bio": "Demo profile. Replace with the real physiotherapist's biography from Admin → Doctors.", "philosophy": "Independence at home is the outcome that matters most.", "services": ["mobility-and-balance-therapy", "neurological-rehabilitation", "physiotherapy-consultation"]},
    {"name": "Dr. Karan Bhosale", "designation": "Sports & Ortho Physiotherapist", "qualification": "BPT, MPT (Sports)", "specializations": ["Sports rehabilitation", "Knee injuries"], "experience_years": 5, "expertise": ["ACL rehabilitation", "Ankle sprains", "Athletic performance"], "bio": "Demo profile. Replace with the real physiotherapist's biography from Admin → Doctors.", "philosophy": "Train the movement, not just the muscle.", "services": ["sports-injury-rehabilitation", "knee-and-joint-pain-physiotherapy", "post-surgery-rehabilitation"]},
]

DEMO_TESTIMONIALS = [
    {"patient_name": "Sample Patient A", "display_mode": "initials", "content": "Demo testimonial. Replace with an approved patient story from Admin → Testimonials. After several weeks of guided sessions, walking felt steadier and I regained confidence at home.", "service_slug": "paralysis-and-stroke-rehabilitation", "condition_key": "neuro", "rating": 5},
    {"patient_name": "Sample Patient B", "display_mode": "initials", "content": "Demo testimonial. Replace with an approved patient story. The assessment was thorough and the exercise plan fitted my desk job. My back pain is far more manageable now.", "service_slug": "back-pain-physiotherapy", "condition_key": "back_pain", "rating": 5},
    {"patient_name": "Sample Patient C", "display_mode": "initials", "content": "Demo testimonial. Replace with an approved patient story. Clear milestones after my knee surgery and honest feedback at every stage.", "service_slug": "post-surgery-rehabilitation", "condition_key": "post_surgery", "rating": 4},
]


async def seed_organization() -> None:
    await db.organizations.update_one({"_id": cfg.organization_id}, {"$setOnInsert": {"_id": cfg.organization_id, "name": "Kaushalya Advanced Physio Therapy and Paralysis Center", "created_at": utc_now()}}, upsert=True)
    await get_settings()


async def seed_owner() -> None:
    if not cfg.admin_email or not cfg.admin_password:
        logger.warning("ADMIN_EMAIL / ADMIN_PASSWORD not set; owner account not seeded")
        return
    email = cfg.admin_email.lower().strip()
    existing = await db.users.find_one({"email": email})
    if existing is None:
        await db.users.insert_one({"_id": new_id(), "organization_id": cfg.organization_id, "email": email, "name": cfg.admin_name, "role": "OWNER", "password_hash": hash_password(cfg.admin_password), "is_active": True, "mfa_enabled": False, "created_at": utc_now(), "updated_at": utc_now()})
        logger.info("Seeded owner account %s", email)
    elif not verify_password(cfg.admin_password, existing["password_hash"]):
        await db.users.update_one({"_id": existing["_id"]}, {"$set": {"password_hash": hash_password(cfg.admin_password), "updated_at": utc_now()}})
        logger.info("Updated owner password from environment for %s", email)


async def seed_services() -> dict:
    if await db.services.count_documents(q()) == 0:
        for i, svc in enumerate(SERVICES):
            await db.services.insert_one(q(_id=new_id(), slug=slugify(svc["name"]), duration_minutes=60, acceptance_mode="INHERIT", is_active=True, is_demo=False, display_order=i, created_at=utc_now(), updated_at=utc_now(), **svc))
    return {s["slug"]: s["_id"] for s in await db.services.find(q()).to_list(500)}


async def seed_demo(service_ids: dict) -> None:
    if await db.doctors.count_documents(q()) == 0:
        for i, doc in enumerate(DEMO_DOCTORS):
            services = [service_ids[s] for s in doc.pop("services") if s in service_ids]
            await db.doctors.insert_one(q(_id=new_id(), slug=slugify(doc["name"]), photo_url="", service_ids=services, capacity_per_slot=1, working_hours=[], time_off=[], is_active=True, is_demo=True, display_order=i, created_at=utc_now(), updated_at=utc_now(), **doc))
        logger.info("Seeded %d demo doctors", len(DEMO_DOCTORS))
    if await db.testimonials.count_documents(q()) == 0:
        settings = await get_settings()
        today = now_local(settings).date()
        for i, t in enumerate(DEMO_TESTIMONIALS):
            await db.testimonials.insert_one(q(_id=new_id(), patient_name=t["patient_name"], display_mode=t["display_mode"], content=t["content"], service_id=service_ids.get(t["service_slug"]), condition_key=t["condition_key"], rating=t["rating"], date=(today - timedelta(days=20 * (i + 1))).isoformat(), is_featured=True, is_published=True, is_demo=True, consent_confirmed=True, created_at=utc_now(), updated_at=utc_now()))
    if await db.appointments.count_documents(q()) == 0:
        await _seed_demo_appointments(service_ids)


async def _seed_demo_appointments(service_ids: dict) -> None:
    settings = await get_settings()
    today = now_local(settings).date()
    samples = [
        ("Demo Patient One", "9876500001", "back-pain-physiotherapy", 1, "10:00"),
        ("Demo Patient Two", "9876500002", "paralysis-and-stroke-rehabilitation", 1, "11:00"),
        ("Demo Patient Three", "9876500003", "knee-and-joint-pain-physiotherapy", 2, "09:00"),
        ("Demo Patient Four", "9876500004", "sports-injury-rehabilitation", 2, "15:00"),
        ("Demo Patient Five", "9876500005", "physiotherapy-consultation", 3, "12:00"),
    ]
    created = 0
    for name, phone, slug, offset, slot in samples:
        day = today + timedelta(days=offset)
        if not engine.day_slots(settings, day):
            day += timedelta(days=1)
        try:
            await appointments.create_booking(BookingCreate(name=name, phone=phone, service_id=service_ids[slug], date=day.isoformat(), slot_start=slot, message="Demo appointment — safe to delete.", consent=True), source="seed", notify=False)
            created += 1
        except Exception as exc:
            logger.warning("Demo appointment skipped: %s", exc)
    await db.appointments.update_many(q(source="seed"), {"$set": {"is_demo": True}})
    logger.info("Seeded %d demo appointments", created)


async def run_seed() -> None:
    await seed_organization()
    await seed_owner()
    service_ids = await seed_services()
    if cfg.seed_demo_data and not cfg.is_production:
        await seed_demo(service_ids)
