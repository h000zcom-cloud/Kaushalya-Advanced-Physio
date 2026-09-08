# Database

MongoDB 7. All primary keys are UUID v4 strings (`_id`). Every business document carries `organization_id`, `created_at` and `updated_at` (UTC, tz-aware).

## Collections

| Collection | Purpose | Key fields / notes |
|---|---|---|
| `organizations` | Clinic/tenant | `_id` = `ORGANIZATION_ID` |
| `clinic_settings` | All configurable business rules and website content | `_id` = organization id; sections `clinic`, `working_hours[7]`, `holidays[]`, `booking`, `notifications`, `whatsapp`, `content` |
| `users` | Dashboard accounts | `email` (unique), `password_hash`, `role` (OWNER/ADMIN/STAFF/DOCTOR), `mfa_enabled`, `mfa_secret` (Fernet-encrypted), `mfa_recovery_codes` (sha256), `is_active` |
| `sessions` | Server-side login sessions | `user_id`, `expires_at` (TTL), `revoked` |
| `login_attempts` | Brute-force lockout | `identifier` (ip:email), `count`, `locked_until`, TTL |
| `password_reset_tokens` | Hashed reset tokens | `token_hash` (unique), `expires_at` (TTL), `used` |
| `doctors` | Physiotherapists | `slug` (unique/org), `service_ids[]`, `capacity_per_slot`, `working_hours[{weekday,start,end}]`, `time_off[{start_date,end_date}]`, `is_active`, `is_demo` |
| `services` | Service catalogue + page content | `slug` (unique/org), `condition_keys[]`, `acceptance_mode` (INHERIT/AUTO/MANUAL), `is_active` |
| `patients` | One record per person | `phone` (normalized E.164), `email?`, `total_appointments`, `last_appointment_at`, `duplicate_review` |
| `patient_notes` | Staff notes | `patient_id`, `text`, `author_*` |
| `appointments` | Bookings | `public_id` (`PT-YYYY-NNNNNN`, unique), `patient_*`, `service_*`, `date`, `slot_start/end`, `starts_at` (UTC), `doctor_id?`, `capacity_doctor_id?` (internal hold), `needs_manual_assignment`, `acceptance_mode`, `status`, `source`, `notes[]`, `rescheduled_from?`, `is_demo` |
| `appointment_status_history` | Immutable transitions | `appointment_id`, `from_status`, `to_status`, `actor_*`, `reason` |
| `slot_reservations` | Atomic capacity counters | `_id` = `org|date|slot_start`; `total`, `unassigned`, `per_doctor{doctorId: n}` |
| `capacity_overrides` | Manual slot capacity | unique `(org, date, slot_start)`, `capacity`, `note` |
| `counters` | Sequence for public IDs | `_id` = `org:appointment:YEAR`, `seq` |
| `notifications` | Outbound message log (WhatsApp/dashboard) | `channel`, `event`, `template_key`, `to_phone`, `body`, `status` (queued/sending/sent/failed/skipped_not_configured/delivered), `attempts`, `provider_message_id`, `idempotency_key` (unique, sparse) |
| `whatsapp_conversations` | One per patient number | `phone` (unique/org), `patient_id?`, `unread_count`, `last_message_at` |
| `whatsapp_messages` | Inbound + outbound messages | `conversation_id`, `direction`, `provider_message_id` (unique), `body` (≤1000 chars), `delivery_status` |
| `whatsapp_events` | Raw webhook events for idempotency | `_id` = `message:<id>` or `status:<id>:<status>` |
| `email_outbox` | Email log (sent / logged when not configured) | `to`, `subject`, `kind`, `status` |
| `callback_requests` | "Request a callback" leads | `name`, `phone`, `reason?`, `preferred_time?`, `status` (NEW/CONTACTED/CLOSED) |
| `testimonials` | Approved stories | `patient_name`, `display_mode`, `content`, `service_id?`, `is_published`, `is_featured`, `consent_confirmed`, `is_demo` |
| `analytics_events` | PII-free website events | `name` (whitelisted), `params` (whitelisted keys) |
| `audit_logs` | Who did what | `user_id/email/name`, `action`, `resource`, `resource_id`, `metadata` (non-sensitive), `ip` |

## Indexes (created at startup)

- `users.email` unique; `sessions.expires_at` TTL; `login_attempts.identifier` unique + TTL; `password_reset_tokens.token_hash` unique + TTL
- `patients (org, phone)`, `(org, created_at)`, `(org, name)`
- `appointments.public_id` unique; `(org, date, slot_start)`; `(org, status, starts_at)`; `(org, doctor_id, date)`; `(org, service_id)`; `(org, patient_id, starts_at)`; `(org, patient_phone, date)`; `(org, created_at)`
- `appointment_status_history (appointment_id, created_at)`
- `slot_reservations (org, date)`; `capacity_overrides (org, date, slot_start)` unique
- `doctors (org, slug)` unique, `(org, is_active)`; `services (org, slug)` unique
- `notifications.idempotency_key` unique sparse, `(org, created_at)`, `appointment_id`, `provider_message_id`
- `whatsapp_messages.provider_message_id` unique sparse; `whatsapp_conversations (org, phone)` unique
- `audit_logs (org, created_at)`, `(resource, resource_id)`; `analytics_events (org, created_at)`, `(org, name)`

## Integrity rules

- Capacity is enforced by atomic `$expr`-guarded `find_one_and_update` on `slot_reservations` (see ARCHITECTURE.md). Frontend counters are never trusted.
- Status changes use optimistic filters (`{_id, status: <expected>}`); stale updates fail with 409.
- Pydantic models validate every write at the API boundary; unique indexes protect identifiers and idempotency keys.
- Compensation: if the appointment insert fails after a reservation, the reservation is released in the same request.

## Migrations

Schema changes are shipped as versioned scripts in `backend/migrations/NNNN_description.py`, each exposing `async def up(db)` and recording `{version, applied_at}` in `schema_migrations`. Run with `python -m migrations.run` before deploying a new version (see DEPLOYMENT.md). Never edit production data ad hoc without a migration entry.

## Seed data

`app/seed.py` is idempotent: it inserts only when a collection is empty (services, demo doctors, demo testimonials, demo appointments) or when the owner is missing. Demo content is flagged `is_demo: true`, labelled in the UI, and skipped entirely when `ENVIRONMENT=production`.
