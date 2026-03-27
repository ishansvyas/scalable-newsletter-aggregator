# Newsletter Aggregator — Expansion TODO

This file tracks every step needed to go from the current single-org setup to a multi-tenant system per `architecture.md`.

---

## Free Tier Constraints — Read First

| Service | Free tier | Limit that matters |
|---|---|---|
| **GitHub Actions** | Unlimited minutes on **public** repos; 2,000 min/month on private | At ~5 min/run × 30 days = 150 min/org/month → **~13 orgs before hitting private-repo limit**. Fix: make the repo public. |
| **Supabase** | 500 MB storage, 2 projects, pauses after **7 days of inactivity** | The daily Actions run writes to `digest_runs`, so the project stays active automatically once wired up. No action needed. |
| **Vercel** | Hobby tier: 100 GB bandwidth/month, unlimited deploys | More than enough for a low-traffic dashboard. |
| **Gmail** | Free | No limit concerns at this scale. |
| **LLM API** | Duke's LiteLLM (`litellm.oit.duke.edu`) is free for Duke users | **New orgs outside Duke need their own key.** Free options: Google Gemini (`generativelanguage.googleapis.com`) has a generous free tier with no credit card required. Groq also has a free tier. Both support OpenAI-compatible clients — just swap `base_url` and `model` in the config. |

### Action required before scaling
- [x] **Make the GitHub repo public** (Settings → General → Danger Zone → Change visibility) to eliminate the 2,000 min/month Actions cap. The repo contains no secrets (those are in GitHub Secrets), so this is safe.

---

## Phase 1: Backend Refactor (code changes)

### 1.1 Refactor `main.py` to be config-driven
- [x] Replace hardcoded `USERNAME`, `RECIPIENTS`, and related constants with values read from a `ORG_CONFIG` environment variable
- [x] Parse `ORG_CONFIG` as JSON at the top of the script: `config = json.loads(os.environ["ORG_CONFIG"])`
- [x] Map fields: `source_email`, `recipients`, `llm_api_key`, `system_prompt`
- [x] Keep all pipeline logic (IMAP fetch, URL filtering, AI summarization, email delivery) unchanged
- [x] Test locally by setting `ORG_CONFIG` to a JSON string before running

### 1.2 Write digest run result to Supabase
- [x] At the end of `main.py`, add a `requests.post()` call to Supabase's REST API to insert a row into `digest_runs`
- [x] Include fields: `org_id`, `run_at` (timestamp), `status` (`success` or `failed`), `output_html`, `error_message`
- [x] Read the Supabase URL and service key from environment variables (add `SUPABASE_URL` and `SUPABASE_KEY` to GitHub Secrets later)

---

## Phase 2: GitHub Actions — Matrix Workflow

### 2.1 Update `.github/workflows/daily.yml`
- [x] Replace the single-org job with a matrix strategy
- [x] Add a `matrix.org` list (e.g., `[ninth-street, daily-tar-heel]`)
- [x] Set `ORG_CONFIG` per job using `${{ secrets[format('{0}_CONFIG', matrix.org)] }}`
- [x] Also pass `SUPABASE_URL` and `SUPABASE_KEY` as env vars

### 2.2 Migrate the existing org's config to a GitHub Secret
- [x] Create a JSON object with all current hardcoded values:
  ```json
  {
    "source_email": "ninthstreetnewsletters@gmail.com",
    "recipients": ["..."],
    "llm_api_key": "...",
    "system_prompt": "..."
  }
  ```
- [x] Add this as a GitHub Secret named `NINTH_STREET_CONFIG`
- [x] Remove the old `API_KEY` and `EMAIL_PASSWORD` secrets once migrated (or keep for backward compat during testing)

---

## Phase 3: Supabase Setup

