
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import User, Notification
from schemas import NotificationResponse


router = APIRouter(
    tags=["Notification Management"],
)


# =====================================================
# GET MY NOTIFICATIONS
# ALL AUTHENTICATED USERS
# =====================================================

@router.get(
    "/notifications",
    response_model=list[NotificationResponse],
)
def get_my_notifications(
    unread_only: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Notification).filter(
        Notification.user_id == current_user.id
    )

    if unread_only:
        query = query.filter(
            Notification.is_read == 0
        )

    return query.order_by(
        Notification.created_at.desc(),
        Notification.id.desc(),
    ).all()


# =====================================================
# GET UNREAD NOTIFICATION COUNT
# =====================================================

@router.get(
    "/notifications/unread-count",
)
def get_unread_notification_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    count = (
        db.query(func.count(Notification.id))
        .filter(
            Notification.user_id == current_user.id,
            Notification.is_read == 0,
        )
        .scalar()
        or 0
    )

    return {
        "unread_count": count,
    }


# =====================================================
# MARK ONE NOTIFICATION AS READ
# =====================================================

@router.patch(
    "/notifications/{notification_id}/read",
    response_model=NotificationResponse,
)
def mark_notification_as_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notification = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id,
    ).first()

    if notification is None:
        raise HTTPException(
            status_code=404,
            detail="Notification not found.",
        )

    notification.is_read = 1

    db.commit()
    db.refresh(notification)

    return notification


# =====================================================
# MARK ALL MY NOTIFICATIONS AS READ
# =====================================================

@router.patch(
    "/notifications/read-all",
)
def mark_all_notifications_as_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    updated_count = (
        db.query(Notification)
        .filter(
            Notification.user_id == current_user.id,
            Notification.is_read == 0,
        )
        .update(
            {Notification.is_read: 1},
            synchronize_session=False,
        )
    )

    db.commit()

    return {
        "message": "All notifications marked as read.",
        "updated_count": updated_count,
    }
