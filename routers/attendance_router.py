from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from auth import get_current_user, require_roles
from database import get_db
from models import User, Employee, Attendance, Notification
from schemas import AttendanceResponse, AttendanceStatus


router = APIRouter(
    tags=["Attendance Management"],
)


# =====================================================
# ATTENDANCE CONFIGURATION
# =====================================================

ATTENDANCE_HALF_DAY_HOURS = 4.0

# Indian Standard Time (UTC +05:30)
ATTENDANCE_TIMEZONE = timezone(
    timedelta(hours=5, minutes=30)
)

OFFICE_CHECK_IN_TIME = time(9, 30)
LATE_GRACE_PERIOD_MINUTES = 15

OFFICE_CHECK_OUT_TIME = time(18, 30)


# =====================================================
# HELPER: GET LINKED EMPLOYEE
# =====================================================

def get_linked_employee(
    db: Session,
    user: User,
) -> Employee:
    """Find the employee record linked to a user account."""

    employee = db.query(Employee).filter(
        Employee.user_id == user.id
    ).first()

    if employee is None:
        raise HTTPException(
            status_code=404,
            detail="No employee record is linked to this account.",
        )

    if employee.employment_status != "ACTIVE":
        raise HTTPException(
            status_code=403,
            detail="Only active employees can use attendance.",
        )

    return employee


# =====================================================
# EMPLOYEE CHECK-IN
# =====================================================

@router.post(
    "/attendance/check-in",
    response_model=AttendanceResponse,
    status_code=status.HTTP_201_CREATED,
)
def attendance_check_in(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("EMPLOYEE")
    ),
):
    employee = get_linked_employee(db, current_user)

    now = datetime.now(ATTENDANCE_TIMEZONE)
    today = now.date()

    # Calculate the late check-in cutoff.
    late_cutoff = (
        datetime.combine(
            today,
            OFFICE_CHECK_IN_TIME,
            tzinfo=ATTENDANCE_TIMEZONE,
        )
        + timedelta(
            minutes=LATE_GRACE_PERIOD_MINUTES
        )
    )

    is_late = now > late_cutoff

    existing_attendance = db.query(Attendance).filter(
        Attendance.employee_id == employee.id,
        Attendance.date == today,
    ).first()

    if existing_attendance:
        raise HTTPException(
            status_code=409,
            detail="Attendance has already been recorded for today.",
        )

    # Create attendance record.
    attendance = Attendance(
        employee_id=employee.id,
        check_in=now,
        check_out=None,
        date=today,
        status="PRESENT",
        working_hours=None,
        is_late=is_late,
        is_early_checkout=False,
    )

    # Create notification for the employee.
    notification = Notification(
        user_id=current_user.id,
        title="Attendance Check-in Recorded",
        message=(
            f"Your attendance check-in for {today} "
            "was recorded successfully."
            + (
                " Your check-in is marked late."
                if is_late
                else ""
            )
        ),
        is_read=0,
    )

    try:
        db.add(attendance)
        db.add(notification)

        db.commit()
        db.refresh(attendance)

    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=409,
            detail="Unable to record check-in. Please try again.",
        )

    except Exception:
        db.rollback()

        raise HTTPException(
            status_code=500,
            detail="Unable to record attendance and notification.",
        )

    return attendance


# =====================================================
# EMPLOYEE CHECK-OUT
# =====================================================

@router.post(
    "/attendance/check-out",
    response_model=AttendanceResponse,
)
def attendance_check_out(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("EMPLOYEE")
    ),
):
    employee = get_linked_employee(db, current_user)

    # Use Indian Standard Time consistently.
    now = datetime.now(ATTENDANCE_TIMEZONE)
    today = now.date()

    attendance = db.query(Attendance).filter(
        Attendance.employee_id == employee.id,
        Attendance.date == today,
    ).first()

    if attendance is None:
        raise HTTPException(
            status_code=404,
            detail="Please check in before checking out.",
        )

    if attendance.check_out is not None:
        raise HTTPException(
            status_code=409,
            detail="You have already checked out today.",
        )

    check_in = attendance.check_in

    # SQLite may return a naive datetime.
    # Check-in values are stored using Indian Standard Time.
    if check_in.tzinfo is None:
        check_in = check_in.replace(
            tzinfo=ATTENDANCE_TIMEZONE
        )

    elapsed_seconds = (
        now - check_in
    ).total_seconds()

    if elapsed_seconds < 0:
        raise HTTPException(
            status_code=400,
            detail="Check-out time cannot precede check-in time.",
        )

    # Calculate total working hours.
    hours = elapsed_seconds / 3600

    attendance.check_out = now

    attendance.working_hours = Decimal(
        f"{hours:.2f}"
    )

    # Detect early check-out.
    attendance.is_early_checkout = (
        now.time().replace(tzinfo=None)
        < OFFICE_CHECK_OUT_TIME
    )

    # Preserve existing attendance status rules.
    if hours < ATTENDANCE_HALF_DAY_HOURS:
        attendance.status = "HALF_DAY"
    else:
        attendance.status = "PRESENT"

    try:
        db.commit()
        db.refresh(attendance)

    except Exception:
        db.rollback()

        raise HTTPException(
            status_code=500,
            detail="Unable to record check-out.",
        )

    return attendance


# =====================================================
# EMPLOYEE: VIEW OWN ATTENDANCE HISTORY
# =====================================================

@router.get(
    "/attendance/my",
    response_model=list[AttendanceResponse],
)
def get_my_attendance(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("EMPLOYEE")
    ),
):
    employee = db.query(Employee).filter(
        Employee.user_id == current_user.id
    ).first()

    if employee is None:
        raise HTTPException(
            status_code=404,
            detail="No employee record is linked to this account.",
        )

    return (
        db.query(Attendance)
        .filter(Attendance.employee_id == employee.id)
        .order_by(Attendance.date.desc())
        .all()
    )


# =====================================================
# HR / ADMIN: VIEW ALL ATTENDANCE
# =====================================================

@router.get(
    "/attendance",
    response_model=list[AttendanceResponse],
)
def get_all_attendance(
    attendance_date: date | None = None,
    employee_id: int | None = None,
    attendance_status: AttendanceStatus | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("HR", "ADMIN")
    ),
):
    query = db.query(Attendance)

    if attendance_date is not None:
        query = query.filter(
            Attendance.date == attendance_date
        )

    if employee_id is not None:
        query = query.filter(
            Attendance.employee_id == employee_id
        )

    if attendance_status is not None:
        query = query.filter(
            Attendance.status == attendance_status
        )

    return query.order_by(
        Attendance.date.desc(),
        Attendance.id.desc(),
    ).all()


# =====================================================
# VIEW ONE ATTENDANCE RECORD
# HR / ADMIN OR THE EMPLOYEE WHO OWNS THE RECORD
# =====================================================

@router.get(
    "/attendance/{attendance_id}",
    response_model=AttendanceResponse,
)
def get_attendance_record(
    attendance_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    attendance = db.query(Attendance).filter(
        Attendance.id == attendance_id
    ).first()

    if attendance is None:
        raise HTTPException(
            status_code=404,
            detail="Attendance record not found.",
        )

    if current_user.role == "EMPLOYEE":
        employee = db.query(Employee).filter(
            Employee.user_id == current_user.id
        ).first()

        if (
            employee is None
            or attendance.employee_id != employee.id
        ):
            raise HTTPException(
                status_code=403,
                detail="You can only view your own attendance.",
            )

    return attendance