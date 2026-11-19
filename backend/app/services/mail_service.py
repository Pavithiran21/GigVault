from html import escape
from pathlib import Path

from app.core.mailer import InlineImage, send_email

# The logo tile, the same mark as the app's (frontend Logo.jsx), as a PNG: email clients don't
# show SVG. It travels inside the email, so it shows without an image server.
_LOGO = InlineImage(
    cid="gigvault-logo",
    file_name="gigvault-logo.png",
    data=(Path(__file__).resolve().parents[1] / "assets" / "email-logo.png").read_bytes(),
)

# Brand colours from UI-UX.md (teal 900 hero, teal 700 button, ink text).
_TEMPLATE = """\
<!doctype html>
<html lang="en">
<body style="margin:0;padding:0;background:#f6fbfb;font-family:'IBM Plex Sans',Segoe UI,Arial,sans-serif;color:#263b3b;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6fbfb;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;border:1px solid #d7ebe9;overflow:hidden;">
        <tr><td style="background:#083b37;padding:18px 28px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="padding-right:10px;vertical-align:middle;"><img src="cid:gigvault-logo" width="36" height="36" alt="" style="display:block;border:0;"></td>
            <td style="vertical-align:middle;"><span style="font-family:Sora,Segoe UI,Arial,sans-serif;font-size:20px;font-weight:700;color:#ffffff;">Gig</span><span style="font-family:Sora,Segoe UI,Arial,sans-serif;font-size:20px;font-weight:700;color:#99f6e4;">Vault</span></td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:28px;">
          {body}
        </td></tr>
        <tr><td style="padding:16px 28px;border-top:1px solid #e6f2f1;font-size:12px;color:#5f7474;">
          GigVault · Every gig. Every rupee. Accounted for.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
"""


async def send_password_reset_email(user: dict, reset_link: str) -> None:
    name = escape(user["name"])
    link = escape(reset_link, quote=True)
    body = f"""\
<h1 style="margin:0 0 12px;font-family:Sora,Segoe UI,Arial,sans-serif;font-size:22px;color:#0b2b2b;">Set a new password</h1>
<p style="margin:0 0 16px;line-height:1.55;">Hi {name}, we got a request to reset the password of your GigVault account.</p>
<p style="margin:0 0 24px;"><a href="{link}" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:10px;">Reset password</a></p>
<p style="margin:0 0 8px;line-height:1.55;font-size:14px;color:#5f7474;">The link works once and expires in 30 minutes. If you didn't ask for it, ignore this email: your password stays the same.</p>
<p style="margin:0;font-size:12px;color:#5f7474;word-break:break-all;">{link}</p>"""

    text = (
        f"Hi {user['name']},\n\n"
        "We got a request to reset the password of your GigVault account.\n"
        f"Set a new password here: {reset_link}\n\n"
        "The link works once and expires in 30 minutes. If you didn't ask for it, ignore this email.\n"
    )
    await send_email(user["email"], "Reset your GigVault password", text, _TEMPLATE.format(body=body), images=[_LOGO])
