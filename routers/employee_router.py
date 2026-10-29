
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import exists, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from auth import (
    get_current_user,
    hash_password,
    require_roles,
)
from database import get_db
from models import (
    User,
    Employee,
    Attendance,
    Performance,
)
from schemas import (
    EmployeeCreate,
    EmployeeUpdate,
    EmployeeResponse,
)


router = APIRouter(
    tags=["Employee Management"],
)


# =====================================================
# CREATE EMPLOYEE WITH LOGIN ACCOUNT
# HR / ADMIN ONLY
# =====================================================

@router.post(
    "/employees",
    response_model=EmployeeResponse,
    status_code=status.HTTP_201_CREATED,
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

    existing_employee = db.query(Employee).filter(
        Employee.employee_code == employee_code
    ).first()

    if existing_employee:
        raise HTTPException(
            status_code=409,
            detail="Employee code already exists.",
        )

    try:
        new_user = User(
            username=username,
            email=email,
            hashed_password=hash_password(
                employee_data.password
            ),
            role="EMPLOYEE",
        )

        db.add(new_user)
        db.flush()

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
        db.commit()
        db.refresh(new_employee)

        return new_employee

    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=409,
            detail=(
                "Username, email, or employee code "
                "already exists."
            ),
        )

    except Exception:
        db.rollback()
        raise


# =====================================================
# LIST, SEARCH, AND ADVANCED FILTER EMPLOYEES
# MODULE 20
# =====================================================

@router.get(
    "/employees",
    response_model=list[EmployeeResponse],
)
def get_employees(
    search: str | None = None,
    department: str | None = None,
    employment_status: str | None = None,
    role: str | None = None,
    attendance_status: str | None = None,
    performance_rating: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Employee)

    # -------------------------------------------------
    # ROLE-BASED ACCESS CONTROL
    # Employees can only see their own employee record.
    # -------------------------------------------------

    if current_user.role == "EMPLOYEE":
        query = query.filter(
            Employee.user_id == current_user.id
        )

    # -------------------------------------------------
    # SEARCH BY NAME, EMPLOYEE CODE, DEPARTMENT,
    # OR DESIGNATION
    # -------------------------------------------------

    if search and search.strip():
        search_term = f"%{search.strip()}%"

        query = query.filter(
            or_(
                Employee.full_name.ilike(search_term),
                Employee.employee_code.ilike(search_term),
                Employee.department.ilike(search_term),
                Employee.designation.ilike(search_term),
            )
        )

    # -------------------------------------------------
    # FILTER BY DEPARTMENT
    # -------------------------------------------------

    if department and department.strip():
        query = query.filter(
            Employee.department.ilike(
                department.strip()
            )
        )

    # -------------------------------------------------
    # FILTER BY EMPLOYMENT STATUS
    # -------------------------------------------------

    if employment_status and employment_status.strip():
        allowed_statuses = {
            "ACTIVE",
            "INACTIVE",
            "ON_LEAVE",
            "TERMINATED",
        }

        normalized_status = employment_status.strip().upper()

        if normalized_status not in allowed_statuses:
            raise HTTPException(
                status_code=422,
                detail=(
                    "Invalid employment status. "
                    "Allowed values: ACTIVE, INACTIVE, "
                    "ON_LEAVE, TERMINATED."
                ),
            )

        query = query.filter(
            Employee.employment_status == normalized_status
        )

    # -------------------------------------------------
    # FILTER BY USER ROLE
    # Allowed values: EMPLOYEE, HR, ADMIN
    # -------------------------------------------------

    if role and role.strip():
        allowed_roles = {
            "EMPLOYEE",
            "HR",
            "ADMIN",
        }

        normalized_role = role.strip().upper()

        if normalized_role not in allowed_roles:
            raise HTTPException(
                status_code=422,
                detail=(
                    "Invalid role. "
                    "Allowed values: EMPLOYEE, HR, ADMIN."
                ),
            )

        # Match the employee's linked user account.
        # Employees without a linked account are excluded.
        query = query.filter(
            Employee.user_id == User.id,
            User.role == normalized_role,
        )

    # -------------------------------------------------
    # FILTER BY ATTENDANCE STATUS
    # Allowed values: PRESENT, ABSENT
    #
    # Returns employees with at least one matching
    # attendance record.
    # -------------------------------------------------

    if attendance_status and attendance_status.strip():
        allowed_attendance_statuses = {
            "PRESENT",
            "ABSENT",
        }

        normalized_attendance_status = (
            attendance_status.strip().upper()
        )

        if (
            normalized_attendance_status
            not in allowed_attendance_statuses
        ):
            raise HTTPException(
                status_code=422,
                detail=(
                    "Invalid attendance status. "
                    "Allowed values: PRESENT, ABSENT."
                ),
            )

        attendance_exists = exists(
            select(Attendance.id).where(
                Attendance.employee_id == Employee.id,
                Attendance.status == normalized_attendance_status,
            )
        )

        query = query.filter(attendance_exists)

    # -------------------------------------------------
    # FILTER BY PERFORMANCE RATING
    # Allowed values: 1, 2, 3, 4, 5
    #
    # Returns employees with at least one review
    # matching the selected rating.
    # -------------------------------------------------

    if performance_rating is not None:
        if not 1 <= performance_rating <= 5:
            raise HTTPException(
                status_code=422,
                detail=(
                    "Performance rating must be "
                    "between 1 and 5."
                ),
            )

        performance_exists = exists(
            select(Performance.id).where(
                Performance.employee_id == Employee.id,
                Performance.rating == performance_rating,
            )
        )

        query = query.filter(performance_exists)

    # -------------------------------------------------
    # RETURN EMPLOYEES
    # -------------------------------------------------

    return query.order_by(
        Employee.id.desc()
    ).all()


# =====================================================
# GET ONE EMPLOYEE
# =====================================================

@router.get(
    "/employees/{employee_id}",
    response_model=EmployeeResponse,
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
            detail=(
                "You can only view your own employee record."
            ),
        )

    return employee


# =====================================================
# UPDATE EMPLOYEE
# HR / ADMIN ONLY
# =====================================================

@router.put(
    "/employees/{employee_id}",
    response_model=EmployeeResponse,
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

    duplicate_code = db.query(Employee).filter(
        Employee.employee_code == employee_data.employee_code,
        Employee.id != employee_id,
    ).first()

    if duplicate_code:
        raise HTTPException(
            status_code=409,
            detail="Employee code already exists.",
        )

    if employee_data.user_id is not None:
        linked_user = db.query(User).filter(
            User.id == employee_data.user_id
        ).first()

        if linked_user is None:
            raise HTTPException(
                status_code=404,
                detail=(
                    "The specified user account was not found."
                ),
            )

        duplicate_link = db.query(Employee).filter(
            Employee.user_id == employee_data.user_id,
            Employee.id != employee_id,
        ).first()

        if duplicate_link:
            raise HTTPException(
                status_code=409,
                detail=(
                    "This user account is already linked "
                    "to another employee."
                ),
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
            detail=(
                "Employee code or linked user account "
                "already exists."
            ),
        )


# =====================================================
# DELETE EMPLOYEE
# HR / ADMIN ONLY
# =====================================================

@router.delete(
    "/employees/{employee_id}",
    status_code=status.HTTP_204_NO_CONTENT,
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
