# Kaushalya Advanced Physio Therapy and Paralysis Center — Website, Booking Engine & Clinic Dashboard

Production-grade healthcare web application combining:

- a premium patient-facing website (services, doctors, patient journey, testimonials, FAQ, contact),
- a frictionless step-based appointment booking flow (no patient account required),
- a capacity-aware, concurrency-safe scheduling engine with configurable acceptance and doctor-assignment modes,
- an owner/staff dashboard (appointments, patients, doctors, services, schedule, messages, analytics, settings, audit),
- WhatsApp Business Cloud API integration (send + signed webhook, idempotent), reminders and a modular automation engine,
- email/password authentication with TOTP MFA, sessions, RBAC and audit logging.

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 (CRA + CRACO), React Router, TanStack Query, Tailwind CSS, shadcn/ui, Recharts, dayjs, zod + react-hook-form |
| Backend | FastAPI (Python 3.11), Motor (async MongoDB driver), Pydantic v2, PyJWT, bcrypt, pyotp, slowapi, httpx |
| Database | MongoDB 7 (UUID string primary keys, atomic `$expr` guarded counters for capacity) |
| Integrations | WhatsApp Business Cloud API (official Graph API), Resend (email), Google Analytics 4 (optional), Google Maps links/embeds |

See `ARCHITECTURE.md`, `DATABASE.md`, `DEPLOYMENT.md` and `SECURITY.md` for detail.

## Repository layout

```
backend/
  server.py                 FastAPI app factory, router registration, lifespan (indexes, seed, jobs)
  app/core/                 config, database + indexes, security (JWT/bcrypt/TOTP/Fernet), deps (auth/RBAC), errors, rate limiting, middleware, time & phone utils
  app/domain/<feature>/     appointments (state machine + service + router), scheduling (capacity engine), patients, doctors, services,
                            settings, notifications, automation (trigger→condition→action rules), auth, users, audit, testimonials, callbacks, dashboard, public
  app/integrations/         whatsapp (client + webhook), email
  app/jobs/                 reminder + retry scheduler
  app/seed.py               idempotent seed (organization, settings, owner, services, optional demo data)
  app/cli.py                operator CLI (reset password, disable MFA, list users)
  tests/                    unit tests (engine, state machine, validation) and API/concurrency tests
frontend/
  src/lib/                  api client (cookies + refresh), analytics (PII-safe), formatting/time, SEO hook
  src/features/             auth context, public queries, booking validation, admin hooks
  src/components/           shared (StatusBadge, CapacityIndicator, states, dialogs), marketing, booking, dashboard
  src/layouts/              PublicLayout, AdminLayout (sidebar, search, appointment drawer)
  src/pages/public|admin    route pages
  public/                   index.html, robots.txt, sitemap.xml
scripts/                    backup.sh, restore.sh
docker/                     Dockerfiles and docker-compose
```

## Local development

Prerequisites: Python 3.11, Node 20 + Yarn, MongoDB 7.

```bash
# backend
cd backend
cp .env.example .env          # fill in values (see Environment variables)
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8001 --reload

# frontend
cd frontend
cp .env.example .env          # REACT_APP_BACKEND_URL=http://localhost:8001
yarn install
yarn start
```

The API is served under `/api`. Interactive docs: `/api/docs` (disabled in production).

## Environment variables

Backend (`backend/.env`):

| Variable | Purpose |
|---|---|
| `MONGO_URL`, `DB_NAME` | MongoDB connection (required) |
| `JWT_SECRET` | 64+ random hex chars; signs tokens and derives the MFA secret encryption key (required) |
| `ENVIRONMENT` | `development` / `staging` / `production` (production disables API docs, skips demo seed, enables HSTS) |
| `CORS_ORIGINS` | Comma-separated allowed origins (`*` in dev). Also used for Origin checks on state-changing requests |
| `ORGANIZATION_ID` | Tenant key written on every document (multi-clinic ready) |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | Owner account, seeded idempotently on startup (password re-synced if changed) |
| `SEED_DEMO_DATA` | `true` to seed demo doctors/testimonials/appointments (never in production) |
| `COOKIE_SECURE`, `COOKIE_SAMESITE` | Auth cookie flags (`true`, `lax` recommended for same-origin) |
| `ACCESS_TOKEN_MINUTES`, `REFRESH_TOKEN_DAYS` | Session lifetimes |
| `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN` | Meta Cloud API sending credentials |
| `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET` | Webhook verification token and HMAC signing secret |
| `WHATSAPP_API_VERSION` | Graph API version (default `v21.0`) |
| `RESEND_API_KEY`, `EMAIL_FROM` | Email delivery (password reset, operational) |
| `PUBLIC_APP_URL` | Public origin used in reset links and the webhook URL shown in settings |
| `REMINDER_JOB_INTERVAL_SECONDS` | Background job cadence (default 300) |

Frontend (`frontend/.env`): `REACT_APP_BACKEND_URL`, optional `REACT_APP_GA_MEASUREMENT_ID`.

Never commit `.env`. `.env.example` files list variable names only.

## Database setup, migrations and seed

- Indexes are created idempotently at startup (`app/core/database.py::ensure_indexes`).
- Schema evolution uses versioned migration scripts under `backend/migrations/` (see `DATABASE.md`); each migration records itself in the `schema_migrations` collection.
- Seed (`app/seed.py`) runs at startup: organization, default clinic settings (real clinic details, editable in Admin → Settings), owner user, the service catalogue, and demo content only when `SEED_DEMO_DATA=true` and not production. Demo records carry `is_demo: true` and are labelled in the UI.

## WhatsApp configuration

1. Create a Meta Business app with the WhatsApp product; obtain **Phone Number ID** and a **permanent System User access token**.
2. Set `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, choose a random `WHATSAPP_VERIFY_TOKEN`, and copy the app's **App Secret** to `WHATSAPP_APP_SECRET`. Restart the backend.
3. In Meta → WhatsApp → Configuration, set the callback URL to `https://<your-domain>/api/webhooks/whatsapp` with your verify token; subscribe to `messages`.
4. For business-initiated messages outside the 24-hour window, create approved templates and enter their names in Admin → Settings → WhatsApp (parameters order: patient name, appointment ID, date, time, service, clinic name).

Until credentials exist the dashboard shows **Configuration required**; notifications are composed and logged (`skipped_not_configured`) but never falsely reported as sent.

## Admin setup

1. Set `ADMIN_EMAIL` / `ADMIN_PASSWORD` before first start — the owner is created automatically.
2. Sign in at `/admin/login`, open **Security & account** and enable TOTP MFA; store the recovery codes.
3. Review **Settings**: clinic details, working hours, holidays, booking rules (acceptance and assignment modes, notice, horizon, capacity), notifications and templates, website content. Add real doctors (Admin → Doctors) and deactivate/replace demo profiles and testimonials before launch.
4. Operator recovery: `python -m app.cli reset-password <email> <new>` or `python -m app.cli disable-mfa <email>`.

## Testing

```bash
cd backend
python -m pytest            # unit tests + API tests (API tests expect the server on http://localhost:8001)
```

Covered: capacity calculation, availability rules, state transitions, phone validation, concurrent booking safety (12 parallel requests against capacity 3 → exactly 3 succeed), duplicate detection, cancellation releases capacity, authentication and authorization failures. End-to-end UI flows are exercised with browser automation (see `test_reports/`).

## Production deployment, backups and recovery

See `DEPLOYMENT.md` (Docker, reverse proxy, HTTPS, health checks) and the backup/restore procedure with `scripts/backup.sh` / `scripts/restore.sh`.
