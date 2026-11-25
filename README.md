# Serious-ish

The Serious-ish dating app for the Toronto pilot: an iOS and Android member app, a staff-only
moderation page and a Supabase backend, in one repository.

## Source order

When documents disagree, this order decides:

1. **PRD**: behaviour (what the product does)
2. **TRD**: architecture (how it is built)
3. **Security & Access**: safeguards (what must never happen)
4. **Frontend Specification**: visuals (how it looks)

## Repository layout

Folder names follow TRD section 3.1. The workspace (`pnpm-workspace.yaml`) lists `apps/*` and
`packages/*`.

| Folder                   | What it is                                                                |
| ------------------------ | ------------------------------------------------------------------------- |
| `apps/mobile`            | Member app: Expo SDK 58, React Native, TypeScript, Expo Router            |
| `apps/moderation`        | Staff moderation page: Next.js 16 on Vercel, desktop only                 |
| `packages/shared`        | Types, Zod rules and constants used by both apps                          |
| `packages/design-tokens` | `palette.ts`, the only place colour values may appear                     |
| `supabase`               | The backend as code: config, migrations, Edge Functions, seed data, tests |
| `scripts`                | Repository checks (public variable check, secret scan self-test)          |
| `.github/workflows`      | CI                                                                        |

## Getting started

### Prerequisites

- **Node.js 24** (24.3 or newer). The version is pinned in `.nvmrc`: run `nvm use`.
- **pnpm 10**, through Corepack: `corepack enable pnpm`. The exact version is pinned in
  `package.json`.
- **Docker Desktop** for the local backend. The **Supabase CLI** is a pinned dev dependency
  (`pnpm install` brings it); run it as `pnpm exec supabase`, not a global install, so everyone
  and CI use the same version.
- **gitleaks** to run the secret scan locally (`brew install gitleaks`).
- For the phone: Expo Go for the placeholder screens, and an Expo development build once native
  modules arrive (RevenueCat and the age-check camera flow need one).

### Install and run

```bash
pnpm install
```

Mobile app (opens the Expo dev server; press `i` for the iOS simulator or `a` for Android):

```bash
cp apps/mobile/.env.example apps/mobile/.env.local
pnpm mobile
```

Moderation page (http://localhost:3000):

```bash
cp apps/moderation/.env.example apps/moderation/.env.local
pnpm moderation
```

Local backend (needs Docker running; prints the local URL and keys):

```bash
pnpm db:start
```

Copy the local API URL and publishable key from `pnpm db:start` into the two `.env.local`
files. For local Edge Functions, copy `supabase/functions/.env.example` to
`supabase/functions/.env` and use vendor **sandbox** keys only.

### Database

The schema is the 37 tables from TRD 4, built by the dated files in `supabase/migrations`.
Every table has row level security on; signed-out requests can do nothing, members can only
read their own rows and allowed columns, and all writes go through database functions.

| Command            | What it does                                                                                              |
| ------------------ | --------------------------------------------------------------------------------------------------------- |
| `pnpm db:start`    | Starts the local database and applies every migration                                                     |
| `pnpm db:reset`    | Rebuilds the local database from scratch: migrations, then `supabase/seed.sql`                            |
| `pnpm db:test`     | Runs the access-rule and audit tests in `supabase/tests` (pgTAP)                                          |
| `pnpm db:test:api` | Runs the photo storage and duplicate-request tests against the running local stack (`supabase/tests/api`) |
| `pnpm db:types`    | Regenerates `packages/shared/src/types/database.generated.ts`                                             |

### Photo storage

Photos live in two private buckets (FT-007). Members upload to `photos-intake`, one JPEG of at
most 1.5 MB per slot reserved with `create_photo_slot`, into their own folder only; they cannot
read, list, sign, overwrite or delete files. Photo screening (FT-023) strips location data and
copies an approved photo to `photos`. Display links come only from the `photo-links` Edge
Function, last 10 minutes and are given only for approved photos the caller may see:
`private.photo_visible_to` refuses unscreened photos, blocks either way, unmatches, deletions,
holds and inactive members.

If `pnpm db:start` skips storage on a machine that was linked to a hosted project, delete
`supabase/.temp/storage-version`: it holds the hosted storage version, which is not published.

### Server time and duplicate requests

The server's clock is the only one that counts (FT-006). Deadlines are stored in UTC and
checked in the database; the app draws countdowns with `serverNow()` and `timeLeftMs()` from
`apps/mobile/src/lib/serverClock.ts`, which every reply's `Date` header keeps in step (and
`syncServerClock()` sets to the millisecond through `server_time()`). Changing the phone's clock
or time zone never moves a countdown. Daily limits reset at midnight and weekly SuperLikes at
Monday midnight in `app_config.daily_quota_timezone` (America/Toronto), from
`private.quota_period`.

