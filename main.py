
from contextlib import asynccontextmanager
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from auth import (
    create_access_token,
    get_current_user,
    hash_password,
    require_roles,
    verify_password,
)
from database import Base, engine, get_db
from models import (
    User,
    Employee,
    Attendance,
    Leave,
    Payroll,
    Notification,
)

from schemas import (
    TokenResponse,
    UserProfileResponse,
    UserProfileUpdate,
    UserRegister,
    UserResponse,
    EmployeeCreate,
    EmployeeUpdate,
    EmployeeResponse,
    AttendanceCheckIn,
    AttendanceCheckOut,
    AttendanceResponse,
    AttendanceStatus,
    LeaveCreate,
    LeaveReview,
    LeaveResponse,
    LeaveStatus,
    PayrollCreate,
    PayrollResponse,
    PayrollPaymentUpdate,
    NotificationResponse,
    NotificationReadUpdate,
)   


# =====================================================
# DATABASE INITIALIZATION
# =====================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


# =====================================================
# FASTAPI APPLICATION
# =====================================================

app = FastAPI(
    title="WorkSphere - HR Management System",
    description="HR Management System API",
    version="1.2.0",
    lifespan=lifespan,
)


# =====================================================
# CORS CONFIGURATION
# =====================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =====================================================
# HOME API
# =====================================================

@app.get("/")
def home():
    return {
        "message": "Welcome to WorkSphere HRMS API",
        "status": "running",
    }


# =====================================================
# USER REGISTRATION
# =====================================================

@app.post(
    "/auth/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
def register_user(
    user_data: UserRegister,
    db: Session = Depends(get_db),
):
    username = user_data.username.strip()
    email = str(user_data.email).strip().lower()

    if not username:
        raise HTTPException(
            status_code=422,
            detail="Username cannot be empty.",
        )

    existing_user = db.query(User).filter(
        or_(
            User.username == username,
            User.email == email,
        )
    ).first()

    if existing_user:
        raise HTTPException(
            status_code=409,
            detail="Username or email already registered.",
        )

    new_user = User(
        username=username,
        email=email,
        hashed_password=hash_password(user_data.password),
        role="EMPLOYEE",
    )

    try:
        db.add(new_user)
        db.commit()
        db.refresh(new_user)

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Username or email already registered.",
        )

    return new_user


# =====================================================
# USER LOGIN
# =====================================================

