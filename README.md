# Forty — 40-Day Fast Coordination

A quiet web app for organizing a congregational fast where each family carries one day of a 40-day chain. Built for LDS ward use with a stake hierarchy in mind, but applicable to any small-organization fast.

## Architecture in one paragraph

Next.js 14 (App Router) on Vercel · Supabase Postgres via Prisma · NextAuth email magic-link admin auth · per-ward Twilio (encrypted at rest) · SendGrid for outbound email + Inbound Parse for experience replies · Anthropic Claude for AI-drafted reminders · Vercel Cron runs once daily to dispatch all scheduled communications. Participants never need accounts — they sign up via a public form gated by an access code in the URL, and receive a magic link to manage their signup or share experiences afterward.

## Hierarchy

- **Super Admin** — creates stakes; invites stake admins
- **Stake Admin** — creates wards; invites ward admins; sees aggregated stake-wide reports (no PII)
- **Ward Admin** — runs fasts: configures reminders, manages signups + PII, moderates experiences, sets up the ward's Twilio account
- **Participants** — no account; access via `/m/<magic-token>` link

## Local setup

```bash
# 1. Install
npm install

# 2. Configure env
cp .env.example .env
# Fill in DATABASE_URL, NEXTAUTH_SECRET, ENCRYPTION_KEY, etc.
# Generate secrets with: openssl rand -base64 32

# 3. Push schema to Supabase
npm run db:push

# 4. Seed your super admin
SUPER_ADMIN_EMAIL=you@example.com SUPER_ADMIN_NAME="Your Name" npm run db:seed

# 5. Run
npm run dev
```

Visit `http://localhost:3000/admin` and sign in with your super admin email.

## Deploying to Vercel

1. **Push to GitHub**, then import into Vercel.
2. **Add all env vars** from `.env.example` to your Vercel project settings.
   - `NEXTAUTH_URL` and `APP_URL` should be your production domain (e.g., `https://forty.yourchurch.org`).
3. **Configure Vercel Postgres** or paste your Supabase connection strings.
4. **Verify the cron** appears in your Vercel dashboard under "Crons" (defined in `vercel.json`).

## SendGrid setup

### Outbound email

1. Create a SendGrid account and verify your sending domain (e.g., `yourdomain.com`).
2. Generate an API key with **Mail Send** permission. Set it as `SENDGRID_API_KEY`.
3. Set `SENDGRID_FROM_EMAIL` to a verified address.

### Inbound Parse (for experience email replies)

1. Add an MX record pointing a subdomain like `reply.yourdomain.com` → `mx.sendgrid.net` (priority 10).
2. In SendGrid → Settings → Inbound Parse → Add Host & URL:
   - Subdomain: `reply.yourdomain.com`
   - Destination URL: `https://yourdomain.com/api/inbound/experience`
   - Check "POST the raw, full MIME message" → **leave unchecked**.
3. Set `INBOUND_EMAIL_DOMAIN=reply.yourdomain.com` in env.

When experience follow-up emails go out, the reply-to address becomes `experience+<token>@reply.yourdomain.com`, and replies create pending Experience records for ward admins to moderate.

## Twilio (per-ward)

Each ward configures its own Twilio account via the app:

1. Sign in as Ward Admin → your ward → **Twilio** → enter Account SID, Auth Token, and From Number.
2. Auth Token is encrypted at rest using `ENCRYPTION_KEY` (AES-256-GCM).
3. Use the **Send test SMS** button to verify.

Wards without Twilio configured can still run fasts — they just can't send SMS reminders. Email-only flows still work.

## Anthropic (AI message drafting)

Set `ANTHROPIC_API_KEY`. The "Draft with AI" button in the reminder editor uses Claude to generate warm, contextually-aware drafts that admins then edit. Without the key, AI drafting falls back to a placeholder message and the admin writes the template manually.

## The daily cron

`/api/cron/daily` runs at 13:00 UTC (6am Mountain). It iterates every active fast and:

- Fires broadcast reminders matching today's offset from the fast's start
- Fires individual reminders for any participant whose fast date offset matches
- Fires experience follow-ups (1, 7, 30, 60 days post-fast — configurable)
- Alerts ward admins about any day exactly 7 days from now that has no primary signup
- Auto-completes any fast that has passed its 40-day window

The cron is protected by `CRON_SECRET`. Set it to a random string; Vercel injects it as the Bearer token automatically.

## Reminder model

Three kinds of reminders are configured per fast:

| Kind | Offset relative to | Example |
| --- | --- | --- |
| **Broadcast** | Fast start date | `-3` = 3 days before fast begins; `7` = day 8 |
| **Individual** | Each participant's day | `-1` = day before their fast; `0` = day-of |
| **Experience follow-up** | Each participant's day | `1`, `7`, `30`, `60` days after |

Templates use merge fields like `{{firstName}}`, `{{fastDate}}`, `{{magicLink}}` — see the editor for the full list.

## Privacy model

- **Ward admins** see all participant names, emails, phones.
- **Stake admins** see aggregated counts and approved experience text — never PII.
- **Super admin** sees everything organizationally but has no special access to participant data beyond what's needed for support.
- **Experiences** require explicit ward-admin approval before being visible to the same-fast cohort or the public landing page.

## What's where

```
src/
  app/
    page.tsx                              # Marketing landing
    admin/                                # Auth-gated admin app
      page.tsx                            # Role-aware dashboard
      stakes/[id]/                        # Stake mgmt + report
      wards/[id]/                         # Ward mgmt + Twilio setup
      fasts/[id]/                         # Fast mgmt: overview, reminders, signups, experiences, settings
      invites/[token]/                    # Accept admin invitations
    f/[slug]/                             # Public signup (access-code gated)
    m/[token]/                            # Participant magic link
    api/
      auth/[...nextauth]/route.ts         # NextAuth handler
      cron/daily/route.ts                 # Vercel Cron entry
      inbound/experience/route.ts         # SendGrid Inbound Parse webhook
      ai/draft-reminder/route.ts          # Anthropic-powered drafting
  lib/
    prisma.ts auth.ts authz.ts            # Data & auth
    comms.ts                              # The communications engine
    email.ts sms.ts ai.ts                 # External integrations
    crypto.ts tokens.ts                   # Encryption & token gen
    dates.ts merge.ts                     # Date math & template engine
  components/                             # Client components
prisma/
  schema.prisma seed.ts
```

## Operational notes

- The cron is idempotent for broadcasts (uses `sentAt`) but **not** for individual reminders or follow-ups — they trigger when today's date matches the offset. Don't run the cron more than once per ward-day.
- If you change a ward's timezone after signups exist, individual reminders will shift accordingly. Avoid doing this mid-fast.
- All scheduled messages are logged in `MessageLog` with `PENDING`/`SENT`/`FAILED` status — useful for debugging delivery.
- The access code on a public fast URL is rotatable from Fast → Settings. Rotating invalidates all previously shared links.

## What to build next (intentionally deferred)

- Participant cancellation flow with 72-hour notice rule (the field exists; the UI is not yet wired up)
- Stake-level AI summary of experience themes in the PDF report
- Ward admin dashboard showing latest message delivery failures inline
- Two-factor for super admin actions

## License

Internal use only unless otherwise specified.
