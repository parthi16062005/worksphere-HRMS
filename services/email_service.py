
import logging
import os
import smtplib

from dotenv import load_dotenv
from email.message import EmailMessage
from typing import Optional

load_dotenv()

logger = logging.getLogger(__name__)


# =========================================================
# EMAIL CONFIGURATION
# =========================================================

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))

SMTP_USERNAME = os.getenv("SMTP_USERNAME", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")

EMAIL_FROM = os.getenv(
    "EMAIL_FROM",
    SMTP_USERNAME,
)

SMTP_TIMEOUT = 15


# =========================================================
# EMAIL CONFIGURATION STATUS
# =========================================================

def is_email_configured() -> bool:
    """
    Return True when the required SMTP credentials are available.
    """

    return bool(
        SMTP_HOST
        and SMTP_PORT
        and SMTP_USERNAME
        and SMTP_PASSWORD
        and EMAIL_FROM
    )


# =========================================================
# SEND EMAIL
# =========================================================

def send_email(
    recipient: str,
    subject: str,
    body: str,
    html_body: Optional[str] = None,
) -> bool:
    """
    Send a plain-text email with an optional HTML alternative.

    Returns:
        True: Email accepted by the SMTP server.
        False: Email could not be sent.

    The caller can continue its main operation if email fails.
    """

    recipient = (recipient or "").strip()
    subject = (subject or "").strip()
    body = (body or "").strip()

    if not recipient:
        logger.warning("Email not sent: recipient address is empty.")
        return False

    if not subject or not body:
        logger.warning(
            "Email not sent: subject and plain-text body are required."
        )
        return False

    if not is_email_configured():
        logger.info(
            "Email skipped because SMTP credentials are not configured."
        )
        return False

    message = EmailMessage()
    message["From"] = EMAIL_FROM
    message["To"] = recipient
    message["Subject"] = subject

    message.set_content(body)

    if html_body:
        message.add_alternative(html_body, subtype="html")

    try:
        with smtplib.SMTP(
            SMTP_HOST,
            SMTP_PORT,
            timeout=SMTP_TIMEOUT,
        ) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()

            server.login(
                SMTP_USERNAME,
                SMTP_PASSWORD,
            )

            server.send_message(message)

        logger.info("Email sent successfully to %s.", recipient)
        return True

    except (smtplib.SMTPException, OSError) as exc:
        # Do not log credentials or message contents.
        logger.warning(
            "Email delivery failed for %s: %s",
            recipient,
            type(exc).__name__,
        )
        return False


# =========================================================
# WORKSPHERE EMAIL TEMPLATES
# =========================================================

def send_work_notification(
    recipient: str,
    recipient_name: str,
    title: str,
    message: str,
) -> bool:
    """
    Send a standard WorkSphere notification email.
    """

    recipient_name = (recipient_name or "Employee").strip()
    title = (title or "WorkSphere Notification").strip()
    message = (message or "").strip()

    subject = f"WorkSphere: {title}"

    body = (
        f"Hello {recipient_name},\n\n"
        f"{message}\n\n"
        "Please log in to WorkSphere to view further details.\n\n"
        "Regards,\n"
        "WorkSphere HR Management System"
    )

    html_body = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin:0;padding:24px;background:#f1f5f9;font-family:Arial,sans-serif;">
        <div style="max-width:600px;margin:auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
            <div style="padding:22px;background:#334155;color:#ffffff;">
                <h2 style="margin:0;">WorkSphere</h2>
                <p style="margin:8px 0 0;color:#e2e8f0;">HR Management System</p>
            </div>
            <div style="padding:28px;color:#334155;line-height:1.7;">
                <p>Hello {recipient_name},</p>
                <h3 style="color:#0f172a;">{title}</h3>
                <p>{message}</p>
                <p>Please log in to WorkSphere to view further details.</p>
            </div>
            <div style="padding:16px 28px;background:#f8fafc;color:#64748b;font-size:12px;">
                This is an automated notification from WorkSphere.
            </div>
        </div>
    </body>
    </html>
    """

    return send_email(
        recipient=recipient,
        subject=subject,
        body=body,
        html_body=html_body,
    )
