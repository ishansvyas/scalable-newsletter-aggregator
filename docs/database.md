# Supabase Backend — Full System Explanation

This document explains how the entire backend works end-to-end: from GitHub Actions triggering the pipeline, to secrets flowing into Python, to Supabase storing results, to how this architecture scales to new clients.

---

## Big Picture: What Supabase Does in This System

Supabase plays two roles:

1. **Persistent storage** — it stores the history of every digest run (date, status, the full HTML output, any error messages). This is what the future dashboard will read.
2. **Auth + database for the frontend** — when the Next.js dashboard is built, it will use Supabase Auth for login and Supabase's Postgres for reading org configs and digest history.

Supabase is *not* involved in triggering runs or delivering emails. That is entirely GitHub Actions' job. Supabase only receives a write at the very end of each run.

---

## The Three-Layer Stack

```
┌─────────────────────────────────────────────────────┐
│              Next.js Dashboard (Vercel)              │
│   Login · Digest history · Config editor            │
└──────────────────────┬──────────────────────────────┘
                       │ Supabase JS client (browser-direct)
┌──────────────────────▼──────────────────────────────┐
│                  Supabase (free tier)                │
│   Postgres: organizations, org_configs, digest_runs  │
│   Auth: email/password per org                       │
└──────────────────────┬──────────────────────────────┘
                       │ REST API write (end of each run)
┌──────────────────────▼──────────────────────────────┐
│              GitHub Actions (scheduler)              │
│   Matrix strategy: one parallel job per org          │
│   Reads config from GitHub Secrets → runs main.py   │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│                     main.py                          │
│   IMAP fetch → URL filter → AI summarize → email    │
│   Writes result row to Supabase at the end           │
└──────────────────────────────────────────────────────┘
```

No servers you manage. No Docker. No background workers. Three external services, all on free tiers.

---

## How GitHub Actions and Secrets Work Together

### The workflow file: `.github/workflows/daily.yml`

```yaml
name: Scalable Digest

on:
  schedule:
    - cron: '0 12 * * *'   # 8 AM ET every day
  workflow_dispatch:         # allows manual runs from the GitHub UI

jobs:
  run-digest:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        org: [NINTH_STREET]   # add more slugs here as you onboard clients
      fail-fast: false         # one org failing doesn't cancel the others

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      - run: pip install -r requirements.txt
      - name: Run digest
        env:
          ORG_CONFIG:    ${{ secrets[format('{0}_CONFIG', matrix.org)] }}
          SUPABASE_URL:  ${{ secrets.SUPABASE_URL }}
          SUPABASE_KEY:  ${{ secrets.SUPABASE_KEY }}
        run: python main.py
```

#### How the matrix works

The `matrix.org` list drives parallelism. For each entry in the list, GitHub spins up a **separate, isolated job** running on its own virtual machine. If you have three orgs `[NINTH_STREET, DAILY_TAR_HEEL, CHRONICLE]`, three VMs boot simultaneously at 8 AM, each running `main.py` with their own config.

#### How secrets flow in

The expression `secrets[format('{0}_CONFIG', matrix.org)]` is evaluated by GitHub Actions at runtime:
- When `matrix.org` is `NINTH_STREET`, it resolves to `secrets.NINTH_STREET_CONFIG`
- When `matrix.org` is `DAILY_TAR_HEEL`, it resolves to `secrets.DAILY_TAR_HEEL_CONFIG`

Each secret is a JSON string stored securely in GitHub (Settings → Secrets and variables → Actions). GitHub injects it as an environment variable named `ORG_CONFIG` into the job's VM. The value is **never printed in logs** — GitHub automatically redacts it.

`SUPABASE_URL` and `SUPABASE_KEY` are shared across all orgs (they're the same Supabase project), so they're stored once as regular secrets and passed through directly.

### What a GitHub Secret looks like

Each org's config secret is a single JSON blob. For 9th Street:

```json
{
  "source_email": "ninthstreetnewsletters@gmail.com",
  "email_password": "<Gmail App Password>",
  "recipients": ["editor@9thstreet.org", "staff@9thstreet.org"],
  "llm_api_key": "<LiteLLM or Gemini key>",
  "system_prompt": "You are an editorial assistant for the 9th Street Journal...",
  "org_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

`main.py` reads this at startup with `config = json.loads(os.environ["ORG_CONFIG"])`. Every value is org-specific and isolated — one org's credentials are never visible to another.

---

## How `main.py` Writes to Supabase

At the end of every run, `main.py` calls `_log_run()`:

```python
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")

def _log_run(status, output_html="", error_message=""):
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("Supabase not configured — skipping run log.")
        return
    requests.post(
        f"{SUPABASE_URL}/rest/v1/digest_runs",
        headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        },
        json={
            "org_id": ORG_ID,
            "status": status,          # "success" or "failed"
            "output_html": output_html, # the full rendered HTML digest
            "error_message": error_message,
        },
        timeout=10,
    )
