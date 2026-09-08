# Security

## Controls implemented

| Area | Implementation |
|---|---|
| Transport | HTTPS at the reverse proxy; `Strict-Transport-Security` header in production |
| Headers | `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, `Cache-Control: no-store` on API responses |
| Passwords | bcrypt with per-password salt; minimum 10 characters; change-password revokes other sessions |
| Sessions | Short-lived JWT access token (15 min) + refresh token (7 days) in `httpOnly`, `Secure`, `SameSite` cookies; server-side session records allow revocation and "sign out other devices" |
| MFA | TOTP (RFC 6238, Google Authenticator compatible) with replay protection (last used step), Fernet-encrypted secret at rest, hashed one-time recovery codes |
| Brute force | Per IP+email failure counter → 15-minute lockout after 5 failures; login/MFA/reset endpoints rate-limited (10/min, 5/min) |
| Authorization | Role→permission map enforced server-side via `require()` on every admin route; frontend role checks are cosmetic only |
| CSRF | SameSite cookies + Origin header validation for state-changing authenticated requests when `CORS_ORIGINS` is explicit |
| Input validation | Pydantic models on every endpoint; phone normalization; name character whitelist; consent flag required; honeypot field on public forms |
| Rate limiting | Public booking 8/min/IP, callbacks 5/min, analytics events 60/min, webhook 600/min (`slowapi`, `X-Forwarded-For` aware) |
| Duplicate/abuse | Same phone + same date active booking rejected; duplicate patient records flagged for review |
| Injection | Parameterized Motor queries; no string-built queries; regex search inputs are user-scoped and length-limited |
| Secrets | All credentials from environment; `.env.example` lists names only; WhatsApp token never leaves the server; API docs disabled in production |
| Webhooks | `X-Hub-Signature-256` HMAC validation with the Meta App Secret; unsigned/invalid payloads rejected (403); idempotent via unique event ids |
| Audit | Login/logout/failed login, appointment lifecycle, assignments, patient edits/notes, settings changes, exports, MFA changes, user management — with actor, resource, timestamp, IP; metadata excludes sensitive content |
| Privacy | Minimal data collection (name, phone, service, time; email/message optional); no medical history in public forms; analytics parameters whitelisted (no names/phones); privacy notice and consent checkbox in booking |
| Errors | Structured JSON errors with friendly messages; stack traces only in server logs |
| Logging hygiene | Passwords, tokens and secrets are never logged; inbound WhatsApp bodies truncated to 1000 chars |

## Operational guidance

- Rotate `JWT_SECRET` only with a planned re-login for all staff (existing MFA secrets are encrypted with a key derived from it — export/re-enrol MFA first, or keep the secret stable).
- Enable MFA on the owner account immediately after first login.
- Keep `CORS_ORIGINS` explicit in production.
- Review the audit log and `login_attempts` periodically; investigate repeated `admin_login_failed` entries.
- Apply dependency updates monthly (`pip list --outdated`, `yarn outdated`).

## Known limitations / roadmap

- Rate limiting is in-process (single instance). For multi-instance deployments configure `slowapi` with a Redis storage URI.
- CAPTCHA is intentionally not enabled; add it only if the honeypot + rate limits prove insufficient.
- Legal compliance (DPDP Act etc.) requires professional review; this codebase is designed to support, not certify, compliance.
