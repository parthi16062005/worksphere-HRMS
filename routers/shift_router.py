
from datetime import datetime, time, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from auth import get_current_user, require_roles
from database import get_db
from models import User, Employee, Shift, EmployeeShift
from schemas import (
    ShiftCreate,
    ShiftResponse,
    EmployeeShiftAssign,
    EmployeeShiftResponse,
)


router = APIRouter(
    prefix="/shifts",
    tags=["Shift Management"],
)


# =====================================================
# HELPER: FIND LINKED EMPLOYEE
# =====================================================

def get_linked_employee(
    db: Session,
    user: User,
) -> Employee:
    """Find the employee record linked to a user account."""

    employee = (
        db.query(Employee)
        .filter(Employee.user_id == user.id)
        .first()
    )

    if employee is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No employee record is linked to this account.",
        )

    return employee


# =====================================================
# CREATE SHIFT
# HR / ADMIN ONLY
# =====================================================

@router.post(
    "",
    response_model=ShiftResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_shift(
    shift_data: ShiftCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("HR", "ADMIN")
    ),
):
    # Prevent shifts with identical start and end times.
    if shift_data.start_time == shift_data.end_time:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Shift start time and end time cannot be identical.",
        )

    existing_shift = (
        db.query(Shift)
        .filter(Shift.name == shift_data.name)
        .first()
    )

    if existing_shift:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A {shift_data.name} shift already exists.",
        )

    shift = Shift(
        name=shift_data.name,
        start_time=shift_data.start_time,
        end_time=shift_data.end_time,
    )

    try:
        db.add(shift)
        db.commit()
        db.refresh(shift)

    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This shift already exists.",
        )

    except Exception:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to create the shift.",
        )

    return shift


# =====================================================
# LIST ALL SHIFTS
# AUTHENTICATED USERS
# =====================================================

@router.get(
    "",
    response_model=list[ShiftResponse],
)
def get_shifts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(Shift)
        .order_by(Shift.id.asc())
        .all()
    )


# =====================================================
# ASSIGN SHIFT TO EMPLOYEE
# HR / ADMIN ONLY
# =====================================================

@router.post(
    "/assign",
    response_model=EmployeeShiftResponse,
    status_code=status.HTTP_200_OK,
)
def assign_shift(
    assignment_data: EmployeeShiftAssign,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("HR", "ADMIN")
    ),
):
    employee = (
        db.query(Employee)
        .filter(Employee.id == assignment_data.employee_id)
        .first()
    )

    if employee is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found.",
        )

    if employee.employment_status != "ACTIVE":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A shift can only be assigned to an active employee.",
        )

    shift = (
        db.query(Shift)
        .filter(Shift.id == assignment_data.shift_id)
        .first()
    )

    if shift is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shift not found.",
        )

    # Keep one current assignment per employee.
    # Reassigning an employee updates their existing assignment.
    existing_assignment = (
        db.query(EmployeeShift)
        .filter(
            EmployeeShift.employee_id == employee.id
        )
        .order_by(EmployeeShift.id.desc())
        .first()
    )

    try:
        if existing_assignment:
            existing_assignment.shift_id = shift.id
            existing_assignment.assigned_at = (
                datetime.now(timezone.utc)
            )

            assignment = existing_assignment

        else:
            assignment = EmployeeShift(
                employee_id=employee.id,
                shift_id=shift.id,
                assigned_at=datetime.now(timezone.utc),
            )

            db.add(assignment)

        db.commit()
        db.refresh(assignment)

    except Exception:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to assign the shift.",
        )

    return assignment


# =====================================================
# HR / ADMIN: VIEW EMPLOYEE SHIFT ASSIGNMENTS
# =====================================================

@router.get(
    "/assignments",
    response_model=list[EmployeeShiftResponse],
)
def get_shift_assignments(
    employee_id: int | None = None,
    shift_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("HR", "ADMIN")
    ),
):
    query = db.query(EmployeeShift)

    if employee_id is not None:
        query = query.filter(
            EmployeeShift.employee_id == employee_id
        )

    if shift_id is not None:
        query = query.filter(
            EmployeeShift.shift_id == shift_id
        )

    return (
        query
        .order_by(EmployeeShift.id.desc())
        .all()
    )


# =====================================================
# EMPLOYEE: VIEW OWN SHIFT ASSIGNMENT
# =====================================================

@router.get(
    "/my",
    response_model=EmployeeShiftResponse | None,
)
def get_my_shift(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("EMPLOYEE")
    ),
):
    employee = get_linked_employee(
        db,
        current_user,
    )

    assignment = (
        db.query(EmployeeShift)
        .filter(
            EmployeeShift.employee_id == employee.id
        )
        .order_by(EmployeeShift.id.desc())
        .first()
    )

    return assignment


# =====================================================
# EMPLOYEE: VIEW OWN SHIFT SCHEDULE
# =====================================================

@router.get(
    "/my/schedule",
)
def get_my_shift_schedule(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("EMPLOYEE")
    ),
):
    employee = get_linked_employee(
        db,
        current_user,
    )

    assignment = (
        db.query(EmployeeShift)
        .filter(
            EmployeeShift.employee_id == employee.id
        )
        .order_by(EmployeeShift.id.desc())
        .first()
    )

    if assignment is None:
        return {
            "employee_id": employee.id,
            "employee_name": employee.full_name,
            "shift_assigned": False,
            "message": "No shift has been assigned yet.",
            "shift": None,
        }

    shift = (
        db.query(Shift)
        .filter(Shift.id == assignment.shift_id)
        .first()
    )

    if shift is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The assigned shift could not be found.",
        )

    # Indicate whether the shift continues into the next day.
    is_overnight = shift.end_time < shift.start_time

    return {
        "employee_id": employee.id,
        "employee_name": employee.full_name,
        "shift_assigned": True,
        "assigned_at": assignment.assigned_at,
        "shift": {
            "id": shift.id,
            "name": shift.name,
            "start_time": shift.start_time,
            "end_time": shift.end_time,
            "is_overnight": is_overnight,
        },
    }