Every swipe and message carries a `client_request_id`, made once per tap with
`newRequestId()` and reused on each retry. A function that writes one starts with
`private.lock_request(member, request_id)`, then returns the stored result if that ID was
already used, so a double tap or a retry after a timeout acts once and charges one limit. The
pattern is written out at the top of `20261125000100_server_time_requests.sql`.

Rules for database changes (TRD 3.2, Security 4):

- Never edit a migration that has been applied; add a new dated file.
- A new table ships in the same pull request as its row level security, its grants and tests.
  `supabase/tests/rls/00_inventory.test.sql` fails CI for any table without row level
  security, any table a signed-out request can touch, and any table members can write directly.
- After a schema change, run `pnpm db:types` and commit the regenerated file; CI checks it.

### Checks

Everything CI runs, in one command:

```bash
pnpm check
```

Or one at a time: `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`,
`pnpm check:public-env`, `pnpm check:secret-scan`.

## Continuous integration

`.github/workflows/ci.yml` runs on every pull request and every push to `main`:

| Job                                | What it does                                                                                                 |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Type-check, lint, format and tests | TypeScript strict, ESLint, Prettier, Jest, and the public variable check                                     |
| Secret scan                        | gitleaks over the full history and working tree, plus a self-test proving it catches every required key type |
| Database tests                     | Applies every migration to an empty database, runs the pgTAP tests and the linter, checks generated types    |
| Pull request title                 | The title follows the commit format below (commitlint)                                                       |
| Dependency review                  | Fails a pull request that adds a dependency with a known high-severity vulnerability                         |

`main` is protected: a pull request cannot merge until every job passes.

### Branches, commits and merging

- Branch from `main` and name the branch with its Jira key, for example `feat/SI-34-phone-sign-in`,
  so Jira links the branch, commits and pull request to the issue.
- Pull requests are **squash-merged**: each one becomes a single commit on `main`, and the pull
  request title becomes its subject line.
- Commit messages and pull request titles follow Conventional Commits (`commitlint.config.mjs`):

```
<type>(<scope>): <summary in imperative mood, 72 characters at most>

<body: what changed and why>

Refs: SI-<n>
```

Types: `feat`, `fix`, `chore`, `ci`, `docs`, `refactor`, `test`, `build`, `perf`, `revert`.
Scopes: `mobile`, `moderation`, `shared`, `design-tokens`, `supabase`, `ci`, `repo`, `deps`.

Check a message locally with `printf 'feat(mobile): add welcome screen' | pnpm exec commitlint`.

### The secret scan

`.gitleaks.toml` extends gitleaks' built-in rules with the services we use. It fails if any of
these appear in the code: a Supabase secret key, a Twilio key or account SID, a Resend key, a
RevenueCat secret key, an AWS key, or an age-check vendor key. It also fails if a secret-looking
value is assigned to any `EXPO_PUBLIC_` or `NEXT_PUBLIC_` variable.

`scripts/check-public-env.mjs` fails if any `EXPO_PUBLIC_` or `NEXT_PUBLIC_` name is used that
is not on the approved list below. Adding a public variable means adding it to that script and to
this README in the same pull request.

If a secret is ever committed, treat it as leaked: **replace it first**, then clean the history.

## Environments

Three environments, each with its own Supabase project, keys and build profile. Keys are never
shared between environments.

| Environment | Backend                                     | Mobile build profile (`eas.json`) | Moderation page            | Vendor mode                               |
| ----------- | ------------------------------------------- | --------------------------------- | -------------------------- | ----------------------------------------- |
| Development | Supabase running locally (`pnpm db:start`)  | `development`                     | `pnpm moderation` locally  | Sandbox keys; no real members or payments |
| Staging     | Its own Supabase project, Canada (Central)  | `staging`                         | Vercel preview environment | Store sandbox; vendor test mode           |
| Production  | The live Supabase project, Canada (Central) | `production`                      | Vercel production          | Live; deployed only from `main` by CI     |

