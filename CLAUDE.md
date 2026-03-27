# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A multi-tenant newsletter aggregator that fetches newsletters via IMAP, summarizes them using GPT-4.1 (via Duke's LiteLLM proxy or Gemini), and emails styled digests to subscriber lists. Runs daily at 8 AM ET via GitHub Actions with one parallel job per organization.

Currently deployed for **The 9th Street Journal** (Durham, NC student publication), architected to scale to 20-30+ organizations.

## Commands

### Python backend
```bash
pip install -r requirements.txt

# Run locally (requires ORG_CONFIG env var with JSON config)
export ORG_CONFIG='{"source_email":"...","email_password":"...","recipients":[...],"llm_api_key":"...","system_prompt":"...","org_id":"..."}'
python main.py
```

### Next.js dashboard
```bash
cd dashboard
npm install
npm run dev      # dev server at localhost:3000
npm run build    # production build
```

## Architecture

### Data flow
```
GitHub Actions (8 AM ET, matrix per org)
        ↓
main.py pipeline:
  1. IMAP fetch from Gmail (last 25 hours)
  2. Async URL filtering (regex + HEAD requests)
  3. GPT-4.1 summarization → markdown
  4. HTML email delivery via SMTP
  5. Log result to Supabase (digest_runs table)
        ↓
Next.js Dashboard (Vercel) reads Supabase to display run history
```

### Configuration model
Each org's full config is a single GitHub Secret named `{ORG_SLUG}_CONFIG` (JSON). The matrix workflow injects it as `ORG_CONFIG` env var. No per-org code changes needed — adding an org is: create secret + add slug to `matrix.org` in `.github/workflows/daily.yml` + insert Supabase rows.

### Supabase schema (3 tables)
- `organizations` — org identity (`id`, `name`, `slug`, `owner_email`)
- `org_configs` — per-org pipeline settings (`source_email`, `recipients[]`, `system_prompt`, `llm_model`, `active`)
- `digest_runs` — run history (`org_id`, `run_at`, `status`, `output_html`, `error_message`)

### Dashboard (dashboard/)
Next.js 15 app with Supabase Auth. Built pages: `/login`, `/dashboard`. Pending: `/digest/[id]`, `/settings`, `/onboard`. Uses `dashboard/src/lib/supabase.ts` for the client. Dashboard uses the anon key (public); backend writes use the service role key (GitHub Secrets only).

## Key files
- `main.py` — entire Python pipeline in one file
- `.github/workflows/daily.yml` — schedule, matrix org list, secret injection
- `docs/database.md` — Supabase schema details and onboarding steps
- `architecture.md` — multi-tenant design rationale
- `todo.md` — phase-by-phase roadmap (Phases 4-6 still pending)

## Adding a new organization
1. Create `{ORG_SLUG}_CONFIG` GitHub Secret with JSON config
2. Add org slug to `matrix.org` in `.github/workflows/daily.yml`
3. Insert rows into `organizations` and `org_configs` in Supabase
4. Trigger manual run from GitHub Actions to verify

## Services used
- **GitHub Actions** — scheduler and pipeline runner (free, public repo)
- **Supabase** — Postgres + Auth (free tier)
- **Vercel** — dashboard hosting (free hobby tier)
- **LLM** — Duke LiteLLM proxy (Duke-affiliated) or Google Gemini (free tier)
- **Email** — Gmail IMAP/SMTP with App Passwords
