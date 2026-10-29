
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from auth import get_current_user, require_roles
from database import get_db
from models import Announcement
from schemas import (
    AnnouncementCreate,
    AnnouncementUpdate,
    AnnouncementResponse,
)


router = APIRouter(
    prefix="/announcements",
    tags=["Internal Announcements"],
)


# =====================================================
# CREATE ANNOUNCEMENT — HR / ADMIN
# =====================================================
@router.post(
    "",
    response_model=AnnouncementResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_announcement(
    data: AnnouncementCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("HR", "ADMIN")),
):
    announcement = Announcement(
        title=data.title.strip(),
        message=data.message.strip(),
        created_by=current_user.id,
    )

    if not announcement.title or not announcement.message:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Title and message cannot be empty.",
        )

    db.add(announcement)
    db.commit()
    db.refresh(announcement)

    return announcement


# =====================================================
# GET ANNOUNCEMENTS — ALL AUTHENTICATED USERS
# =====================================================
@router.get(
    "",
    response_model=list[AnnouncementResponse],
)
def get_announcements(
    search: str | None = Query(default=None, max_length=200),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    query = db.query(Announcement)

    if search and search.strip():
        search_text = f"%{search.strip()}%"
        query = query.filter(
            Announcement.title.ilike(search_text)
            | Announcement.message.ilike(search_text)
        )

    return query.order_by(
        Announcement.created_at.desc(),
        Announcement.id.desc(),
    ).all()


# =====================================================
# GET ONE ANNOUNCEMENT — ALL AUTHENTICATED USERS
# =====================================================
@router.get(
    "/{announcement_id}",
    response_model=AnnouncementResponse,
)
def get_announcement(
    announcement_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    announcement = db.query(Announcement).filter(
        Announcement.id == announcement_id
    ).first()

    if not announcement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Announcement not found.",
        )

    return announcement


# =====================================================
# UPDATE ANNOUNCEMENT — HR / ADMIN
# =====================================================
@router.put(
    "/{announcement_id}",
    response_model=AnnouncementResponse,
)
def update_announcement(
    announcement_id: int,
    data: AnnouncementUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("HR", "ADMIN")),
):
    announcement = db.query(Announcement).filter(
        Announcement.id == announcement_id
    ).first()

    if not announcement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Announcement not found.",
        )

    updates = data.model_dump(exclude_unset=True)

    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide a title or message to update.",
        )

    for field, value in updates.items():
        if value is not None:
            value = value.strip()

            if not value:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"{field.capitalize()} cannot be empty.",
                )

            setattr(announcement, field, value)

    db.commit()
    db.refresh(announcement)

    return announcement


# =====================================================
# DELETE ANNOUNCEMENT — HR / ADMIN
# =====================================================
@router.delete(
    "/{announcement_id}",
    status_code=status.HTTP_200_OK,
)
def delete_announcement(
    announcement_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("HR", "ADMIN")),
):
    announcement = db.query(Announcement).filter(
        Announcement.id == announcement_id
    ).first()

    if not announcement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Announcement not found.",
        )

    db.delete(announcement)
    db.commit()

    return {
        "message": "Announcement deleted successfully.",
        "announcement_id": announcement_id,
    }
