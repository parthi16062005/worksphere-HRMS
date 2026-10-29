
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from auth import get_current_user, require_roles
from database import SessionLocal, get_db
from models import (
    User,
    Employee,
    Attendance,
    Notification,
    EmployeeShift,
    Shift,
    Leave,
)

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

# Default shift for employees without an assigned shift.
OFFICE_CHECK_IN_TIME = time(9, 30)
OFFICE_CHECK_OUT_TIME = time(18, 30)

# Grace period before late status applies.
LATE_GRACE_PERIOD_MINUTES = 15


# =====================================================
# HELPER: GET LINKED EMPLOYEE
# =====================================================

def get_linked_employee(
    db: Session,
    user: User,
) -> Employee:

    employee = (
        db.query(Employee)
        .filter(Employee.user_id == user.id)
        .first()
    )

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
# HELPER: GET EMPLOYEE SHIFT
# =====================================================

def get_employee_shift(
    db: Session,
    employee_id: int,
) -> Shift | None:

    assignment = (
        db.query(EmployeeShift)
        .filter(
            EmployeeShift.employee_id == employee_id
        )
        .order_by(EmployeeShift.id.desc())
        .first()
    )

    if assignment is None:
        return None

    return (
        db.query(Shift)
        .filter(Shift.id == assignment.shift_id)
        .first()
    )


# =====================================================
# HELPER: CALCULATE SHIFT TIMES
# =====================================================

def get_shift_times(
    shift: Shift | None,
    attendance_date: date,
) -> tuple[datetime, datetime]:

    if shift is None:
        start_time = OFFICE_CHECK_IN_TIME
        end_time = OFFICE_CHECK_OUT_TIME
    else:
        start_time = shift.start_time
        end_time = shift.end_time

    shift_start = datetime.combine(
        attendance_date,
        start_time,
        tzinfo=ATTENDANCE_TIMEZONE,
    )

    shift_end = datetime.combine(
        attendance_date,
        end_time,
        tzinfo=ATTENDANCE_TIMEZONE,
    )

    # Support overnight shifts, such as 22:00 to 06:00.
    if end_time < start_time:
        shift_end += timedelta(days=1)

    return shift_start, shift_end


# =====================================================
# HELPER: CHECK APPROVED LEAVE
# =====================================================

def employee_has_approved_leave(
    db: Session,
    employee_id: int,
    attendance_date: date,
) -> bool:
    """
    Return True if the employee has approved leave
    covering the attendance date.

    Leave dates are inclusive.
    """

    approved_leave = (
        db.query(Leave.id)
        .filter(
            Leave.employee_id == employee_id,
            Leave.status == "APPROVED",
            Leave.start_date <= attendance_date,
            Leave.end_date >= attendance_date,
        )
        .first()
    )

    return approved_leave is not None


# =====================================================
# HELPER: CREATE NOTIFICATION
# =====================================================

def create_attendance_notification(
    db: Session,
    user_id: int,
    title: str,
    message: str,
) -> None:

    notification = Notification(
        user_id=user_id,
        title=title,
        message=message,
        is_read=0,
    )

    db.add(notification)


# =====================================================
# AUTOMATIC ABSENCE PROCESSOR
# =====================================================

