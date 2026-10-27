
from calendar import monthrange
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import Employee, Leave, User


router = APIRouter(
    prefix="/leave-calendar",
    tags=["Leave Calendar & Team View"],
)


# =====================================================
# HELPER: GET ACTIVE EMPLOYEES
# =====================================================

def get_active_employees(db: Session):
    return (
        db.query(Employee)
        .filter(
            Employee.employment_status == "ACTIVE"
        )
        .order_by(Employee.full_name.asc())
        .all()
    )


# =====================================================
# HELPER: CHECK HR / ADMIN
# =====================================================

def is_hr_or_admin(current_user: User) -> bool:
    role = str(
        current_user.role or ""
    ).upper()

    return role in {"HR", "ADMIN"}


# =====================================================
# HELPER: GET CURRENT USER'S EMPLOYEE RECORD
# =====================================================

def get_current_employee(
    db: Session,
    current_user: User,
):
    employee = (
        db.query(Employee)
        .filter(
            Employee.user_id == current_user.id,
            Employee.employment_status == "ACTIVE",
        )
        .first()
    )

    return employee


# =====================================================
# MODULE 15: LEAVE CALENDAR
#
# EMPLOYEE:
#   Only own approved leaves.
#
# HR / ADMIN:
#   All approved employee leaves.
# =====================================================