@app.post(
    "/auth/login",
    response_model=TokenResponse,
)
def login_user(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    username = form_data.username.strip()

    user = db.query(User).filter(
        User.username == username
    ).first()

    if user is None or not verify_password(
        form_data.password,
        user.hashed_password,
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(user)

    return {
        "access_token": access_token,
        "token_type": "bearer",
    }


# =====================================================
# VIEW MY PROFILE
# =====================================================

@app.get(
    "/auth/me",
    response_model=UserProfileResponse,
)
def get_my_profile(
    current_user: User = Depends(get_current_user),
):
    return current_user


# =====================================================
# UPDATE MY PROFILE
# =====================================================

@app.put(
    "/auth/me",
    response_model=UserProfileResponse,
)
def update_my_profile(
    profile_data: UserProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    username = profile_data.username.strip()
    email = str(profile_data.email).strip().lower()

    if not username:
        raise HTTPException(
            status_code=422,
            detail="Username cannot be empty.",
        )

    existing_user = db.query(User).filter(
        User.id != current_user.id,
        or_(
            User.username == username,
            User.email == email,
        ),
    ).first()

    if existing_user:
        raise HTTPException(
            status_code=409,
            detail="Username or email is already used by another account.",
        )

    current_user.username = username
    current_user.email = email

    try:
        db.commit()
        db.refresh(current_user)

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Username or email is already registered.",
        )

    return current_user


# =====================================================
# DASHBOARD STATISTICS
# =====================================================

@app.get("/dashboard/statistics")
def dashboard_statistics(
    current_user: User = Depends(
        require_roles("HR", "ADMIN")
    ),
    db: Session = Depends(get_db),
):
    total_users = (
        db.query(func.count(User.id)).scalar() or 0
    )

    total_employees = (
        db.query(func.count(Employee.id)).scalar() or 0
    )

    total_hr = (
        db.query(func.count(User.id))
        .filter(User.role == "HR")
        .scalar() or 0
    )

    total_admins = (
        db.query(func.count(User.id))
        .filter(User.role == "ADMIN")
        .scalar() or 0
    )

    now = datetime.now(timezone.utc)

    today_start = now.replace(
        hour=0,
        minute=0,
        second=0,
        microsecond=0,
    )

    employees_registered_today = (
        db.query(func.count(Employee.id))
        .filter(
            Employee.created_at >= today_start.replace(
                tzinfo=None
            )
        )
        .scalar() or 0
    )

    return {
        "total_users": total_users,
        "total_employees": total_employees,
        "total_hr": total_hr,
        "total_admins": total_admins,
        "employees_registered_today": employees_registered_today,
        "generated_at": now.isoformat(),
        "requested_by": current_user.username,
    }


# =====================================================
# EMPLOYEE DASHBOARD
# =====================================================

@app.get("/employee/dashboard")
def employee_dashboard(
    current_user: User = Depends(
        require_roles("EMPLOYEE")
    ),
):
    return {
        "message": "Welcome to the Employee Dashboard",
        "username": current_user.username,
        "role": current_user.role,
    }


# =====================================================
# HR DASHBOARD
# =====================================================

@app.get("/hr/dashboard")
def hr_dashboard(
    current_user: User = Depends(
        require_roles("HR", "ADMIN")
    ),
):
    return {
        "message": "Welcome to the HR Dashboard",
        "username": current_user.username,
        "role": current_user.role,
    }


# =====================================================
# ADMIN DASHBOARD
# =====================================================

@app.get("/admin/dashboard")
def admin_dashboard(
    current_user: User = Depends(
        require_roles("ADMIN")
    ),
):
    return {
        "message": "Welcome to the Admin Dashboard",
        "username": current_user.username,
        "role": current_user.role,
    }


# =====================================================
# CREATE EMPLOYEE WITH LOGIN ACCOUNT
# HR / ADMIN ONLY
# =====================================================

@app.post(
    "/employees",
    response_model=EmployeeResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Employee Management"],
)
def create_employee(
    employee_data: EmployeeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("HR", "ADMIN")
    ),
):
    username = employee_data.username.strip()
    email = str(employee_data.email).strip().lower()
    employee_code = employee_data.employee_code.strip()

    # Check username and email together.
    existing_user = db.query(User).filter(
        or_(
            User.username == username,
            User.email == email,
        )
    ).first()

    if existing_user:
        if existing_user.username == username:
            raise HTTPException(
                status_code=409,
                detail="Username already exists.",
            )

        raise HTTPException(
            status_code=409,
            detail="Email already exists.",
        )

    # Check employee code.
    existing_employee = db.query(Employee).filter(
        Employee.employee_code == employee_code
    ).first()

    if existing_employee:
        raise HTTPException(
            status_code=409,
            detail="Employee code already exists.",
        )

    try:
        # 1. Create the employee's login account.
        new_user = User(
            username=username,
            email=email,
            hashed_password=hash_password(
                employee_data.password
            ),
            role="EMPLOYEE",
        )

        db.add(new_user)

        # Obtain the new user ID without committing yet.
        db.flush()

        # 2. Create the employee record linked to that account.
        new_employee = Employee(
            employee_code=employee_code,
            user_id=new_user.id,
            full_name=employee_data.full_name,
            department=employee_data.department,
            designation=employee_data.designation,
            joining_date=employee_data.joining_date,
            salary=employee_data.salary,
            employment_status=employee_data.employment_status,
        )

        db.add(new_employee)

        # Save both records in the same transaction.
        db.commit()
        db.refresh(new_employee)

        return new_employee

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail=(
                "Username, email, or employee code already exists."
            ),
        )

    except Exception:
        db.rollback()
        raise


# =====================================================
# LIST, SEARCH, AND FILTER EMPLOYEES
# =====================================================