### 3.1 Create a Supabase project
- [x] Go to [supabase.com](https://supabase.com) and create a free project
- [x] Save the **Project URL** and **service role API key** (Settings → API)

### 3.2 Create database tables
Run these in the Supabase SQL editor:

```sql
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  owner_email text,
  created_at timestamptz default now()
);

create table org_configs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id),
  source_email text,
  recipients text[],
  system_prompt text,
  schedule_cron text,
  llm_model text,
  active boolean default true
);

create table digest_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id),
  run_at timestamptz default now(),
  status text check (status in ('success', 'failed')),
  output_html text,
  error_message text
);
```

- [x] Create the `organizations` table
- [x] Create the `org_configs` table
- [x] Create the `digest_runs` table
- [x] Insert a row for the existing 9th Street org into `organizations`
- [x] Add `SUPABASE_URL` and `SUPABASE_KEY` as GitHub Secrets

---

## Phase 4: Next.js Frontend

### 4.1 Scaffold the app
- [x] Run `npx create-next-app@latest dashboard` (choose App Router, TypeScript)
- [x] Install Supabase client: `npm install @supabase/supabase-js`
- [x] Create a `lib/supabase.ts` client using `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 4.2 Build `/login`
- [x] Email/password login form using Supabase Auth (`supabase.auth.signInWithPassword`)
- [x] Redirect to `/dashboard` on success

### 4.3 Build `/dashboard`
- [x] Fetch and display past `digest_runs` for the logged-in org (date, status, link to view)
- [x] Show a green/red indicator per run
- [x] Link each row to `/digest/[id]`

### 4.4 Build `/settings`
- [x] Form fields: source email, recipients (comma-separated), system prompt, LLM model
- [x] On save → update `org_configs` row in Supabase
- [x] Display a note reminding the user to also update their GitHub Secret manually

### 4.5 Build `/digest/[id]`
- [x] Fetch the `output_html` field from `digest_runs` for the given id
- [x] Render it using `dangerouslySetInnerHTML` (it's your own stored HTML)

### 4.6 (Optional) Build `/onboard`
- [ ] Form for new org setup: name, slug, source email, recipients, system prompt, API key
- [ ] On submit → insert into `organizations` + `org_configs`
- [ ] Display the JSON blob they need to add as a GitHub Secret, and the line to add to `daily.yml`

---

## Phase 5: Deploy

### 5.1 Deploy frontend to Vercel
- [ ] Push the Next.js app to a GitHub repo (can be a subdirectory or separate repo)
- [ ] Connect repo to [vercel.com](https://vercel.com)
- [ ] Add environment variables in Vercel dashboard:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 5.2 Verify end-to-end
- [ ] Trigger a manual GitHub Actions run
- [ ] Confirm a row appears in `digest_runs` in Supabase
- [ ] Log in to the dashboard and confirm the run appears
- [ ] Click through to the digest view and confirm HTML renders

---

## Phase 6: Onboarding a New Org (manual process, per org)

For each new organization added to the system:

- [ ] Collect from them: dedicated Gmail address, Gmail App Password, list of recipient emails, desired system prompt, and an LLM API key
  - If they're Duke-affiliated: give them the Duke LiteLLM key (free)
  - Otherwise: direct them to [Google AI Studio](https://aistudio.google.com/apikey) for a free Gemini API key (no credit card). Set `base_url` to `https://generativelanguage.googleapis.com/v1beta/openai/` and `model` to `gemini-2.0-flash` in their config.
- [ ] Enable IMAP on their Gmail account (Settings → Forwarding and POP/IMAP → Enable IMAP)
- [ ] Subscribe the Gmail account to their desired newsletters and confirm subscriptions
- [ ] Add a GitHub Secret named `ORGSLUG_CONFIG` with their JSON config blob
- [ ] Add their slug to the `matrix.org` list in `daily.yml` and commit
- [ ] Insert rows into `organizations` and `org_configs` in Supabase
- [ ] Give them login credentials for the dashboard

---

## Known Limitations (deferred)

- **Per-org schedule** — all orgs run at the same time. A different delivery time requires a second workflow file.
- **Self-service secret management** — users can't rotate credentials without you touching GitHub Secrets. Fix when it becomes friction.
- **Gmail OAuth** — still requires an App Password, not full OAuth. Acceptable for now.
- **Billing/monetization** — no Stripe layer. Add later if needed.
