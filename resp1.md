The implementation is clean. Here's a summary of what changed and what you need to do outside the coding environment:

**What changed in `main.py`:**
- Added `import json`
- Replaced the 5 hardcoded constants (`API_KEY`, `PASSWORD`, `USERNAME`, `RECIPIENTS`, and the multi-section `SYSTEM_PROMPT`) with a single `config = json.loads(os.environ["ORG_CONFIG"])` call
- All pipeline logic (IMAP, URL filtering, AI, email sending) is untouched

---

## Actions required outside the coding environment

**1. Create the `NINTH_STREET_CONFIG` GitHub Secret**

Go to your repo → Settings → Secrets and variables → Actions → New repository secret.

Name: `NINTH_STREET_CONFIG`

Value (fill in your actual values):
```json
{
  "source_email": "ninthstreetnewsletters@gmail.com",
  "email_password": "<your Gmail App Password>",
  "llm_api_key": "<your Duke LiteLLM key>",
  "recipients": [
    "ishansvyas4@gmail.com",
    "lucybglynn@gmail.com",
    "mekhipatterson2023@gmail.com"
  ],
  "system_prompt": "CONTEXT: The 9th Street Journal is a publication that focuses on covering local Durham news and events...\nROLE: You are an assistant to Alison Jones...\nACTION: 1. Filter to determine the top stories...\nFORMAT: Respond with top stories, divided into sections..."
}
```
(Copy the full system prompt text from the old `main.py` or your git history — commit `8850790` has it.)

**2. Update `.github/workflows/daily.yml`** *(prep for step 2.1, but needed now)*

Change the step that sets env vars from using `API_KEY` + `EMAIL_PASSWORD` to using `ORG_CONFIG`:
```yaml
env:
  ORG_CONFIG: ${{ secrets.NINTH_STREET_CONFIG }}
```

**3. Delete the old `API_KEY` and `EMAIL_PASSWORD` secrets** (once you've confirmed the new workflow runs successfully — keep them during testing for rollback safety)

**4. Make the repo public** (Settings → General → Danger Zone → Change visibility) to remove the 2,000 min/month Actions cap, as noted in `todo.md`