
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session, joinedload

from auth import get_current_user, require_roles
from database import get_db
from models import Employee, Performance, User


router = APIRouter(
    prefix="/performance",
    tags=["Performance Management"],
)


# ==========================================
# REQUEST SCHEMA
# ==========================================

class PerformanceCreate(BaseModel):
    employee_id: int = Field(gt=0)
    review_period: str = Field(min_length=2, max_length=100)
    rating: int = Field(ge=1, le=5)
    feedback: str = Field(min_length=3, max_length=5000)


# ==========================================
# RESPONSE SCHEMA
# ==========================================

class PerformanceResponse(BaseModel):
    id: int
    employee_id: int
    review_period: str
    rating: int
    feedback: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# HELPERS
# ==========================================

def get_active_employee(db: Session, user: User):
    employee = (
        db.query(Employee)
        .filter(
            Employee.user_id == user.id,
            Employee.employment_status == "ACTIVE",
        )
        .first()
    )

    return employee


def get_employee_or_404(db: Session, employee_id: int):
    employee = (
        db.query(Employee)
        .filter(Employee.id == employee_id)
        .first()
    )

    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found.",
        )

    return employee


# ==========================================
# CREATE PERFORMANCE REVIEW
# HR / ADMIN ONLY
# ==========================================

@router.post(
    "",
    response_model=PerformanceResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_performance_review(
    review_data: PerformanceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("HR", "ADMIN")
    ),
):
    employee = get_employee_or_404(
        db,
        review_data.employee_id,
    )

    if employee.employment_status != "ACTIVE":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot create a review for an inactive employee.",
        )

    review_period = review_data.review_period.strip()
    feedback = review_data.feedback.strip()

    if not review_period:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Review period cannot be empty.",
        )

    if len(feedback) < 3:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Feedback must contain at least 3 characters.",
        )

    review = Performance(
        employee_id=employee.id,
        review_period=review_period,
        rating=review_data.rating,
        feedback=feedback,
        created_at=datetime.now(timezone.utc),
    )

    db.add(review)
    db.commit()
    db.refresh(review)

    return review


# ==========================================
# LIST PERFORMANCE REVIEWS
# EMPLOYEE: OWN REVIEWS
# HR / ADMIN: ALL OR FILTERED REVIEWS
# ==========================================

@router.get(
    "",
    response_model=list[PerformanceResponse],
)
def list_performance_reviews(
    employee_id: int | None = Query(default=None, gt=0),
    review_period: str | None = Query(
        default=None,
        min_length=2,
        max_length=100,
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Performance)

    role = str(current_user.role).upper()

    if role == "EMPLOYEE":
        employee = get_active_employee(
            db,
            current_user,
        )

        if not employee:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Active employee record not found.",
            )

        query = query.filter(
            Performance.employee_id == employee.id
        )

    elif role in ("HR", "ADMIN"):
        if employee_id is not None:
            get_employee_or_404(db, employee_id)

            query = query.filter(
                Performance.employee_id == employee_id
            )

    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to view performance reviews.",
        )

    if review_period:
        query = query.filter(
            Performance.review_period.ilike(
                f"%{review_period.strip()}%"
            )
        )

    return (
        query.order_by(
            Performance.created_at.desc(),
            Performance.id.desc(),
        )
        .all()
    )


# ==========================================
# GET A SINGLE PERFORMANCE REVIEW
# ==========================================

@router.get(
    "/{review_id}",
    response_model=PerformanceResponse,
)
def get_performance_review(
    review_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    review = (
        db.query(Performance)
        .filter(Performance.id == review_id)
        .first()
    )

    if not review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Performance review not found.",
        )

    role = str(current_user.role).upper()

    if role == "EMPLOYEE":
        employee = get_active_employee(
            db,
            current_user,
        )

        if (
            not employee
            or employee.id != review.employee_id
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only view your own performance reviews.",
            )

    elif role not in ("HR", "ADMIN"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to view this review.",
        )

    return review
