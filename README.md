# Newsletter Aggregator

Every morning at **8 AM ET**, this tool automatically:
1. Reads newsletter emails received by `ninthstreetnewsletters@gmail.com`
2. Uses AI (GPT-4.1) to identify and summarize the top stories of the day
3. Emails the digest to a list of recipients

The digest is intended to support [The 9th Street Journal](https://www.9thstreetjournal.org/), a student publication covering Durham and the broader NC area.

---

## Day-to-day: what you need to know

**The tool runs itself.** You don't need to do anything for the daily digest to go out.

To **run it manually** (e.g., if you want to trigger it outside of 8 AM):
1. Go to the repository on GitHub
2. Click the **Actions** tab
3. Click **Daily Newsletter Digest** in the left sidebar
4. Click **Run workflow** → **Run workflow**

To **check if a run succeeded or failed**:
- Go to the **Actions** tab on GitHub. Each run shows a green checkmark (success) or red X (failure).
- Click on a run to see details and error messages.

---

## Managing recipients

The list of people who receive the digest is set in the `RECIPIENTS` variable near the top of `main.py` (around line 25). To add or remove someone:

1. Open `main.py` in GitHub (click the file, then the pencil/edit icon)
2. Find the `RECIPIENTS` list — it looks like:
   ```python
   RECIPIENTS = [
       "someone@example.com",
       "another@example.com",
   ]
   ```
3. Add or remove email addresses. Lines starting with `#` are commented out (ignored).
4. Click **Commit changes** to save.

---

## Credentials and secrets

The tool needs two passwords to run. These are stored securely in GitHub as **repository secrets** — never in the code itself.

| Secret name | What it is |
|---|---|
| `API_KEY` | API key for Duke's OpenAI service (LiteLLM) |
| `EMAIL_PASSWORD` | Gmail app password for `ninthstreetnewsletters@gmail.com` |

To view or update secrets: **GitHub repo → Settings → Secrets and variables → Actions**

> **Note:** If either credential expires or is rotated, the daily run will fail. Check the Actions tab for errors.

---

## Gmail account

- **Address:** `ninthstreetnewsletters@gmail.com`
- **Purpose:** Receives subscribed newsletters (the inputs) and sends the daily digest (the output)
- The password stored in GitHub is a **Gmail App Password**, not the account's regular login password. App passwords can be managed at: Google Account → Security → 2-Step Verification → App passwords

---

## Setup (for new maintainers starting from scratch)

1. Make sure you have access to the GitHub repository
2. Ensure the two secrets above are set under repository Settings
3. Confirm the Gmail account is subscribed to the newsletters you want aggregated
4. The workflow will run automatically — no installation or local setup needed

If you want to run the script locally on your own computer, you'll need Python installed. Ask a technical teammate or see the original authors below.

---

## Everything you need to do outside the code

This section documents every manual, external step required to get this system running from scratch. None of these are handled by the code itself.

### 1. Create a Gmail account

- Create a dedicated Gmail account to use as the newsletter inbox and outbox (e.g., `yournewsletters@gmail.com`).
- Use a dedicated account rather than a personal one — it will receive a high volume of newsletter emails.
- Update the `USERNAME` variable in `main.py` to match the new address.

### 2. Enable IMAP in Gmail

The script reads incoming emails via IMAP. Gmail disables this by default.

1. Log in to the Gmail account
2. Go to **Settings** (gear icon) → **See all settings**
3. Click the **Forwarding and POP/IMAP** tab
4. Under "IMAP access", select **Enable IMAP**
5. Click **Save Changes**

### 3. Create a Gmail App Password

Gmail requires an App Password (not your regular password) for scripts that connect via IMAP/SMTP. This requires 2-Step Verification to be enabled first.

1. Log in to the Gmail account
2. Go to **Google Account → Security**
3. Enable **2-Step Verification** if not already on
4. Return to Security and find **App passwords** (under 2-Step Verification)
5. Create a new App Password — name it something like "Newsletter Script"
6. Copy the 16-character password — you'll add it as a GitHub secret (see below)

### 4. Subscribe to newsletters

The script only processes emails already in the inbox. You need to manually subscribe the Gmail account to every newsletter you want included in the digest.

- Go to each newsletter's website and subscribe using the Gmail address you created
- Confirm any subscription confirmation emails
- Wait for at least one email to arrive before expecting it to appear in the digest

### 5. Get an API key

The script uses Duke's LiteLLM proxy (`litellm.oit.duke.edu`) to access GPT-4.1. To use this:

- Request API access through Duke OIT or your department's contact for the LiteLLM service
- You'll receive an API key string

If you're adapting this for a different use case (outside Duke), you can swap in a direct OpenAI API key from [platform.openai.com](https://platform.openai.com) and update the `base_url` in `main.py` accordingly.

### 6. Fork or create the GitHub repository

- Create a GitHub repository (or fork this one) to host the code
- The GitHub Actions workflow (`.github/workflows/daily.yml`) handles scheduling and running the script — no server required

### 7. Add secrets to GitHub

The API key and Gmail App Password must be stored as GitHub repository secrets — never hardcoded in the source.

1. Go to your GitHub repository
2. Click **Settings → Secrets and variables → Actions**
3. Click **New repository secret** for each of the following:

| Secret name | Value |
|---|---|
| `API_KEY` | The LiteLLM (or OpenAI) API key from step 5 |
| `EMAIL_PASSWORD` | The Gmail App Password from step 3 |

### 8. Update hardcoded values in the code

Before the first run, update these values in `main.py` to match your setup:

- `USERNAME` (~line 24): the Gmail address you created
- `RECIPIENTS` (~line 25): the list of email addresses that should receive the digest

---

## Authors

Lucy Glynn, Mekhi Patterson, Ishan Vyas
