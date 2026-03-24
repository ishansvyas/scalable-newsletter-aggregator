

## Intermediate Architecture Briefing: Week-Scale Multi-Tenancy

### Core Principle

**Don't replace what works.** GitHub Actions already handles scheduling for free. `main.py` already handles the pipeline. The goal is to make both of those config-driven and add a minimal UI on top — not rebuild the stack.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│              Next.js Dashboard (Vercel)              │
│   Org onboarding · Config editor · Digest history   │
└──────────────────────┬──────────────────────────────┘
                       │ Supabase JS client (direct)
┌──────────────────────▼──────────────────────────────┐
│                  Supabase (free tier)                 │
│   Postgres: orgs, configs, digest_runs               │
│   Auth: email/password login                         │
└──────────────────────┬──────────────────────────────┘
                       │ REST API (read config at runtime)
┌──────────────────────▼──────────────────────────────┐
│         GitHub Actions  (unchanged scheduler)        │
│   One workflow file per org  ─OR─  matrix strategy  │
│   Reads org config from Supabase · runs pipeline    │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│   main.py  (minimal refactor: accept config object) │
│   All existing pipeline logic unchanged              │
└──────────────────────────────────────────────────────┘
```

No new servers. No Docker. No Celery. No Redis. Three services total: Supabase (free), Vercel (free), GitHub Actions (already running).

---

## 1. Backend Changes — `main.py` Refactor

The only code change: extract the hardcoded values into a config object loaded from an env var.

```python
# Before (hardcoded)
USERNAME = "ninthstreetnewsletters@gmail.com"
RECIPIENTS = ["ishansvyas4@gmail.com", ...]

# After (config-driven)
import json
config = json.loads(os.environ["ORG_CONFIG"])
USERNAME   = config["source_email"]
RECIPIENTS = config["recipients"]
API_KEY    = config["llm_api_key"]      # or still from GitHub Secret
SYSTEM_PROMPT = config["system_prompt"] # org-specific editorial context
```

That's it. The pipeline itself — IMAP fetch, URL filtering, async validation, AI summarization, email delivery — doesn't change at all.

---

## 2. Scheduling — GitHub Actions Matrix

Replace the single hardcoded workflow with a **matrix workflow** that reads all active org configs from Supabase and runs one job per org:

```yaml
# .github/workflows/daily.yml
jobs:
  run-digest:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        org: [ninth-street, daily-tar-heel, chronicle]  # add a line per org
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.11' }
      - run: pip install -r requirements.txt
      - name: Run digest
        env:
          ORG_CONFIG: ${{ secrets[format('{0}_CONFIG', matrix.org)] }}
          # e.g. NINTH_STREET_CONFIG = JSON blob stored in GitHub Secrets
        run: python main.py
```

Each org's full config (email, recipients, system prompt, API key) is stored as a single JSON GitHub Secret per org. Adding a new organization = add one secret + one line to the matrix. No new infrastructure.

---

## 3. Database — Supabase (Free Tier)

Three tables, very simple:

| Table | Fields |
|---|---|
| `organizations` | id, name, slug, owner_email, created_at |
| `org_configs` | org_id, source_email, recipients[], system_prompt, schedule_cron, llm_model, active |
| `digest_runs` | org_id, run_at, status (`success`/`failed`), output_html, error_message |

Supabase free tier handles 500MB storage and 50,000 monthly active users — vastly more than dozens of orgs. You get Postgres, auth, and a REST API instantly, no setup.

At the end of each `main.py` run, write a row to `digest_runs` via Supabase's REST API (a single `requests.post()` call — 5 lines of code).

---

## 4. Frontend — Next.js on Vercel

A minimal dashboard with just four pages:

**`/login`** — Supabase Auth email/password login

**`/dashboard`** — List of the org's past digest runs (table: date, status, view link)

**`/settings`** — Config form: recipients, system prompt, source email. On save → updates `org_configs` in Supabase. User then manually updates the GitHub Secret (acceptable friction at this scale).

**`/digest/[id]`** — Renders the saved `output_html` from a past digest run in-browser

This is roughly **4 pages, ~300 lines of React total**. No complex state management. Supabase's JS client handles auth and all DB reads/writes directly from the browser — no separate API server needed.

---

## 5. Onboarding a New Organization

The manual steps to add a new org (acceptable at dozens-scale):

1. They fill out a form on `/onboard` (or you manually fill it): source email, recipients, system prompt, API key
2. You add a GitHub Secret named `ORGSLUG_CONFIG` containing their JSON config
3. You add their slug to the matrix in `daily.yml`
4. Done — they start receiving digests the next morning

If you want to automate step 2-3, you can use the GitHub API to create secrets and update the workflow file programmatically from a Next.js API route. But for dozens of orgs, doing it manually takes 3 minutes per org.

---

## 6. What You Actually Build This Week

| Task | Effort |
|---|---|
| Refactor `main.py` to read from `ORG_CONFIG` env var | ~1 hour |
| Update `daily.yml` to use matrix strategy | ~30 min |
| Add Supabase `digest_runs` write at end of pipeline | ~30 min |
| Set up Supabase project + tables | ~1 hour |
| Build Next.js app (login, dashboard, settings, digest view) | ~2–3 days |
| Deploy to Vercel + connect Supabase | ~1 hour |
| Test with 2–3 orgs end-to-end | ~1 day |

Realistic total: **4–5 days** for one developer.

---

## What This Doesn't Handle (Knowingly)

- **Self-service secret management** — users can't update their own credentials without you touching GitHub Secrets. Acceptable for dozens; fix it when you hit the friction point.
- **Per-org scheduling** — matrix runs all orgs at the same time. If an org needs a different delivery time, that's a second workflow file.
- **Gmail OAuth** — users still need to generate an app password. Acceptable friction for now.
- **Billing** — no monetization layer. Add Stripe later if needed.

This architecture can realistically support **20–30 organizations** before the manual onboarding process becomes the bottleneck — at which point you automate the GitHub Secrets step, and you're good for another 50+.