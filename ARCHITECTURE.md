# Architecture

## Principles

- **Patients never operate the clinic's internal system.** The public API exposes only what the booking flow needs; every rule (capacity, acceptance, assignment, notice, horizon) is enforced server-side.
- **Business rules live in configuration** (`clinic_settings`) and in a small number of domain services — never in UI components or routers.
- **Feature-oriented modules.** Each domain folder owns its schemas, service functions and router. Routers validate/authorize and delegate; services contain the rules.
- **Organization-aware from day one.** Every document carries `organization_id`; queries go through `q(**filters)` which scopes to the configured organization. V1 has one organization and no multi-tenant UI.
- **No fake functionality.** Integrations report `configured: false` and the UI shows "Configuration required" until credentials exist.

## Backend layers

```
Router (FastAPI)      → request validation (Pydantic), auth/RBAC dependencies, rate limits, serialization
Domain service        → business rules (appointments, scheduling engine, patients, automation, notifications)
Repository layer      → Motor collections via `db`, `q()` org scoping, indexes in core/database.py
Integrations          → WhatsApp Cloud API client + webhook, email client (thin, swappable)
Jobs                  → asyncio loop: reminders + failed-notification retries (retry-safe, idempotent)
```

### Scheduling / capacity engine (`domain/scheduling/engine.py`)

- Day slots are derived from clinic working hours, holidays and `slot_minutes`.
- A doctor is available in a slot if active, not on leave, and either has no custom hours (inherits clinic hours) or has hours covering the slot.
- **Capacity for a service in a slot** = Σ `capacity_per_slot` of eligible available doctors, unless a manual `capacity_overrides` row exists for that date/slot.
- **Booked** = `unassigned` holds + Σ `per_doctor[d]` for eligible doctors. Admin (service-agnostic) view uses `total`.
- Status: `FULL` if remaining ≤ 0, `LIMITED` if remaining/capacity ≤ `limited_threshold`, else `AVAILABLE`.

### Concurrency-safe reservation

One `slot_reservations` document per `(org, date, slot_start)` with `total`, `unassigned` and `per_doctor{}` counters. A booking performs a single `find_one_and_update` whose filter contains an `$expr` guard:

```
booked_for_service(doc) < capacity  AND  per_doctor[candidate] < candidate_capacity
```

If the guard fails, nothing is modified and the next candidate doctor is tried; if none succeed the request falls back to an `unassigned` hold (only if service capacity still allows, e.g. under a manual override) and otherwise returns `409 slot_full`. Because the compare-and-increment is a single atomic document update, two simultaneous requests for the last unit can never both succeed. Cancellation, no-show and reschedule release/move counters with the same primitive. The `tests/test_api_flows.py` concurrency test fires 12 parallel bookings at capacity 3 and asserts exactly 3 succeed.

### Assignment modes

- `AUTO` / `HYBRID`: candidates = eligible doctors ordered by current slot load (then display order); a preferred doctor (admin choice or the current doctor during reschedule) is tried first. `HYBRID` differs only in intent — staff may always reassign.
- `MANUAL`: the reservation is held as `unassigned` and the appointment is flagged `needs_manual_assignment`. Assigning later atomically moves the hold to the doctor (with an owner `force` override).

### Acceptance modes & automation

`automation/engine.py` is a declarative rule table `trigger → condition → action`:

| Trigger | Condition | Action |
|---|---|---|
| appointment_created | acceptance = AUTO | transition to CONFIRMED/ASSIGNED, emit `appointment_confirmed` |
| appointment_created | acceptance ≠ AUTO | send "request received" |
| appointment_confirmed | always | send confirmation |
| appointment_rescheduled | always / AUTO | send reschedule update / re-confirm |
| appointment_cancelled | always | send cancellation |
| doctor_assignment_changed, appointment_completed | always | dashboard notification |

Acceptance is resolved per appointment at creation (`AUTO`, `MANUAL`, or per-service) and stored on the record.

### Appointment state machine (`appointments/state_machine.py`)

`NEW → CONTACTED → CONFIRMED → ASSIGNED → COMPLETED | CANCELLED | NO_SHOW`, plus `RESCHEDULED` as an explicit intermediate state. Transitions are validated centrally; updates use an optimistic filter on the current status so concurrent edits fail with `409 stale_appointment`. Every transition appends to `appointment_status_history`.

### Notifications

`notifications/service.py` creates a notification record per channel (`whatsapp`, `dashboard`), renders templates from settings, and sends asynchronously (`asyncio.create_task`) with retries (max 3) and a periodic retry job. Reminder notifications use a unique `idempotency_key` (`appointment:reminder_24h:whatsapp`) so duplicates are impossible even across job overlaps.

### Authentication & authorization

JWT access (15 min) + refresh (7 days) in httpOnly cookies (Bearer also accepted), server-side `sessions` for revocation, bcrypt passwords, per-IP+email lockout, TOTP MFA with encrypted secret (Fernet key derived from `JWT_SECRET`), one-time recovery codes, password reset tokens (hashed, 1 h TTL). Authorization is a permission map (`core/deps.py::PERMISSIONS`) enforced by the `require("permission")` dependency on every protected route.

## Frontend

- `lib/api.js`: axios instance with cookies, silent refresh on 401 for admin calls, structured error helpers.
- Server state via TanStack Query (`["public", …]` and `["admin", …]` keys; mutations invalidate admin caches).
- Design system: tokens in `index.css`/`tailwind.config.js`, shared primitives (`StatusBadge`, `CapacityIndicator`, `EmptyState`, `LoadingState`, `ErrorState`, `ConfirmDialog`, `Field`, `PersonAvatar`) built on shadcn/ui.
- Booking wizard is a small state machine (`BookingWizard.js`) with shared zod validation mirrored by server-side Pydantic rules.
- Admin pages are lazy-loaded so the public bundle stays small. A global `AppointmentDrawer` context provides the same appointment actions from any admin page.
- Analytics (`lib/analytics.js`) whitelists parameter keys so no PII can be sent to GA or the internal event store.

## Timezones

All appointments store `date`/`slot_start` in clinic-local terms plus a UTC `starts_at`. The clinic timezone is a setting (`clinic.timezone`, default `Asia/Kolkata`) used by `core/timeutil.py`; no function hard-codes India time.