@app.get(
    "/employees",
    response_model=list[EmployeeResponse],
    tags=["Employee Management"],
)
def get_employees(
    search: str | None = None,
    department: str | None = None,
    employment_status: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Employee)

    # Employees can see only their own linked record.
    if current_user.role == "EMPLOYEE":
        query = query.filter(
            Employee.user_id == current_user.id
        )

    if search:
        search_term = f"%{search.strip()}%"

        query = query.filter(
            or_(
                Employee.full_name.ilike(search_term),
                Employee.employee_code.ilike(search_term),
                Employee.department.ilike(search_term),
                Employee.designation.ilike(search_term),
            )
        )

    if department:
        query = query.filter(
            Employee.department.ilike(department.strip())
        )

    if employment_status:
        allowed_statuses = {
            "ACTIVE",
            "INACTIVE",
            "ON_LEAVE",
            "TERMINATED",
        }

        normalized_status = employment_status.upper()

        if normalized_status not in allowed_statuses:
            raise HTTPException(
                status_code=422,
                detail="Invalid employment status.",
            )

        query = query.filter(
            Employee.employment_status == normalized_status
        )

    return query.order_by(Employee.id.desc()).all()


# =====================================================
# GET ONE EMPLOYEE
# =====================================================

@app.get(
    "/employees/{employee_id}",
    response_model=EmployeeResponse,
    tags=["Employee Management"],
)
def get_employee(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    employee = db.query(Employee).filter(
        Employee.id == employee_id
    ).first()

    if employee is None:
        raise HTTPException(
            status_code=404,
            detail="Employee not found.",
        )

    if (
        current_user.role == "EMPLOYEE"
        and employee.user_id != current_user.id
    ):
        raise HTTPException(
            status_code=403,
            detail="You can only view your own employee record.",
        )

    return employee


# =====================================================
# UPDATE EMPLOYEE
# HR / ADMIN ONLY
# =====================================================

@app.put(
    "/employees/{employee_id}",
    response_model=EmployeeResponse,
    tags=["Employee Management"],
)
def update_employee(
    employee_id: int,
    employee_data: EmployeeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("HR", "ADMIN")
    ),
):
    employee = db.query(Employee).filter(
        Employee.id == employee_id
    ).first()

    if employee is None:
        raise HTTPException(
            status_code=404,
            detail="Employee not found.",
        )

    # Prevent duplicate employee codes.
    duplicate_code = db.query(Employee).filter(
        Employee.employee_code == employee_data.employee_code,
        Employee.id != employee_id,
    ).first()

    if duplicate_code:
        raise HTTPException(
            status_code=409,
            detail="Employee code already exists.",
        )

    # Validate any explicitly supplied user link.
    if employee_data.user_id is not None:
        linked_user = db.query(User).filter(
            User.id == employee_data.user_id
        ).first()

        if linked_user is None:
            raise HTTPException(
                status_code=404,
                detail="The specified user account was not found.",
            )

        duplicate_link = db.query(Employee).filter(
            Employee.user_id == employee_data.user_id,
            Employee.id != employee_id,
        ).first()

        if duplicate_link:
            raise HTTPException(
                status_code=409,
                detail="This user account is already linked to another employee.",
            )

    for field, value in employee_data.model_dump().items():
        setattr(employee, field, value)

    try:
        db.commit()
        db.refresh(employee)
        return employee

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Employee code or linked user account already exists.",
        )


# =====================================================
# DELETE EMPLOYEE
# HR / ADMIN ONLY
# =====================================================

@app.delete(
    "/employees/{employee_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["Employee Management"],
)
def delete_employee(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("HR", "ADMIN")
    ),
):
    employee = db.query(Employee).filter(
        Employee.id == employee_id
    ).first()

    if employee is None:
        raise HTTPException(
            status_code=404,
            detail="Employee not found.",
        )

    db.delete(employee)
    db.commit()

    return None

# =====================================================
# ATTENDANCE MANAGEMENT
# =====================================================

ATTENDANCE_HALF_DAY_HOURS = 4.0


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

@app.post(
    "/attendance/check-in",
    response_model=AttendanceResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Attendance Management"],
)
def attendance_check_in(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("EMPLOYEE")
    ),
):
    employee = get_linked_employee(db, current_user)

    today = date.today()
    now = datetime.now(timezone.utc)

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
    )

    # Create notification for the employee.
    notification = Notification(
        user_id=current_user.id,
        title="Attendance Check-in Recorded",
        message=(
            f"Your attendance check-in for {today} "
            "was recorded successfully."
        ),
        is_read=0,
    )

    try:
        # Save attendance and notification together.
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