@router.get("")
def get_leave_calendar(
    start_date: date | None = Query(
        default=None,
        description="Calendar start date in YYYY-MM-DD format",
    ),
    end_date: date | None = Query(
        default=None,
        description="Calendar end date in YYYY-MM-DD format",
    ),
    department: str | None = Query(
        default=None,
        description="Optional department filter",
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    today = date.today()

    # -------------------------------------------------
    # DEFAULT DATE RANGE
    # -------------------------------------------------

    if start_date is None:
        start_date = today.replace(day=1)

    if end_date is None:
        last_day = monthrange(
            today.year,
            today.month,
        )[1]

        end_date = today.replace(
            day=last_day
        )

    if start_date > end_date:
        raise HTTPException(
            status_code=400,
            detail="Start date cannot be after end date.",
        )

  # -------------------------------------------------
  # EMPLOYEE ACCESS
  # -------------------------------------------------

    if not is_hr_or_admin(current_user):

        employee_query = db.query(Employee).filter(
            Employee.employment_status == "ACTIVE"
        )

        # Employees can see all departments in this view.
        # Do not apply the department filter to employees.
        employees = employee_query.order_by(
            Employee.full_name.asc()
        ).all()

        employee_map = {
            employee.id: employee
            for employee in employees
        }

        employee_ids = list(employee_map.keys())

        if not employee_ids:
            return {
                "start_date": start_date,
                "end_date": end_date,
                "total_events": 0,
                "items": [],
            }

        leaves = (
            db.query(Leave)
            .filter(
                Leave.employee_id.in_(employee_ids),
                Leave.status == "APPROVED",
                Leave.start_date <= end_date,
                Leave.end_date >= start_date,
            )
            .order_by(
                Leave.start_date.asc(),
                Leave.end_date.asc(),
            )
            .all()
        )

        items = []

        for leave in leaves:
            employee = employee_map.get(
                leave.employee_id
            )

            if employee is None:
                continue

            items.append(
                {
                    "leave_id": leave.id,
                    "employee_id": employee.id,
                    "employee_name": employee.full_name,
                    "department": employee.department,
                    "start_date": leave.start_date,
                    "end_date": leave.end_date,
                    "status": leave.status,
                }
            )

        return {
            "start_date": start_date,
            "end_date": end_date,
            "total_events": len(items),
            "items": items,
        }

    # -------------------------------------------------
    # HR / ADMIN ACCESS
    # -------------------------------------------------

    employee_query = db.query(Employee).filter(
        Employee.employment_status == "ACTIVE"
    )

    if department and department.strip():
        employee_query = employee_query.filter(
            Employee.department.ilike(
                department.strip()
            )
        )

    employees = employee_query.order_by(
        Employee.full_name.asc()
    ).all()

    employee_ids = [
        employee.id
        for employee in employees
    ]

    if not employee_ids:
        return {
            "start_date": start_date,
            "end_date": end_date,
            "total_events": 0,
            "items": [],
        }

    leaves = (
        db.query(Leave)
        .filter(
            Leave.employee_id.in_(employee_ids),
            Leave.status == "APPROVED",
            Leave.start_date <= end_date,
            Leave.end_date >= start_date,
        )
        .order_by(
            Leave.start_date.asc(),
            Leave.end_date.asc(),
        )
        .all()
    )

    employee_map = {
        employee.id: employee
        for employee in employees
    }

    items = []

    for leave in leaves:
        employee = employee_map.get(
            leave.employee_id
        )

        if employee is None:
            continue

        items.append(
            {
                "leave_id": leave.id,
                "employee_id": employee.id,
                "employee_name": employee.full_name,
                "employee_code": employee.employee_code,
                "department": employee.department,
                "leave_type": leave.leave_type,
                "start_date": leave.start_date,
                "end_date": leave.end_date,
                "status": leave.status,
                "reason": leave.reason,
            }
        )

    return {
        "start_date": start_date,
        "end_date": end_date,
        "total_events": len(items),
        "items": items,
    }


# =====================================================
# MODULE 15: TEAM AVAILABILITY
#
# EMPLOYEE:
#   Only aggregate availability information.
#   No coworker names are exposed.
#
# HR / ADMIN:
#   Full team availability details.
# =====================================================

@router.get("/team-availability")
def get_team_availability(
    selected_date: date | None = Query(
        default=None,
        description="Date to check in YYYY-MM-DD format",
    ),
    department: str | None = Query(
        default=None,
        description="Optional department filter",
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if selected_date is None:
        selected_date = date.today()

    # -------------------------------------------------
    # EMPLOYEE ACCESS
    # Show team availability counts and names of
    # employees on approved leave across departments.
    # Do not expose leave reasons or leave types.
    # -------------------------------------------------

    if not is_hr_or_admin(current_user):

        employees = (
            db.query(Employee)
            .filter(
                Employee.employment_status == "ACTIVE"
            )
            .order_by(Employee.full_name.asc())
            .all()
        )

        employee_ids = [
            employee.id
            for employee in employees
        ]

        approved_leaves = []

        if employee_ids:
            approved_leaves = (
                db.query(Leave)
                .filter(
                    Leave.employee_id.in_(employee_ids),
                    Leave.status == "APPROVED",
                    Leave.start_date <= selected_date,
                    Leave.end_date >= selected_date,
                )
                .all()
            )

        leave_employee_ids = {
            leave.employee_id
            for leave in approved_leaves
        }

        employees_on_leave = []
        available_employees = []

        for employee in employees:
            employee_info = {
                "employee_id": employee.id,
                "employee_name": employee.full_name,
                "department": employee.department,
            }

            if employee.id in leave_employee_ids:
                employees_on_leave.append(
                    employee_info
                )
            else:
                available_employees.append(
                    employee_info
                )

        total_employees = len(employees)
        on_leave_count = len(employees_on_leave)

        return {
            "selected_date": selected_date,
            "department": None,
            "total_active_employees": total_employees,
            "employees_on_leave": on_leave_count,
            "available_employees": (
                total_employees - on_leave_count
            ),
            "leave_percentage": (
                round(
                    on_leave_count / total_employees * 100,
                    2,
                )
                if total_employees
                else 0
            ),
            "on_leave": employees_on_leave,
            "available": available_employees,
        }
    
    # -------------------------------------------------
    # HR / ADMIN ACCESS
    # -------------------------------------------------

    employee_query = db.query(Employee).filter(
        Employee.employment_status == "ACTIVE"
    )

    if department and department.strip():
        employee_query = employee_query.filter(
            Employee.department.ilike(
                department.strip()
            )
        )

    employees = employee_query.order_by(
        Employee.full_name.asc()
    ).all()

    employee_ids = [
        employee.id
        for employee in employees
    ]

    leave_employee_ids = set()

    if employee_ids:
        approved_leaves = (
            db.query(Leave)
            .filter(
                Leave.employee_id.in_(employee_ids),
                Leave.status == "APPROVED",
                Leave.start_date <= selected_date,
                Leave.end_date >= selected_date,
            )
            .all()
        )

        leave_employee_ids = {
            leave.employee_id
            for leave in approved_leaves
        }

    employees_on_leave = []
    available_employees = []

    for employee in employees:
        employee_info = {
            "employee_id": employee.id,
            "employee_name": employee.full_name,
            "employee_code": employee.employee_code,
            "department": employee.department,
            "designation": employee.designation,
        }

        if employee.id in leave_employee_ids:
            employees_on_leave.append(
                employee_info
            )
        else:
            available_employees.append(
                employee_info
            )

    total_employees = len(employees)

    on_leave_count = len(
        employees_on_leave
    )

    return {
        "selected_date": selected_date,
        "department": department,
        "total_active_employees": total_employees,
        "employees_on_leave": on_leave_count,
        "available_employees": (
            total_employees -
            on_leave_count
        ),
        "leave_percentage": (
            round(
                on_leave_count /
                total_employees *
                100,
                2,
            )
            if total_employees
            else 0
        ),
        "on_leave": employees_on_leave,
        "available": available_employees,
    }