def process_automatic_absences() -> int:
    """
    Mark active employees ABSENT after their shift's
    start time and grace period.

    Employees with approved leave are excluded.

    Returns the number of newly created absence records.
    """

    db = SessionLocal()

    created_count = 0

    try:
        now = datetime.now(ATTENDANCE_TIMEZONE)
        today = now.date()

        employees = (
            db.query(Employee)
            .filter(
                Employee.employment_status == "ACTIVE"
            )
            .all()
        )

        for employee in employees:

            # Skip employees who have approved leave today.
            if employee_has_approved_leave(
                db,
                employee.id,
                today,
            ):
                continue

            # Do not create another record if one exists.
            existing_attendance = (
                db.query(Attendance)
                .filter(
                    Attendance.employee_id == employee.id,
                    Attendance.date == today,
                )
                .first()
            )

            if existing_attendance is not None:
                continue

            shift = get_employee_shift(
                db,
                employee.id,
            )

            shift_start, _ = get_shift_times(
                shift,
                today,
            )

            absence_cutoff = (
                shift_start
                + timedelta(
                    minutes=LATE_GRACE_PERIOD_MINUTES
                )
            )

            # Wait until the grace period has expired.
            if now <= absence_cutoff:
                continue

            attendance = Attendance(
                employee_id=employee.id,
                check_in=None,
                check_out=None,
                date=today,
                status="ABSENT",
                working_hours=None,
                is_late=False,
                is_early_checkout=False,
            )

            db.add(attendance)

            if employee.user_id is not None:

                shift_description = (
                    f" for your {shift.name} shift"
                    if shift is not None
                    else ""
                )

                create_attendance_notification(
                    db=db,
                    user_id=employee.user_id,
                    title="Automatic Absence Recorded",
                    message=(
                        f"Your attendance for {today} "
                        f"was automatically marked ABSENT"
                        f"{shift_description} because no "
                        f"check-in was recorded before "
                        f"the attendance cutoff. If you "
                        f"arrive late, please check in "
                        f"to update your attendance."
                    ),
                )

            created_count += 1

        db.commit()

        return created_count

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()


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

    employee = get_linked_employee(
        db,
        current_user,
    )

    now = datetime.now(ATTENDANCE_TIMEZONE)
    today = now.date()

    # -------------------------------------------------
    # APPROVED LEAVE VALIDATION
    # -------------------------------------------------

    if employee_has_approved_leave(
        db,
        employee.id,
        today,
    ):
        raise HTTPException(
            status_code=409,
            detail=(
                "You have approved leave for today. "
                "Contact HR if you need to record attendance."
            ),
        )

    # -------------------------------------------------
    # FIND EXISTING ATTENDANCE
    # -------------------------------------------------

    existing_attendance = (
        db.query(Attendance)
        .filter(
            Attendance.employee_id == employee.id,
            Attendance.date == today,
        )
        .first()
    )

    # -------------------------------------------------
    # HANDLE AUTOMATIC ABSENCE
    # -------------------------------------------------

    if existing_attendance is not None:

        if (
            existing_attendance.status == "ABSENT"
            and existing_attendance.check_in is None
        ):

            shift = get_employee_shift(
                db,
                employee.id,
            )

            shift_start, _ = get_shift_times(
                shift,
                today,
            )

            late_cutoff = (
                shift_start
                + timedelta(
                    minutes=LATE_GRACE_PERIOD_MINUTES
                )
            )

            # Update the existing absence record.
            existing_attendance.check_in = now
            existing_attendance.check_out = None
            existing_attendance.status = "PRESENT"
            existing_attendance.working_hours = None
            existing_attendance.is_late = now > late_cutoff
            existing_attendance.is_early_checkout = False

            try:
                create_attendance_notification(
                    db=db,
                    user_id=current_user.id,
                    title="Late Check-in Recorded",
                    message=(
                        f"Your check-in for {today} was "
                        f"recorded successfully. Your "
                        f"previous automatic absence "
                        f"record has been updated."
                    ),
                )

                db.commit()
                db.refresh(existing_attendance)

            except Exception:
                db.rollback()

                raise HTTPException(
                    status_code=500,
                    detail="Unable to update your attendance.",
                )

            return existing_attendance

        raise HTTPException(
            status_code=409,
            detail=(
                "Attendance has already been recorded "
                "for today."
            ),
        )

    # -------------------------------------------------
    # GET SHIFT AND DETECT LATE CHECK-IN
    # -------------------------------------------------

    shift = get_employee_shift(
        db,
        employee.id,
    )

    shift_start, _ = get_shift_times(
        shift,
        today,
    )

    late_cutoff = (
        shift_start
        + timedelta(
            minutes=LATE_GRACE_PERIOD_MINUTES
        )
    )

    is_late = now > late_cutoff

    # -------------------------------------------------
    # CREATE ATTENDANCE
    # -------------------------------------------------

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

    shift_description = (
        f" for your {shift.name} shift"
        if shift is not None
        else ""
    )

    try:

        db.add(attendance)

        create_attendance_notification(
            db=db,
            user_id=current_user.id,
            title="Attendance Check-in Recorded",
            message=(
                f"Your attendance check-in for {today} "
                f"was recorded successfully{shift_description}."
                + (
                    " Your check-in is marked late."
                    if is_late
                    else ""
                )
            ),
        )

        db.commit()
        db.refresh(attendance)

    except IntegrityError:

        db.rollback()

        raise HTTPException(
            status_code=409,
            detail=(
                "Unable to record check-in. "
                "Please try again."
            ),
        )

    except Exception:

        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to record attendance "
                "and notification."
            ),
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

    employee = get_linked_employee(
        db,
        current_user,
    )

    now = datetime.now(ATTENDANCE_TIMEZONE)
    today = now.date()

    attendance = (
        db.query(Attendance)
        .filter(
            Attendance.employee_id == employee.id,
            Attendance.date == today,
        )
        .first()
    )

    # Support overnight shifts by finding yesterday's
    # open attendance record when today's record is absent.
    if attendance is None:

        yesterday = today - timedelta(days=1)

        previous_attendance = (
            db.query(Attendance)
            .filter(
                Attendance.employee_id == employee.id,
                Attendance.date == yesterday,
                Attendance.check_out.is_(None),
            )
            .first()
        )

        if previous_attendance is not None:

            shift = get_employee_shift(
                db,
                employee.id,
            )

            if (
                shift is not None
                and shift.end_time < shift.start_time
            ):
                attendance = previous_attendance

    if attendance is None:
        raise HTTPException(
            status_code=404,
            detail="Please check in before checking out.",
        )

    if attendance.status == "ABSENT":
        raise HTTPException(
            status_code=409,
            detail=(
                "You are marked absent. Please check in "
                "before attempting to check out."
            ),
        )

    if attendance.check_out is not None:
        raise HTTPException(
            status_code=409,
            detail=(
                "You have already checked out "
                "for this attendance record."
            ),
        )

    if attendance.check_in is None:
        raise HTTPException(
            status_code=400,
            detail="Attendance check-in time is missing.",
        )

    # SQLite may return naive datetime objects.
    check_in = attendance.check_in

    if check_in.tzinfo is None:
        check_in = check_in.replace(
            tzinfo=ATTENDANCE_TIMEZONE
        )
    else:
        check_in = check_in.astimezone(
            ATTENDANCE_TIMEZONE
        )

    elapsed_seconds = (
        now - check_in
    ).total_seconds()

    if elapsed_seconds < 0:
        raise HTTPException(
            status_code=400,
            detail="Check-out time cannot precede check-in time.",
        )

    hours = elapsed_seconds / 3600

    shift = get_employee_shift(
        db,
        employee.id,
    )

    _, shift_end = get_shift_times(
        shift,
        attendance.date,
    )

    attendance.is_early_checkout = now < shift_end

    attendance.check_out = now

    attendance.working_hours = Decimal(
        f"{hours:.2f}"
    )

    attendance.status = (
        "HALF_DAY"
        if hours < ATTENDANCE_HALF_DAY_HOURS
        else "PRESENT"
    )

    # -------------------------------------------------
    # MODULE 19: CHECK-OUT NOTIFICATIONS
    # -------------------------------------------------

    formatted_hours = f"{hours:.2f}"

    if attendance.is_early_checkout:

        notification_title = "Early Check-out Recorded"

        notification_message = (
            f"Your check-out for {attendance.date} was "
            f"recorded before your scheduled shift ended. "
            f"Your total working time was "
            f"{formatted_hours} hours. "
            "If you have approval to leave early, "
            "no further action is needed."
        )

    else:

        notification_title = "Attendance Check-out Recorded"

        notification_message = (
            f"Your check-out for {attendance.date} was "
            f"recorded successfully. Your total working "
            f"time was {formatted_hours} hours."
        )

    # Save attendance and notification together.
    try:

        create_attendance_notification(
            db=db,
            user_id=current_user.id,
            title=notification_title,
            message=notification_message,
        )

        db.commit()
        db.refresh(attendance)

    except Exception as exc:

        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to record check-out "
                "and notification."
            ),
        ) from exc

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

    employee = (
        db.query(Employee)
        .filter(
            Employee.user_id == current_user.id
        )
        .first()
    )

    if employee is None:
        raise HTTPException(
            status_code=404,
            detail="No employee record is linked to this account.",
        )

    return (
        db.query(Attendance)
        .filter(
            Attendance.employee_id == employee.id
        )
        .order_by(
            Attendance.date.desc()
        )
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
# =====================================================

@router.get(
    "/attendance/{attendance_id}",
    response_model=AttendanceResponse,
)
def get_attendance_record(
    attendance_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        get_current_user
    ),
):

    attendance = (
        db.query(Attendance)
        .filter(
            Attendance.id == attendance_id
        )
        .first()
    )

    if attendance is None:
        raise HTTPException(
            status_code=404,
            detail="Attendance record not found.",
        )

    if current_user.role == "EMPLOYEE":

        employee = (
            db.query(Employee)
            .filter(
                Employee.user_id == current_user.id
            )
            .first()
        )

        if (
            employee is None
            or attendance.employee_id != employee.id
        ):
            raise HTTPException(
                status_code=403,
                detail="You can only view your own attendance.",
            )

    return attendance