Production keys live only in the secret stores: EAS environment variables, Vercel environment
variables, Supabase Edge Function secrets and GitHub Actions environment secrets. They are never
in a file, a chat message or a screenshot.

### Where each environment lives

| Service                          | Staging                                                                                | Production                                                              |
| -------------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Supabase (org `Serious-ish`)     | `serious-ish-staging` (`zlxekbykyfkdnrmpsjvq`), Canada (Central)                       | `serious-ish-production` (`owqljrsfycuuqwhzglix`), Canada (Central)     |
| Expo (org `serious-ish`)         | Project `@serious-ish/serious-ish`, EAS environment `preview`                          | Same project, EAS environment `production`                              |
| GitHub Actions                   | Environment `staging`                                                                  | Environment `production` (deployable from `main` only)                  |
| Vercel (team `Serious-ish Team`) | Project `serious-ish-moderation`, **Preview** deployments (every branch except `main`) | Same project, **Production**: https://serious-ish-moderation.vercel.app |

The Supabase URL and publishable key for each environment are set as EAS environment variables
(`eas env:list --environment preview` or `production`) and Vercel environment variables
(`vercel env ls`). For local development, copy the values from `pnpm db:start` into
`.env.local` files as described above.

The moderation page builds on Node 24 (`engines` in `apps/moderation/package.json`) and runs its
server code in Vercel's Montréal region, `yul1` (`apps/moderation/vercel.json`, decision TRD-04).
Preview deployments have no fixed `SITE_URL`; the page will fall back to the deployment's own
address when staff sign-in arrives (FT-011).

## Environment variables

Every value the code reads from outside itself. `.env.example` files list the names with empty
values; real values never enter the repository.

**Public** values are shipped inside the app or the browser and anyone can read them. **Secret**
values must only ever exist in the stores named below.

Owners: **Adi** (Developer A: backend, integrations), **Yashdeep** (Developer B: mobile and
moderation screens), **Parveen** (founder: owns every business account).

### Mobile app (`apps/mobile/.env.example`)

Read only through `apps/mobile/src/config/env.ts`.

| Variable                               | Public / Secret | Owner | Where the real value lives    | What it is                                             |
| -------------------------------------- | --------------- | ----- | ----------------------------- | ------------------------------------------------------ |
| `EXPO_PUBLIC_APP_ENV`                  | Public          | Adi   | Set by each EAS build profile | `development`, `staging` or `production`               |
| `EXPO_PUBLIC_SUPABASE_URL`             | Public          | Adi   | EAS environment variables     | That environment's Supabase project address            |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public          | Adi   | EAS environment variables     | Supabase publishable key; database rules decide access |
| `EXPO_PUBLIC_REVENUECAT_IOS_KEY`       | Public          | Adi   | EAS environment variables     | RevenueCat public SDK key for the App Store            |
| `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`   | Public          | Adi   | EAS environment variables     | RevenueCat public SDK key for Google Play              |
| `EXPO_PUBLIC_POSTHOG_KEY`              | Public          | Adi   | EAS environment variables     | PostHog project key (US region)                        |
| `EXPO_PUBLIC_POSTHOG_HOST`             | Public          | Adi   | EAS environment variables     | PostHog US cloud address                               |
| `EXPO_PUBLIC_SENTRY_DSN`               | Public          | Adi   | EAS environment variables     | Where crash reports are sent (US region)               |

### Moderation page (`apps/moderation/.env.example`)

The page never holds a Supabase secret key. Staff read through narrow database functions under
their own two-step login.

