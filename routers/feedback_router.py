from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from auth import get_current_user, require_roles
from database import get_db
from models import Employee, Feedback, Notification, User
from schemas import FeedbackCreate, FeedbackReview, FeedbackResponse


router = APIRouter(
    prefix="/feedback",
    tags=["Employee Feedback"],
)


# =========================================================
# HELPER: GET THE LOGGED-IN EMPLOYEE PROFILE
# =========================================================

def get_employee_profile(db: Session, user_id: int) -> Employee:
    employee = (
        db.query(Employee)
        .filter(Employee.user_id == user_id)
        .first()
    )

    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee profile not found for this account.",
        )

    return employee


# =========================================================
# EMPLOYEE: SUBMIT FEEDBACK
# POST /feedback
# =========================================================

@router.post(
    "",
    response_model=FeedbackResponse,
    status_code=status.HTTP_201_CREATED,
)
def submit_feedback(
    feedback_data: FeedbackCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("EMPLOYEE", "HR", "ADMIN")
    ),
):
    employee = get_employee_profile(db, current_user.id)

    feedback = Feedback(
        employee_id=employee.id,
        category=feedback_data.category,
        rating=feedback_data.rating,
        message=feedback_data.message.strip(),
        status="SUBMITTED",
        created_at=datetime.now(timezone.utc),
    )

    if not feedback.message:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Feedback message cannot be empty.",
        )

    db.add(feedback)
    db.commit()
    db.refresh(feedback)

    return feedback


# =========================================================
# EMPLOYEE: VIEW MY FEEDBACK
# GET /feedback/my
# =========================================================

@router.get(
    "/my",
    response_model=list[FeedbackResponse],
)
def get_my_feedback(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("EMPLOYEE", "HR", "ADMIN")
    ),
):
    employee = get_employee_profile(db, current_user.id)

    return (
        db.query(Feedback)
        .filter(Feedback.employee_id == employee.id)
        .order_by(Feedback.created_at.desc())
        .all()
    )


# =========================================================
# HR / ADMIN: VIEW ALL FEEDBACK
# GET /feedback
# =========================================================

@router.get(
    "",
    response_model=list[FeedbackResponse],
)
def get_all_feedback(
    feedback_status: str | None = Query(
        default=None,
        alias="status",
    ),
    category: str | None = Query(default=None),
    rating: int | None = Query(default=None, ge=1, le=5),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("HR", "ADMIN")
    ),
):
    query = db.query(Feedback)

    if feedback_status:
        feedback_status = feedback_status.upper()

        if feedback_status not in {
            "SUBMITTED",
            "REVIEWED",
            "RESOLVED",
        }:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid feedback status.",
            )

        query = query.filter(
            Feedback.status == feedback_status
        )

    if category:
        query = query.filter(
            Feedback.category == category.upper()
        )

    if rating is not None:
        query = query.filter(
            Feedback.rating == rating
        )

    return query.order_by(Feedback.created_at.desc()).all()


# =========================================================
# HR / ADMIN: REVIEW FEEDBACK
# PATCH /feedback/{feedback_id}/review
# =========================================================

@router.patch(
    "/{feedback_id}/review",
    response_model=FeedbackResponse,
)
def review_feedback(
    feedback_id: int,
    review_data: FeedbackReview,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("HR", "ADMIN")
    ),
):
    feedback = (
        db.query(Feedback)
        .filter(Feedback.id == feedback_id)
        .first()
    )

    if not feedback:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Feedback not found.",
        )

    if feedback.status == "RESOLVED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This feedback has already been resolved.",
        )

    feedback.status = review_data.status
    feedback.review_comment = (
        review_data.review_comment.strip()
        if review_data.review_comment
        else None
    )
    feedback.reviewed_by = current_user.id
    feedback.reviewed_at = datetime.now(timezone.utc)

    notification = Notification(
        user_id=(
            db.query(Employee.user_id)
            .filter(Employee.id == feedback.employee_id)
            .scalar()
        ),
        title="Feedback Update",
        message=(
            f"Your feedback #{feedback.id} status is now "
            f"{feedback.status}."
        ),
        is_read=False,
    )

    db.add(notification)
    db.commit()
    db.refresh(feedback)

    return feedback