```

The pipeline is wrapped in `try/except`:

```python
try:
    run()                             # entire pipeline
except Exception as exc:
    _log_run("failed", error_message=str(exc))
    raise                             # re-raise so GitHub marks the job as failed
```

On success, `_log_run("success", output_html=html_body)` is called at the end of `run()`.

The `SUPABASE_KEY` used here is the **service role key** — it bypasses Postgres row-level security and can write to any table. It is only ever used server-side (inside GitHub Actions), never exposed to the browser.

### The Supabase REST API

Supabase auto-generates a REST API from your Postgres schema using PostgREST. The URL pattern is:

```
POST https://<project-id>.supabase.co/rest/v1/<table-name>
```

No custom API server needed. The `requests.post()` call in `main.py` goes directly to this auto-generated endpoint. The two required headers are:
- `apikey` — identifies your project
- `Authorization: Bearer <key>` — authenticates the request (service role = full access)

---

## The Database Schema

Three tables in Supabase's Postgres:

### `organizations`
Stores one row per client organization.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key, auto-generated |
| `name` | text | Human-readable name ("9th Street Journal") |
| `slug` | text | URL-safe identifier ("ninth_street"), must be unique |
| `owner_email` | text | Contact for the org |
| `created_at` | timestamptz | Auto-set on insert |

### `org_configs`
Stores the operational config for each org. Currently a mirror of what's in the GitHub Secret — will be the source of truth once self-service config editing is built.

| Column | Type | Notes |
|---|---|---|
| `org_id` | uuid | Foreign key → `organizations.id` |
| `source_email` | text | Gmail address that receives newsletters |
| `recipients` | text[] | Postgres array of delivery addresses |
| `system_prompt` | text | AI editorial instructions |
| `schedule_cron` | text | For future per-org scheduling |
| `llm_model` | text | e.g. "GPT 4.1", "gemini-2.0-flash" |
| `active` | boolean | Set to false to pause without deleting |

### `digest_runs`
Append-only log of every pipeline execution.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `org_id` | uuid | Which org this run belongs to |
| `run_at` | timestamptz | Auto-set to now() on insert |
| `status` | text | Constrained to "success" or "failed" |
| `output_html` | text | Full HTML of the delivered digest |
| `error_message` | text | Populated only on failure |

Each successful run inserts one row here. The dashboard will `SELECT * FROM digest_runs WHERE org_id = $1 ORDER BY run_at DESC` to show history.

---

## How This Scales

### Current state (1 org)

One entry in the matrix list. One GitHub Secret. One row in `organizations`. One VM boots at 8 AM, runs the pipeline, writes a row to `digest_runs`, exits.

### Adding a second org (2–3 minutes of work)

1. Add a GitHub Secret named `DAILY_TAR_HEEL_CONFIG` with their JSON blob
2. Add `DAILY_TAR_HEEL` to the matrix list in `daily.yml` and commit
3. Insert a row into `organizations` and `org_configs` in Supabase
4. Give them dashboard credentials once the frontend exists

That's it. GitHub Actions spins up a second parallel VM automatically. No infrastructure changes.

### Scaling limits and when they matter

| Bottleneck | Limit | When it hits |
|---|---|---|
| GitHub Actions minutes | Unlimited on public repos; 2,000 min/month on private | ~13 orgs on a private repo. Fix: make the repo public (secrets are safe — they're not in the code). |
| Supabase storage | 500 MB free | Each digest run stores ~50–200 KB of HTML. 500 MB ≈ 2,500–10,000 stored runs. At 1 run/day/org, that's 7–27 years for a single org, or ~7–27 orgs at 1 year of history each. Prune old runs or upgrade ($25/month) when needed. |
| Supabase projects | 2 free projects | Not a concern — this system uses 1 project regardless of org count. |
| Manual onboarding | Human time | At ~3 min/org, the process stays manageable up to ~30 orgs. Beyond that, automate GitHub Secret creation via the GitHub API from a Next.js API route. |

### What "scaling" actually looks like operationally

Adding org #10 is identical to adding org #2. The matrix strategy means the workflow file is the only thing that changes — everything else (VM provisioning, Python environment, pipeline logic, Supabase write) is identical for every org. There is no shared state between org jobs.

---

## Sample Workflow: Onboarding a New Client

Let's say **The Daily Tar Heel** (DTH) wants to use the system.

### Step 1 — Collect their setup info

You need from them:
- A dedicated Gmail address (e.g. `dthnewsletters@gmail.com`)
- The Gmail App Password for that account (generated at myaccount.google.com → Security → App Passwords)
- A list of recipient email addresses for their digest
- Their desired system prompt (editorial tone, topics to prioritize, etc.)
- An LLM API key — if they're Duke-affiliated, give them the Duke LiteLLM key; otherwise direct them to [Google AI Studio](https://aistudio.google.com/apikey) for a free Gemini key (no credit card required)

### Step 2 — Set up their Gmail inbox

- Enable IMAP: Gmail Settings → See all settings → Forwarding and POP/IMAP → Enable IMAP
- Subscribe their Gmail address to the newsletters they want aggregated
- Confirm all subscription confirmation emails

### Step 3 — Add their GitHub Secret

Go to the repo → Settings → Secrets and variables → Actions → New repository secret.

Name: `DAILY_TAR_HEEL_CONFIG`

Value:
```json
{
  "source_email": "dthnewsletters@gmail.com",
  "email_password": "<their App Password>",
  "recipients": ["managing@dailytarheel.com", "digital@dailytarheel.com"],
  "llm_api_key": "<their API key>",
  "system_prompt": "You are an editorial assistant for The Daily Tar Heel, UNC's student newspaper. Prioritize local Chapel Hill and UNC news. Write in a journalistic tone...",
  "org_id": "<uuid from Step 5>"
}
```

(Leave `org_id` blank for now — fill it in after Step 5.)

### Step 4 — Add them to the workflow matrix

Edit `.github/workflows/daily.yml`:

```yaml
# Before
org: [NINTH_STREET]

