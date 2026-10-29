from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from auth import get_current_user, require_roles
from database import get_db
from models import User, Employee, Onboarding
from schemas import (
    OnboardingCreate,
    OnboardingUpdate,
    OnboardingResponse,
)


router = APIRouter(
    prefix="/onboarding",
    tags=["Employee Onboarding"],
)


VALID_STATUSES = {
    "PENDING",
    "COMPLETED",
}


# =====================================================
# HELPER: GET CURRENT EMPLOYEE
# =====================================================

def get_current_employee(
    db: Session,
    current_user: User,
):
    employee = (
        db.query(Employee)
        .filter(
            Employee.user_id == current_user.id,
            Employee.employment_status != "TERMINATED",
        )
        .first()
    )

    if employee is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee record not found.",
        )

    return employee


# =====================================================
# GET MY ONBOARDING TASKS
# EMPLOYEE
# =====================================================

@router.get(
    "/my",
    response_model=list[OnboardingResponse],
)
def get_my_onboarding_tasks(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    employee = get_current_employee(
        db,
        current_user,
    )

    return (
        db.query(Onboarding)
        .filter(
            Onboarding.employee_id == employee.id
        )
        .order_by(
            Onboarding.due_date.asc(),
            Onboarding.id.asc(),
        )
        .all()
    )


# =====================================================
# GET ALL ONBOARDING TASKS
# HR / ADMIN
# =====================================================

@router.get(
    "",
    response_model=list[OnboardingResponse],
)
def get_all_onboarding_tasks(
    employee_id: int | None = None,
    task_status: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("HR", "ADMIN")
    ),
):
    query = db.query(Onboarding)

    # Filter by employee
    if employee_id is not None:
        employee = (
            db.query(Employee)
            .filter(Employee.id == employee_id)
            .first()
        )

        if employee is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Employee not found.",
            )

        query = query.filter(
            Onboarding.employee_id == employee_id
        )

    # Filter by status
    if task_status:
        normalized_status = task_status.upper().strip()

        if normalized_status not in VALID_STATUSES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Status must be PENDING or COMPLETED.",
            )

        query = query.filter(
            Onboarding.status == normalized_status
        )

    return (
        query
        .order_by(
            Onboarding.due_date.asc(),
            Onboarding.id.asc(),
        )
        .all()
    )


# =====================================================
# CREATE ONBOARDING TASK
# HR / ADMIN
# =====================================================

@router.post(
    "",
    response_model=OnboardingResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_onboarding_task(
    onboarding_data: OnboardingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("HR", "ADMIN")
    ),
):
    # Validate employee
    employee = (
        db.query(Employee)
        .filter(
            Employee.id == onboarding_data.employee_id
        )
        .first()
    )

    if employee is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found.",
        )

    if employee.employment_status == "TERMINATED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot create onboarding tasks for a terminated employee.",
        )

    # Validate status
    normalized_status = onboarding_data.status.upper().strip()

    if normalized_status not in VALID_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Status must be PENDING or COMPLETED.",
        )

    # Validate task name
    task_name = onboarding_data.task_name.strip()

    if not task_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Task name cannot be empty.",
        )

    # Validate due date
    if onboarding_data.due_date < date.today():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Due date cannot be in the past.",
        )

    onboarding = Onboarding(
        employee_id=employee.id,
        task_name=task_name,
        status=normalized_status,
        due_date=onboarding_data.due_date,
    )

    db.add(onboarding)
    db.commit()
    db.refresh(onboarding)

    return onboarding


# =====================================================
# GET SINGLE ONBOARDING TASK
# =====================================================

@router.get(
    "/{onboarding_id}",
    response_model=OnboardingResponse,
)
def get_onboarding_task(
    onboarding_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    onboarding = (
        db.query(Onboarding)
        .filter(Onboarding.id == onboarding_id)
        .first()
    )

    if onboarding is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Onboarding task not found.",
        )

    # EMPLOYEE can only view own task
    if current_user.role == "EMPLOYEE":
        employee = get_current_employee(
            db,
            current_user,
        )

        if onboarding.employee_id != employee.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not allowed to access this onboarding task.",
            )

    return onboarding


# =====================================================
# UPDATE ONBOARDING TASK
# HR / ADMIN
# =====================================================

@router.put(
    "/{onboarding_id}",
    response_model=OnboardingResponse,
)
def update_onboarding_task(
    onboarding_id: int,
    onboarding_data: OnboardingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("HR", "ADMIN")
    ),
):
    onboarding = (
        db.query(Onboarding)
        .filter(Onboarding.id == onboarding_id)
        .first()
    )

    if onboarding is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Onboarding task not found.",
        )

    if onboarding_data.task_name is not None:
        task_name = onboarding_data.task_name.strip()

        if not task_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Task name cannot be empty.",
            )

        onboarding.task_name = task_name

    if onboarding_data.status is not None:
        normalized_status = (
            onboarding_data.status.upper().strip()
        )

        if normalized_status not in VALID_STATUSES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Status must be PENDING or COMPLETED.",
            )

        onboarding.status = normalized_status

    if onboarding_data.due_date is not None:
        if onboarding_data.due_date < date.today():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Due date cannot be in the past.",
            )

        onboarding.due_date = onboarding_data.due_date

    db.commit()
    db.refresh(onboarding)

    return onboarding


# =====================================================
# MARK MY TASK AS COMPLETED
# EMPLOYEE
# =====================================================

@router.patch(
    "/{onboarding_id}/complete",
    response_model=OnboardingResponse,
)
def complete_my_onboarding_task(
    onboarding_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    employee = get_current_employee(
        db,
        current_user,
    )

    onboarding = (
        db.query(Onboarding)
        .filter(
            Onboarding.id == onboarding_id,
            Onboarding.employee_id == employee.id,
        )
        .first()
    )

    if onboarding is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Onboarding task not found.",
        )

    if onboarding.status == "COMPLETED":
        return onboarding

    onboarding.status = "COMPLETED"

    db.commit()
    db.refresh(onboarding)

    return onboarding


# =====================================================
# DELETE ONBOARDING TASK
# HR / ADMIN
# =====================================================

@router.delete(
    "/{onboarding_id}",
)
def delete_onboarding_task(
    onboarding_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("HR", "ADMIN")
    ),
):
    onboarding = (
        db.query(Onboarding)
        .filter(Onboarding.id == onboarding_id)
        .first()
    )

    if onboarding is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Onboarding task not found.",
        )

    db.delete(onboarding)
    db.commit()

    return {
        "message": "Onboarding task deleted successfully.",
        "id": onboarding_id,
    }