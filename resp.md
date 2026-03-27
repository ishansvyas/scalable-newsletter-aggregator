Here's what was created:

- **`/settings`** (`src/app/settings/page.tsx`) — loads the org's `org_configs` row, shows a form for source email, recipients, system prompt, and LLM model, saves on submit, and displays an amber warning that the GitHub Secret must also be updated manually.
- **`/digest/[id]`** (`src/app/digest/[id]/page.tsx`) — fetches `output_html` from `digest_runs` and renders it via `dangerouslySetInnerHTML`.
- Added a **Settings** nav link in the dashboard header.

---

**What you need to do outside the coding environment:**

1. **Supabase: enable Row Level Security (RLS) on `org_configs`** — the settings form reads and writes this table directly from the browser using the anon key. Without RLS policies, any logged-in user could read/overwrite any org's config. Add a policy that allows a user to select/update only the row whose `org_id` belongs to their organization.

2. **Supabase: add the `prose` styles if needed** — the digest page uses Tailwind's `prose` class to style the rendered HTML. If you want it to look good, install `@tailwindcss/typography`:
   ```
   npm install @tailwindcss/typography
   ```
   Then add the plugin to your Tailwind config.

3. **Vercel: deploy** (Phase 5) — push the dashboard to GitHub, connect it to Vercel, and set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in the Vercel environment variables dashboard.

4. **GitHub Secret reminder** — when you actually change settings via the UI, remember to also update the `ORGSLUG_CONFIG` secret in GitHub so the Actions workflow picks up the new values.