@app.post(
    "/attendance/check-out",
    response_model=AttendanceResponse,
    tags=["Attendance Management"],
)
def attendance_check_out(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("EMPLOYEE")
    ),
):
    employee = get_linked_employee(db, current_user)

    today = date.today()
    now = datetime.now(timezone.utc)

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

    # SQLite may return a naive datetime even when the
    # column was configured with timezone=True.
    if check_in.tzinfo is None:
        check_in = check_in.replace(tzinfo=timezone.utc)

    elapsed_seconds = (
        now - check_in
    ).total_seconds()

    if elapsed_seconds < 0:
        raise HTTPException(
            status_code=400,
            detail="Check-out time cannot precede check-in time.",
        )

    hours = elapsed_seconds / 3600

    attendance.check_out = now
    attendance.working_hours = Decimal(
        f"{hours:.2f}"
    )

    if hours < ATTENDANCE_HALF_DAY_HOURS:
        attendance.status = "HALF_DAY"
    else:
        attendance.status = "PRESENT"

    db.commit()
    db.refresh(attendance)

    return attendance


# =====================================================
# MY ATTENDANCE HISTORY
# EMPLOYEE ONLY
# =====================================================

@app.get(
    "/attendance/my",
    response_model=list[AttendanceResponse],
    tags=["Attendance Management"],
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
# VIEW ALL ATTENDANCE
# HR / ADMIN ONLY
# =====================================================

@app.get(
    "/attendance",
    response_model=list[AttendanceResponse],
    tags=["Attendance Management"],
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

@app.get(
    "/attendance/{attendance_id}",
    response_model=AttendanceResponse,
    tags=["Attendance Management"],
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


# =====================================================
# MODULE 4: LEAVE MANAGEMENT
# =====================================================

from datetime import date


VALID_LEAVE_TYPES = {"SICK", "CASUAL", "PAID"}
VALID_LEAVE_STATUSES = {"PENDING", "APPROVED", "REJECTED"}


def calculate_leave_days(start_date: date, end_date: date) -> int:
    """Calculate leave duration, including both start and end dates."""
    return (end_date - start_date).days + 1


# -----------------------------------------------------
# EMPLOYEE: APPLY FOR LEAVE
# -----------------------------------------------------

@app.post(
    "/leaves",
    response_model=LeaveResponse,
    status_code=201,
    tags=["Leave Management"],
)
def apply_for_leave(
    leave_data: LeaveCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("EMPLOYEE")),
):
    employee = db.query(Employee).filter(
        Employee.user_id == current_user.id
    ).first()

    if employee is None:
        raise HTTPException(
            status_code=404,
            detail="No employee record is linked to this account.",
        )

    if employee.employment_status != "ACTIVE":
        raise HTTPException(
            status_code=403,
            detail="Only active employees can apply for leave.",
        )

    if leave_data.end_date < leave_data.start_date:
        raise HTTPException(
            status_code=400,
            detail="End date cannot be before start date.",
        )

    if leave_data.start_date < date.today():
        raise HTTPException(
            status_code=400,
            detail="Leave cannot be applied for past dates.",
        )

    leave = Leave(
        employee_id=employee.id,
        leave_type=leave_data.leave_type,
        start_date=leave_data.start_date,
        end_date=leave_data.end_date,
        reason=leave_data.reason.strip(),
        status="PENDING",
    )

    db.add(leave)
    db.commit()
    db.refresh(leave)

    return leave


# -----------------------------------------------------
# EMPLOYEE: VIEW OWN LEAVE REQUESTS
# -----------------------------------------------------

@app.get(
    "/leaves/my",
    response_model=list[LeaveResponse],
    tags=["Leave Management"],
)
def get_my_leaves(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("EMPLOYEE")),
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
        db.query(Leave)
        .filter(Leave.employee_id == employee.id)
        .order_by(Leave.applied_at.desc(), Leave.id.desc())
        .all()
    )


# -----------------------------------------------------
# HR / ADMIN: VIEW ALL LEAVE REQUESTS
# -----------------------------------------------------

@app.get(
    "/leaves",
    response_model=list[LeaveResponse],
    tags=["Leave Management"],
)
def get_all_leaves(
    leave_status: LeaveStatus | None = None,
    employee_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("HR", "ADMIN")),
):
    query = db.query(Leave)

    if leave_status is not None:
        query = query.filter(Leave.status == leave_status)

    if employee_id is not None:
        query = query.filter(Leave.employee_id == employee_id)

    return query.order_by(
        Leave.applied_at.desc(),
        Leave.id.desc(),
    ).all()


