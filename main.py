import os
import json
import imaplib
import email
from email.header import decode_header
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
import re
from urllib.parse import urlparse
from bs4 import BeautifulSoup
import asyncio
import aiohttp
from openai import OpenAI
import requests
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import smtplib
import markdown as md_lib

# ---------------------------------------------------------------------------
# S0. Config (from ORG_CONFIG environment variable — set in GitHub Actions secrets)
# ---------------------------------------------------------------------------
config = json.loads(os.environ["ORG_CONFIG"])

USERNAME      = config["source_email"]
PASSWORD      = config["email_password"]
API_KEY       = config["llm_api_key"]
RECIPIENTS    = config["recipients"]
SYSTEM_PROMPT = config["system_prompt"]
ORG_ID        = config.get("org_id")

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")


def _log_run(status, output_html="", error_message=""):
    """Insert a row into digest_runs via Supabase REST API."""
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("Supabase not configured — skipping run log.")
        return
    try:
        resp = requests.post(
            f"{SUPABASE_URL}/rest/v1/digest_runs",
            headers={
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {SUPABASE_KEY}",
                "Content-Type": "application/json",
                "Prefer": "return=minimal",
            },
            json={
                "org_id": ORG_ID,
                "status": status,
                "output_html": output_html,
                "error_message": error_message,
            },
            timeout=10,
        )
        resp.raise_for_status()
        print(f"Supabase: logged run as '{status}'.")
    except Exception as e:
        print(f"Supabase: failed to log run — {e}")


# ---------------------------------------------------------------------------
# S1. Fetch and parse emails
# ---------------------------------------------------------------------------
def clean_text(text):
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    lines = [line.strip() for line in text.split("\n")]
    lines = [line for line in lines if line]
    return "\n".join(lines).strip()


_EXCLUDED_EXTENSIONS = {
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.ico',
    '.css', '.js', '.woff', '.woff2', '.ttf', '.eot', '.pdf',
    '.mp4', '.mp3', '.zip', '.xml', '.json',
}
_EXCLUDED_PATTERN = re.compile(
    r'(unsubscribe|tracking|pixel|open\.php|click\.php|mailchimp\.com/track'
    r'|/track/|r\.email|cdn\.|img\.|images\.|static\.|assets\.'
    r'|beacon|spacer|placeholder|linkto\.wral\.com)',
    re.IGNORECASE,
)

def is_article_url(url):
    try:
        parsed = urlparse(url)
        if not parsed.netloc:
            return False
        path = parsed.path.lower().split('?')[0]
        if any(path.endswith(ext) for ext in _EXCLUDED_EXTENSIONS):
            return False
        if _EXCLUDED_PATTERN.search(url):
            return False
        return True
    except Exception:
        return False


