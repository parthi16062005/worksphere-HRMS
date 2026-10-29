
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from auth import get_current_user, require_roles
from database import get_db
from models import Employee, Resignation, User
from schemas import (
    ResignationCreate,
    ResignationResponse,
    ResignationReview,
)


router = APIRouter(
    prefix="/resignations",
    tags=["Resignation & Exit Management"],
)


# =====================================================
# HELPER: FIND EMPLOYEE LINKED TO THE LOGGED-IN USER
# =====================================================

def get_my_employee(db: Session, user: User) -> Employee:
    employee = (
        db.query(Employee)
        .filter(Employee.user_id == user.id)
        .first()
    )

    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No employee profile is linked to your account.",
        )

    return employee


# =====================================================
# EMPLOYEE: SUBMIT RESIGNATION
# POST /resignations
# =====================================================

@router.post(
    "",
    response_model=ResignationResponse,
    status_code=status.HTTP_201_CREATED,
)
def submit_resignation(
    resignation_data: ResignationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("EMPLOYEE", "HR", "ADMIN")
    ),
):
    employee = get_my_employee(db, current_user)

    # Prevent multiple pending resignation requests.
    pending_request = (
        db.query(Resignation)
        .filter(
            Resignation.employee_id == employee.id,
            Resignation.status == "PENDING",
        )
        .first()
    )

    if pending_request:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You already have a pending resignation request.",
        )

    resignation = Resignation(
        employee_id=employee.id,
        reason=resignation_data.reason.strip(),
        notice_period=resignation_data.notice_period,
        status="PENDING",
        created_at=datetime.now(timezone.utc),
    )

    db.add(resignation)
    db.commit()
    db.refresh(resignation)

    return resignation


# =====================================================
# EMPLOYEE: VIEW MY RESIGNATIONS
# GET /resignations/my
# =====================================================

@router.get(
    "/my",
    response_model=list[ResignationResponse],
)
def get_my_resignations(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("EMPLOYEE", "HR", "ADMIN")
    ),
):
    employee = get_my_employee(db, current_user)

    return (
        db.query(Resignation)
        .filter(Resignation.employee_id == employee.id)
        .order_by(Resignation.created_at.desc())
        .all()
    )


# =====================================================
# HR / ADMIN: VIEW ALL RESIGNATIONS
# GET /resignations
# =====================================================

@router.get(
    "",
    response_model=list[ResignationResponse],
)
def get_all_resignations(
    resignation_status: str | None = Query(
        default=None,
        alias="status",
    ),
    employee_id: int | None = Query(default=None, gt=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("HR", "ADMIN")
    ),
):
    query = db.query(Resignation)

    if resignation_status:
        normalized_status = resignation_status.upper()

        if normalized_status not in {
            "PENDING",
            "APPROVED",
            "REJECTED",
        }:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Status must be PENDING, APPROVED, or REJECTED.",
            )

        query = query.filter(
            Resignation.status == normalized_status
        )

    if employee_id is not None:
        query = query.filter(
            Resignation.employee_id == employee_id
        )

    return query.order_by(
        Resignation.created_at.desc()
    ).all()


# =====================================================
# VIEW A RESIGNATION
# GET /resignations/{resignation_id}
# =====================================================

@router.get(
    "/{resignation_id}",
    response_model=ResignationResponse,
)
def get_resignation(
    resignation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    resignation = (
        db.query(Resignation)
        .filter(Resignation.id == resignation_id)
        .first()
    )

    if not resignation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resignation request not found.",
        )

    role = str(
        getattr(current_user, "role", "")
    ).upper()

    if role not in {"HR", "ADMIN"}:
        employee = get_my_employee(db, current_user)

        if resignation.employee_id != employee.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You cannot access another employee's resignation.",
            )

    return resignation


# =====================================================
# HR / ADMIN: APPROVE OR REJECT RESIGNATION
# PATCH /resignations/{resignation_id}/review
# =====================================================

@router.patch(
    "/{resignation_id}/review",
    response_model=ResignationResponse,
)
def review_resignation(
    resignation_id: int,
    review_data: ResignationReview,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("HR", "ADMIN")
    ),
):
    decision = review_data.status.strip().upper()

    if decision not in {"APPROVED", "REJECTED"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Review status must be APPROVED or REJECTED.",
        )

    resignation = (
        db.query(Resignation)
        .filter(Resignation.id == resignation_id)
        .with_for_update()
        .first()
    )

    if not resignation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resignation request not found.",
        )

    if resignation.status != "PENDING":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This resignation request has already been reviewed.",
        )

    resignation.status = decision

    db.commit()
    db.refresh(resignation)

    return resignation