# -----------------------------------------------------
# HR / ADMIN: REVIEW A LEAVE REQUEST
# -----------------------------------------------------

@app.patch(
    "/leaves/{leave_id}/review",
    response_model=LeaveResponse,
    tags=["Leave Management"],
)
def review_leave(
    leave_id: int,
    review_data: LeaveReview,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("HR", "ADMIN")),
):
    leave = db.query(Leave).filter(
        Leave.id == leave_id
    ).first()

    if leave is None:
        raise HTTPException(
            status_code=404,
            detail="Leave request not found.",
        )

    if leave.status != "PENDING":
        raise HTTPException(
            status_code=409,
            detail="Only pending leave requests can be reviewed.",
        )

    # Check for overlapping approved leave.
    if review_data.status == "APPROVED":
        overlapping_leave = (
            db.query(Leave)
            .filter(
                Leave.employee_id == leave.employee_id,
                Leave.id != leave.id,
                Leave.status == "APPROVED",
                Leave.start_date <= leave.end_date,
                Leave.end_date >= leave.start_date,
            )
            .first()
        )

        if overlapping_leave:
            raise HTTPException(
                status_code=409,
                detail=(
                    "This employee already has approved leave "
                    "for overlapping dates."
                ),
            )

    # Find the user account linked to the employee.
    employee = db.query(Employee).filter(
        Employee.id == leave.employee_id
    ).first()

    if employee is None:
        raise HTTPException(
            status_code=404,
            detail="Employee record not found.",
        )

    if employee.user_id is None:
        raise HTTPException(
            status_code=400,
            detail="This employee has no linked user account.",
        )

    # Update the leave request.
    leave.status = review_data.status
    leave.reviewed_by = current_user.id
    leave.reviewed_at = datetime.now(timezone.utc)

    leave.review_comment = (
        review_data.review_comment.strip()
        if review_data.review_comment
        else None
    )

    # Create the employee notification.
    if review_data.status == "APPROVED":
        notification_title = "Leave Request Approved"
        notification_message = (
            f"Your {leave.leave_type.lower()} leave request "
            f"from {leave.start_date} to {leave.end_date} "
            "has been approved."
        )
    else:
        notification_title = "Leave Request Rejected"
        notification_message = (
            f"Your {leave.leave_type.lower()} leave request "
            f"from {leave.start_date} to {leave.end_date} "
            "has been rejected."
        )

    if leave.review_comment:
        notification_message += (
            f" Review comment: {leave.review_comment}"
        )

    notification = Notification(
        user_id=employee.user_id,
        title=notification_title,
        message=notification_message,
        is_read=0,
    )

    try:
        db.add(notification)
        db.commit()
        db.refresh(leave)

    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Unable to review leave and create notification.",
        )

    return leave


# -----------------------------------------------------
# HR / ADMIN: VIEW A SPECIFIC LEAVE REQUEST
# -----------------------------------------------------

@app.get(
    "/leaves/{leave_id}",
    response_model=LeaveResponse,
    tags=["Leave Management"],
)
def get_leave_by_id(
    leave_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("HR", "ADMIN")),
):
    leave = db.query(Leave).filter(Leave.id == leave_id).first()

    if leave is None:
        raise HTTPException(
            status_code=404,
            detail="Leave request not found.",
        )

    return leave

# =====================================================
# MODULE 5: PAYROLL MANAGEMENT
# =====================================================

from decimal import Decimal
from datetime import date

from fastapi import HTTPException, Depends
from sqlalchemy.orm import Session

from database import get_db
from models import User, Employee, Payroll
from schemas import PayrollCreate, PayrollResponse


# =====================================================
# GENERATE MONTHLY PAYROLL
# HR / ADMIN ONLY
# WITH EMPLOYEE NOTIFICATION
# =====================================================