def run():
    mail = imaplib.IMAP4_SSL("imap.gmail.com")
    mail.login(USERNAME, PASSWORD)
    mail.select("inbox")

    cutoff = datetime.now(timezone.utc) - timedelta(hours=25)
    since_date = cutoff.strftime("%d-%b-%Y")
    status, messages = mail.search(None, f'(SINCE "{since_date}")')
    email_ids = messages[0].split()
    print(f"Found {len(email_ids)} emails since {since_date} (filtering to last 24h)\n")

    output_lines = []
    url_whitelist = set()
    wral_redirect_urls = set()
    url_pattern = re.compile(r'https?://[^\s\'"<>]+')

    for i, eid in enumerate(email_ids, 1):
        status, msg_data = mail.fetch(eid, "(RFC822)")

        for response_part in msg_data:
            if isinstance(response_part, tuple):
                msg = email.message_from_bytes(response_part[1])

                try:
                    email_date = parsedate_to_datetime(msg.get("Date"))
                    if email_date.tzinfo is None:
                        email_date = email_date.replace(tzinfo=timezone.utc)
                    if email_date < cutoff:
                        continue
                except Exception:
                    pass  # include email if date cannot be parsed

                subject, encoding = decode_header(msg["Subject"])[0]
                if isinstance(subject, bytes):
                    subject = subject.decode(encoding or "utf-8")

                header = (
                    f"---\n\n"
                    f"**Email {i}**\n\n"
                    f"**FROM:** {msg.get('From')}\n"
                    f"**SUBJECT:** {subject}\n"
                    f"**DATE:** {msg.get('Date')}\n\n"
                    f"**BODY:**\n"
                )
                output_lines.append(header)

                body_lines = []
                if msg.is_multipart():
                    for part in msg.walk():
                        content_type = part.get_content_type()
                        content_disposition = str(part.get("Content-Disposition"))

                        if "attachment" in content_disposition:
                            continue

                        body = part.get_payload(decode=True)
                        if not body:
                            continue

                        decoded = body.decode(errors="ignore")

                        if content_type == "text/plain":
                            cleaned = clean_text(decoded)
                            if cleaned:
                                body_lines.append(cleaned)
                                url_whitelist.update(
                                    u for u in url_pattern.findall(decoded)
                                    if is_article_url(u)
                                )

                        elif content_type == "text/html":
                            soup = BeautifulSoup(decoded, "html.parser")
                            for a in soup.find_all("a", href=True):
                                href = a["href"].strip()
                                if not href.startswith("http"):
                                    continue
                                if "linkto.wral.com" in href:
                                    wral_redirect_urls.add(href)
                                    continue
                                if is_article_url(href):
                                    url_whitelist.add(href)
                            url_whitelist.update(
                                u for u in url_pattern.findall(decoded)
                                if is_article_url(u)
                            )
                            text = soup.get_text(separator="\n")
                            cleaned = clean_text(text)
                            if cleaned:
                                body_lines.append(cleaned)

                else:
                    body = msg.get_payload(decode=True)
                    if body:
                        decoded = body.decode(errors="ignore")
                        cleaned = clean_text(decoded)
                        body_lines.append(cleaned)
                        url_whitelist.update(
                            u for u in url_pattern.findall(decoded)
                            if is_article_url(u)
                        )

                output_lines.append("\n".join(body_lines))
                output_lines.append("\n")

    output_lines.append("---")
    mail.logout()

    os.makedirs("emails", exist_ok=True)
    output_filename = os.path.join("emails", f"emails_{datetime.now().strftime('%Y-%m-%d')}.txt")
    with open(output_filename, "w", encoding="utf-8") as f:
        f.write("\n".join(output_lines))

    print(f"Emails saved to {output_filename}")
    print(f"After Method 1 (static filter): {len(url_whitelist)} URLs in whitelist")
    print(f"Found {len(wral_redirect_urls)} WRAL redirect URLs to resolve")

    # ---------------------------------------------------------------------------
    # S2. URL Filtering (async — run with asyncio.run)
    # ---------------------------------------------------------------------------
    _M2_TIMEOUT = aiohttp.ClientTimeout(total=8)
    _M2_HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; NewsletterValidator/2.0)"}

    async def _check_url(session, url):
        try:
            async with session.head(url, timeout=_M2_TIMEOUT, allow_redirects=True) as resp:
                ct = resp.headers.get("Content-Type", "")
                if resp.status < 400 and "text/html" in ct:
                    return url
        except Exception:
            pass
        return None

    async def filter_article_urls_async(urls):
        async with aiohttp.ClientSession(headers=_M2_HEADERS) as session:
            results = await asyncio.gather(*[_check_url(session, u) for u in urls])
        return {u for u in results if u is not None}

    async def _resolve_redirect(session, url):
        try:
            async with session.get(url, timeout=_M2_TIMEOUT, allow_redirects=True) as resp:
                final_url = str(resp.url)
                ct = resp.headers.get("Content-Type", "")
                if resp.status < 400 and "text/html" in ct and is_article_url(final_url):
                    return final_url
        except Exception:
            pass
        return None

    async def resolve_redirects_async(urls):
        async with aiohttp.ClientSession(headers=_M2_HEADERS) as session:
            results = await asyncio.gather(*[_resolve_redirect(session, u) for u in urls])
        return {u for u in results if u is not None}

    async def run_url_filtering():
        nonlocal url_whitelist
        before = len(url_whitelist)
        url_whitelist = await filter_article_urls_async(url_whitelist)
        print(f"After Method 2 (HEAD check): {len(url_whitelist)} URLs (removed {before - len(url_whitelist)} non-HTML/unreachable)")
        if wral_redirect_urls:
            resolved = await resolve_redirects_async(wral_redirect_urls)
            url_whitelist.update(resolved)
            print(f"Resolved {len(resolved)}/{len(wral_redirect_urls)} WRAL redirect URLs → added to whitelist")
        else:
            print("No WRAL redirect URLs to resolve")

    asyncio.run(run_url_filtering())

    # ---------------------------------------------------------------------------
    # S3/S4. AI Interface
    # ---------------------------------------------------------------------------
    client = OpenAI(
        base_url="https://litellm.oit.duke.edu/v1",
        api_key=API_KEY
    )

    newsletters_txt = "\n".join(output_lines)
    whitelist_txt = "\n".join(sorted(url_whitelist))

    response = client.chat.completions.create(
        model="GPT 4.1",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    "VALID SOURCE URLS (you may ONLY cite URLs from this list):\n\n"
                    + whitelist_txt
                    + "\n\n---\n\nNEWSLETTERS:\n\n"
                    + newsletters_txt
                )
            }
        ],
        temperature=0.2
    )

    # ---------------------------------------------------------------------------
    # S5. Validate markdown and send email
    # ---------------------------------------------------------------------------
    def validate_and_fix_markdown(text):
        issues = []

        fixed = re.sub(r'^(#{1,6})([^ #\n])', r'\1 \2', text, flags=re.MULTILINE)
        if fixed != text:
            issues.append("Fixed: missing space after # in headers")
            text = fixed

        fixed = re.sub(r'([^\n])\n(#{1,6} )', r'\1\n\n\2', text)
        if fixed != text:
            issues.append("Fixed: added blank line before headers")
            text = fixed

        fixed = re.sub(r'([^\n])\n([-*+] )', r'\1\n\n\2', text)
        if fixed != text:
            issues.append("Fixed: added blank line before list items")
            text = fixed

        if not issues:
            print("Markdown validation: OK (no issues found)")
        else:
            for msg in issues:
                print(f"Markdown validation: {msg}")

        return text

    md_text = validate_and_fix_markdown(response.choices[0].message.content)

    content_html = f"""
<div style="font-size:16px; line-height:1.45; color:#000000;">
  <style>
    h1, h2, h3 {{
      font-family: Arial, sans-serif;
      font-weight: 700;
      color: #000000;
      margin-top: 22px;
      margin-bottom: 8px;
      padding-top: 10px;
      border-top: 2px solid #b5b5b5;
    }}
    p {{
      margin: 6px 0 10px 0;
    }}
    ul {{
      margin: 6px 0 16px 18px;
      padding: 0;
    }}
    li {{
      margin-bottom: 10px;
    }}
    a {{
      color: #3b5ea7;
      font-weight: 700;
      text-decoration: underline;
    }}
  </style>
  {md_lib.markdown(md_text, extensions=["extra"])}
</div>
"""

    html_body = f"""
<html>
  <body style="
    margin:0;
    padding:24px 0;
    background:#dcdcdc;
    font-family: Georgia, 'Times New Roman', serif;
  ">
    <div style="
      max-width:760px;
      margin:0 auto;
      background:#ffffff;
      box-shadow:0 2px 8px rgba(0,0,0,0.08);
    ">

      <!-- Masthead -->
      <div style="
        background:#ffffff;
        text-align:center;
        padding:18px 20px 10px 20px;
      ">
        <div style="
          font-size:34px;
          font-weight:700;
          line-height:1.05;
          color:#000000;
        ">
          The 9th Street Journal
        </div>
        <div style="
          font-size:28px;
          font-weight:700;
          line-height:1.1;
          color:#000000;
        ">
          Newsletter Aggregator
        </div>
      </div>

      <!-- Date bar -->
      <div style="
        background:#000000;
        color:#ffffff;
        text-align:center;
        font-size:24px;
        font-weight:700;
        padding:6px 12px 8px 12px;
      ">
        {datetime.now().strftime('%A, %B %d, %Y')}
      </div>

      <!-- Body -->
      <div style="
        padding:20px 32px 24px 32px;
        background:#ffffff;
      ">
        {content_html}
      </div>

      <!-- Footer -->
      <div style="
        background:#ffffff;
        text-align:center;
        padding:14px 24px 22px 24px;
        color:#000000;
        font-size:12px;
        line-height:1.35;
        border-top:1px solid #d0d0d0;
      ">
        <div>This email is generated automatically by AI.</div>
        <div>For questions, comments, or concerns, please reach out to one of the project creators</div>
      </div>

    </div>
  </body>
</html>
"""

    plain_footer = (
        "\n\nThis email is generated automatically by AI.\n"
        "For questions, comments, or concerns, please reach out to one of the project creators"
    )

    recipients = RECIPIENTS

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"Ninth Street Newsletters Digest – {datetime.now().strftime('%B %d, %Y')}"
    msg["From"] = USERNAME
    msg["To"] = ", ".join(recipients)

    msg.attach(MIMEText(md_text + plain_footer, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as smtp:
        smtp.login(USERNAME, PASSWORD)
        smtp.send_message(msg, to_addrs=recipients)

    print("Email sent successfully!")
    _log_run("success", output_html=html_body)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
try:
    run()
except Exception as exc:
    _log_run("failed", error_message=str(exc))
    raise
