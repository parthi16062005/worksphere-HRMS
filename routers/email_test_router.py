
import logging
import re

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from auth import get_current_user, require_roles
from database import get_db
from models import User
from services.email_service import (
    is_email_configured,
    send_work_notification,
)


router = APIRouter(
    prefix="/email",
    tags=["Email Integration"],
)

logger = logging.getLogger(__name__)


class EmailTestRequest(BaseModel):
    recipient: str = Field(
        ...,
        min_length=5,
        max_length=254,
        description="Email address to receive the test message",
    )


def validate_email_address(address: str) -> bool:
    return bool(
        re.fullmatch(
            r"[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+"
            r"@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+",
            address.strip(),
        )
    )


@router.post("/test")
def test_email_integration(
    request: EmailTestRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    _role: User = Depends(require_roles("HR", "ADMIN")),
):
    """
    Send a test email to verify the WorkSphere SMTP integration.
    Restricted to HR and ADMIN users.
    """

    recipient = request.recipient.strip()

    if not validate_email_address(recipient):
        raise HTTPException(
            status_code=422,
            detail="Please provide a valid email address.",
        )

    if not is_email_configured():
        raise HTTPException(
            status_code=503,
            detail=(
                "Email is not configured. Check SMTP settings in "
                "the backend .env file and restart the server."
            ),
        )

    recipient_name = (
        getattr(current_user, "username", None)
        or getattr(current_user, "name", None)
        or "WorkSphere Administrator"
    )

    sent = send_work_notification(
        recipient=recipient,
        recipient_name=recipient_name,
        title="Email Integration Test",
        message=(
            "Congratulations! Your WorkSphere email integration "
            "is configured and the test message was accepted by "
            "the SMTP server."
        ),
    )

    if not sent:
        logger.warning("WorkSphere email test failed.")
        raise HTTPException(
            status_code=502,
            detail=(
                "The test email could not be sent. Check the SMTP "
                "settings and backend terminal logs."
            ),
        )

    return {
        "success": True,
        "message": "Test email sent successfully.",
        "recipient": recipient,
    }