@app.post(
    "/payroll",
    response_model=PayrollResponse,
    status_code=201,
    tags=["Payroll Management"],
)
def generate_payroll(
    payroll_data: PayrollCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Only HR and ADMIN can generate payroll.
    if current_user.role not in ["HR", "ADMIN"]:
        raise HTTPException(
            status_code=403,
            detail="Only HR and ADMIN can generate payroll.",
        )

    # Find the employee.
    employee = (
        db.query(Employee)
        .filter(
            Employee.id == payroll_data.employee_id
        )
        .first()
    )

    if employee is None:
        raise HTTPException(
            status_code=404,
            detail="Employee not found.",
        )

    # Prevent duplicate payroll for the same month.
    existing_payroll = (
        db.query(Payroll)
        .filter(
            Payroll.employee_id == payroll_data.employee_id,
            Payroll.month == payroll_data.month,
            Payroll.year == payroll_data.year,
        )
        .first()
    )

    if existing_payroll:
        raise HTTPException(
            status_code=409,
            detail="Payroll already exists for this employee and month.",
        )

    # Salary components.
    basic_salary = payroll_data.basic_salary
    hra = payroll_data.hra
    da = payroll_data.da
    other_allowances = payroll_data.other_allowances

    pf_deduction = payroll_data.pf_deduction
    tax_deduction = payroll_data.tax_deduction
    other_deductions = payroll_data.other_deductions

    # Calculate gross salary.
    gross_salary = (
        basic_salary
        + hra
        + da
        + other_allowances
    )

    # Calculate total deductions.
    total_deductions = (
        pf_deduction
        + tax_deduction
        + other_deductions
    )

    if total_deductions > gross_salary:
        raise HTTPException(
            status_code=400,
            detail="Total deductions cannot exceed gross salary.",
        )

    # Calculate net salary.
    net_salary = gross_salary - total_deductions

    # Create payroll record.
    new_payroll = Payroll(
        employee_id=payroll_data.employee_id,
        month=payroll_data.month,
        year=payroll_data.year,
        basic_salary=basic_salary,
        hra=hra,
        da=da,
        other_allowances=other_allowances,
        gross_salary=gross_salary,
        pf_deduction=pf_deduction,
        tax_deduction=tax_deduction,
        other_deductions=other_deductions,
        total_deductions=total_deductions,
        net_salary=net_salary,
        status="PENDING",
        payment_date=None,
        generated_by=current_user.id,
    )

    try:
        # Save payroll.
        db.add(new_payroll)

        # Create a notification if the employee has
        # a linked login account.
        if employee.user_id is not None:
            notification = Notification(
                user_id=employee.user_id,
                title="Payroll Generated",
                message=(
                    f"Your payroll for "
                    f"{payroll_data.month}/{payroll_data.year} "
                    "has been generated successfully."
                ),
                is_read=0,
            )

            db.add(notification)

        # Save payroll and notification together.
        db.commit()
        db.refresh(new_payroll)

    except Exception:
        db.rollback()

        raise HTTPException(
            status_code=500,
            detail="Unable to generate payroll and notification.",
        )

    return new_payroll

# =====================================================
# GET MY PAYROLL HISTORY — EMPLOYEE
# =====================================================

@app.get(
    "/payroll/my",
    response_model=list[PayrollResponse],
    tags=["Payroll Management"],
)
def get_my_payroll(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Only employees can access their own payroll history.
    if current_user.role != "EMPLOYEE":
        raise HTTPException(
            status_code=403,
            detail="Only employees can access their own payroll history.",
        )

    # Find the employee linked to the logged-in user.
    employee = (
        db.query(Employee)
        .filter(Employee.user_id == current_user.id)
        .first()
    )

    if not employee:
        raise HTTPException(
            status_code=404,
            detail="No employee profile is linked to this account.",
        )

    # Return this employee's payroll history.
    payroll_records = (
        db.query(Payroll)
        .filter(Payroll.employee_id == employee.id)
        .order_by(
            Payroll.year.desc(),
            Payroll.month.desc(),
        )
        .all()
    )

    return payroll_records


# =====================================================
# GET ALL PAYROLL RECORDS — HR / ADMIN
# =====================================================

@app.get(
    "/payroll",
    response_model=list[PayrollResponse],
    tags=["Payroll Management"],
)
def get_all_payroll(
    employee_id: int | None = None,
    payroll_month: int | None = None,
    payroll_year: int | None = None,
    payroll_status: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Only HR and ADMIN can view all payroll records.
    if current_user.role not in ["HR", "ADMIN"]:
        raise HTTPException(
            status_code=403,
            detail="Only HR and ADMIN can view all payroll records.",
        )

    query = db.query(Payroll)

    # Optional employee filter.
    if employee_id is not None:
        query = query.filter(
            Payroll.employee_id == employee_id
        )

    # Optional month filter.
    if payroll_month is not None:
        if payroll_month < 1 or payroll_month > 12:
            raise HTTPException(
                status_code=400,
                detail="Month must be between 1 and 12.",
            )

        query = query.filter(
            Payroll.month == payroll_month
        )

    # Optional year filter.
    if payroll_year is not None:
        query = query.filter(
            Payroll.year == payroll_year
        )

    # Optional status filter.
    if payroll_status is not None:
        normalized_status = payroll_status.upper()

        if normalized_status not in ["PENDING", "PAID"]:
            raise HTTPException(
                status_code=400,
                detail="Status must be PENDING or PAID.",
            )

        query = query.filter(
            Payroll.status == normalized_status
        )

    # Return newest payroll records first.
    return query.order_by(
        Payroll.year.desc(),
        Payroll.month.desc(),
        Payroll.id.desc(),
    ).all()

# =====================================================
# MARK PAYROLL AS PAID
# HR / ADMIN ONLY
# WITH EMPLOYEE NOTIFICATION
# =====================================================

@app.patch(
    "/payroll/{payroll_id}/payment",
    response_model=PayrollResponse,
    tags=["Payroll Management"],
)
def mark_payroll_as_paid(
    payroll_id: int,
    payment_data: PayrollPaymentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Only HR and ADMIN can update payroll.
    if current_user.role not in ["HR", "ADMIN"]:
        raise HTTPException(
            status_code=403,
            detail="Only HR and ADMIN can update payroll payment status.",
        )

    # Find the payroll record.
    payroll = (
        db.query(Payroll)
        .filter(Payroll.id == payroll_id)
        .first()
    )

    if payroll is None:
        raise HTTPException(
            status_code=404,
            detail="Payroll record not found.",
        )

    # Prevent duplicate payment updates.
    if payroll.status == "PAID":
        raise HTTPException(
            status_code=400,
            detail="This payroll has already been marked as paid.",
        )

    # Find the employee linked to this payroll.
    employee = (
        db.query(Employee)
        .filter(Employee.id == payroll.employee_id)
        .first()
    )

    # Update payment details.
    payroll.status = "PAID"
    payroll.payment_date = (
        payment_data.payment_date or date.today()
    )

    try:
        # Notify the employee if a linked account exists.
        if employee is not None and employee.user_id is not None:
            notification = Notification(
                user_id=employee.user_id,
                title="Salary Payment Completed",
                message=(
                    f"Your salary for "
                    f"{payroll.month}/{payroll.year} "
                    f"has been marked as paid. "
                    f"Net salary: {payroll.net_salary}."
                ),
                is_read=0,
            )

            db.add(notification)

        # Save payment status and notification together.
        db.commit()
        db.refresh(payroll)

    except Exception:
        db.rollback()

        raise HTTPException(
            status_code=500,
            detail="Unable to update payroll payment and notification.",
        )

    return payroll


# =====================================================
# MODULE 7: NOTIFICATION SYSTEM
# =====================================================


# =====================================================
# GET MY NOTIFICATIONS
# ALL AUTHENTICATED USERS
# =====================================================

@app.get(
    "/notifications",
    response_model=list[NotificationResponse],
    tags=["Notification Management"],
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

@app.get(
    "/notifications/unread-count",
    tags=["Notification Management"],
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

@app.patch(
    "/notifications/{notification_id}/read",
    response_model=NotificationResponse,
    tags=["Notification Management"],
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

@app.patch(
    "/notifications/read-all",
    tags=["Notification Management"],
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