# After
org: [NINTH_STREET, DAILY_TAR_HEEL]
```

Commit and push.

### Step 5 — Add them to Supabase

In the Supabase SQL editor:

```sql
-- Insert the org and capture the generated UUID
INSERT INTO organizations (name, slug, owner_email)
VALUES ('The Daily Tar Heel', 'daily_tar_heel', 'contact@dailytarheel.com')
RETURNING id;

-- Use the returned UUID in the next insert
INSERT INTO org_configs (org_id, source_email, recipients, system_prompt, llm_model, active)
VALUES (
  '<uuid from above>',
  'dthnewsletters@gmail.com',
  ARRAY['managing@dailytarheel.com', 'digital@dailytarheel.com'],
  'You are an editorial assistant for The Daily Tar Heel...',
  'GPT 4.1',
  true
);
```

Go back to GitHub and update `DAILY_TAR_HEEL_CONFIG` to include the `org_id` UUID.

### Step 6 — Verify

Trigger a manual run: GitHub repo → Actions → Scalable Digest → Run workflow.

You'll see two parallel jobs: `run-digest (NINTH_STREET)` and `run-digest (DAILY_TAR_HEEL)`. Both should complete green. In Supabase, `digest_runs` will have two new rows, one per org.

DTH starts receiving their digest the next morning at 8 AM ET automatically — no further action needed.

---

## Security Notes

- **Secrets never touch the codebase.** All credentials live in GitHub Secrets. The repo can be public without exposing any credentials.
- **The service role key is backend-only.** `SUPABASE_KEY` (service role) is only ever in GitHub Secrets and only used inside GitHub Actions VMs. The frontend will use the `anon` key, which is safe to expose publicly and is restricted by Postgres row-level security.
- **Org isolation.** Each org job runs in its own VM with its own `ORG_CONFIG`. There is no shared process, no shared memory, and no way for one org's run to see another's credentials.
- **Gmail App Passwords.** These are scoped — they only grant IMAP/SMTP access to that specific Gmail account, not full Google account access. They can be revoked per-account without affecting others.