| Variable                               | Public / Secret | Owner    | Where the real value lives     | What it is                                 |
| -------------------------------------- | --------------- | -------- | ------------------------------ | ------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`             | Public          | Adi      | Vercel environment variables   | Supabase project address                   |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public          | Adi      | Vercel environment variables   | Supabase publishable key                   |
| `NEXT_PUBLIC_SENTRY_DSN`               | Public          | Adi      | Vercel environment variables   | Where error reports are sent               |
| `SESSION_COOKIE_NAME`                  | Public          | Yashdeep | Vercel environment variables   | Staff sign-in cookie name, per environment |
| `SITE_URL`                             | Public          | Yashdeep | Vercel environment variables   | The page's own address, per environment    |
| `SENTRY_AUTH_TOKEN`                    | Secret          | Adi      | Vercel and GitHub secrets only | Uploads readable error traces at build     |

### Edge Functions (`supabase/functions/.env.example`)

All secret. Set per project with `pnpm exec supabase secrets set --remote=<ref>`; they exist only on
Supabase's servers.

| Variable                      | Public / Secret             | Owner   | Used by                            | What it is                                        |
| ----------------------------- | --------------------------- | ------- | ---------------------------------- | ------------------------------------------------- |
| `SUPABASE_SECRET_KEY`         | Secret                      | Adi     | Functions writing protected tables | Supabase secret key; bypasses every rule          |
| `VERIFICATION_VENDOR_API_KEY` | Secret                      | Adi     | `start-verification`               | Age-check vendor key                              |
| `VERIFICATION_WEBHOOK_SECRET` | Secret                      | Adi     | `verification-webhook`             | Proves a result really came from the vendor       |
| `VERIFICATION_TEMPLATE_ID`    | Secret                      | Adi     | `start-verification`               | The vendor's selfie-age and ID-fallback flow      |
| `REVENUECAT_WEBHOOK_AUTH`     | Secret                      | Adi     | `revenuecat-webhook`               | Long random value RevenueCat sends in a header    |
| `REVENUECAT_SECRET_API_KEY`   | Secret                      | Adi     | `revenuecat-webhook`               | Server key for subscriber lookups                 |
| `AWS_ACCESS_KEY_ID`           | Secret                      | Adi     | `screen-photo`                     | Narrow AWS user: Rekognition only                 |
| `AWS_SECRET_ACCESS_KEY`       | Secret                      | Adi     | `screen-photo`                     | Its secret                                        |
| `AWS_REGION`                  | Secret store, not sensitive | Adi     | `screen-photo`                     | `ca-central-1`                                    |
| `RESEND_API_KEY`              | Secret                      | Adi     | `notify-report`, `daily-summary`   | Send-only email key                               |
| `EMAIL_FROM`                  | Secret store, not sensitive | Adi     | `notify-report`, `daily-summary`   | Verified sender address                           |
| `MODERATOR_ALERT_EMAILS`      | Secret                      | Parveen | `notify-report`, `daily-summary`   | Reviewer and backup reviewer addresses            |
| `MODERATION_BASE_URL`         | Secret store, not sensitive | Adi     | `notify-report`, `daily-summary`   | Moderation page address for email links           |
| `EXPO_ACCESS_TOKEN`           | Secret                      | Adi     | `send-push`                        | Needed if Expo push security is on                |
| `EVIDENCE_KEY_REF`            | Secret                      | Adi     | Report and case-view paths         | Reference to the evidence protection key (TRD-03) |
| `AGE_PASS_THRESHOLD`          | Secret store, not sensitive | Adi     | `verification-webhook`             | Default 21; live value in `app_config`            |
| `AGE_REVIEW_FLOOR`            | Secret store, not sensitive | Adi     | `verification-webhook`             | Default 18; live value in `app_config`            |

### Supabase dashboard settings (not variables)

Entered in each Supabase project's dashboard, never in the repository: the Twilio Verify account
SID, auth token and service SID (Auth phone provider); Resend SMTP details (Auth email); Google
and Apple sign-in client IDs and the Apple key; and the `pg_cron` scheduling key, kept in Vault.

### CI and build (GitHub and Expo)

| Variable                                                          | Public / Secret | Owner   | Where it lives                                      | What it is                                    |
| ----------------------------------------------------------------- | --------------- | ------- | --------------------------------------------------- | --------------------------------------------- |
| `EXPO_TOKEN`                                                      | Secret          | Adi     | GitHub Actions secrets                              | Lets CI start EAS builds and updates          |
| `SUPABASE_ACCESS_TOKEN`                                           | Secret          | Adi     | GitHub Actions environment secrets, per environment | Lets CI apply migrations and deploy functions |
| `SUPABASE_DB_PASSWORD`                                            | Secret          | Adi     | GitHub Actions environment secrets, per environment | Database password for migrations              |
| `SUPABASE_PROJECT_REF_STAGING`, `SUPABASE_PROJECT_REF_PRODUCTION` | Public          | Adi     | GitHub Actions variables                            | Which Supabase project to deploy to           |
| `SENTRY_AUTH_TOKEN`                                               | Secret          | Adi     | EAS secrets and GitHub secrets                      | Uploads readable crash traces                 |
| Apple and Google signing and upload credentials                   | Secret          | Parveen | EAS credentials store                               | Store signing keys                            |

Production secrets in GitHub sit in the `production` environment, which only `main` can deploy
from, so a pull request from a branch cannot read them.
