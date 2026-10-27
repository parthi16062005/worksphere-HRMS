
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import Attendance, Employee, Leave, Performance, User


router = APIRouter(
    prefix="/analytics",
    tags=["Advanced Analytics & Reports"],
)


# =========================================================
# HELPERS
# =========================================================

def normalize_role(user: User) -> str:
    return str(user.role).upper()


def get_employee_for_user(
    db: Session,
    user: User,
) -> Employee:
    employee = (
        db.query(Employee)
        .filter(
            Employee.user_id == user.id,
            Employee.employment_status == "ACTIVE",
        )
        .first()
    )

    if employee is None:
        raise HTTPException(
            status_code=404,
            detail="No active employee record found for this account.",
        )

    return employee


def validate_date_range(
    start_date: date,
    end_date: date,
) -> None:
    if start_date > end_date:
        raise HTTPException(
            status_code=400,
            detail="start_date must be on or before end_date.",
        )


def get_employee_scope(
    db: Session,
    current_user: User,
    requested_employee_id: int | None,
) -> int | None:
    """
    Return the employee ID that the current user may access.

    Employees can access only their own analytics.
    HR/Admin can access organization-wide analytics or
    request a specific employee.
    """

    role = normalize_role(current_user)

    if role in ("HR", "ADMIN"):
        if requested_employee_id is not None:
            employee = (
                db.query(Employee)
                .filter(Employee.id == requested_employee_id)
                .first()
            )

            if employee is None:
                raise HTTPException(
                    status_code=404,
                    detail="Employee not found.",
                )

        return requested_employee_id

    employee = get_employee_for_user(db, current_user)

    if (
        requested_employee_id is not None
        and requested_employee_id != employee.id
    ):
        raise HTTPException(
            status_code=403,
            detail="You can only access your own analytics.",
        )

    return employee.id


def apply_attendance_filters(
    query,
    start_date: date,
    end_date: date,
    employee_id: int | None,
    department: str | None,
):
    query = query.filter(
        Attendance.date >= start_date,
        Attendance.date <= end_date,
    )

    if employee_id is not None:
        query = query.filter(
            Attendance.employee_id == employee_id
        )

    if department:
        query = query.join(
            Employee,
            Employee.id == Attendance.employee_id,
        ).filter(
            func.lower(Employee.department)
            == department.strip().lower()
        )

    return query


def apply_leave_filters(
    query,
    start_date: date,
    end_date: date,
    employee_id: int | None,
    department: str | None,
):
    # Include leave requests that overlap the selected period.
    query = query.filter(
        Leave.start_date <= end_date,
        Leave.end_date >= start_date,
    )

    if employee_id is not None:
        query = query.filter(
            Leave.employee_id == employee_id
        )

    if department:
        query = query.join(
            Employee,
            Employee.id == Leave.employee_id,
        ).filter(
            func.lower(Employee.department)
            == department.strip().lower()
        )

    return query


def apply_performance_filters(
    query,
    start_date: date,
    end_date: date,
    employee_id: int | None,
    department: str | None,
):
    query = query.filter(
        func.date(Performance.created_at) >= start_date.isoformat(),
        func.date(Performance.created_at) <= end_date.isoformat(),
    )

    if employee_id is not None:
        query = query.filter(
            Performance.employee_id == employee_id
        )

    if department:
        query = query.join(
            Employee,
            Employee.id == Performance.employee_id,
        ).filter(
            func.lower(Employee.department)
            == department.strip().lower()
        )

    return query


# =========================================================
# 1. ATTENDANCE ANALYTICS
# =========================================================

@router.get("/attendance")
def attendance_analytics(
    start_date: date = Query(...),
    end_date: date = Query(...),
    department: str | None = Query(default=None, max_length=100),
    employee_id: int | None = Query(default=None, gt=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    validate_date_range(start_date, end_date)

    scoped_employee_id = get_employee_scope(
        db,
        current_user,
        employee_id,
    )

    query = apply_attendance_filters(
        db.query(Attendance),
        start_date,
        end_date,
        scoped_employee_id,
        department,
    )

    total_records = query.count()

    present_count = query.filter(
        func.upper(Attendance.status) == "PRESENT"
    ).count()

    absent_count = query.filter(
        func.upper(Attendance.status) == "ABSENT"
    ).count()

    late_count = query.filter(
        Attendance.is_late.is_(True)
    ).count()

    early_checkout_count = query.filter(
        Attendance.is_early_checkout.is_(True)
    ).count()

    attendance_rate = (
        round(present_count / total_records * 100, 2)
        if total_records
        else 0
    )

    daily_query = (
        db.query(
            Attendance.date,
            func.count(Attendance.id).label("total"),
        )
        .filter(
            Attendance.date >= start_date,
            Attendance.date <= end_date,
        )
    )

    if scoped_employee_id is not None:
        daily_query = daily_query.filter(
            Attendance.employee_id == scoped_employee_id
        )

    if department:
        daily_query = daily_query.join(
            Employee,
            Employee.id == Attendance.employee_id,
        ).filter(
            func.lower(Employee.department)
            == department.strip().lower()
        )

    daily_records = (
        daily_query
        .group_by(Attendance.date)
        .order_by(Attendance.date)
        .all()
    )

    return {
        "start_date": start_date,
        "end_date": end_date,
        "department": department,
        "employee_id": scoped_employee_id,
        "total_records": total_records,
        "present": present_count,
        "absent": absent_count,
        "late_arrivals": late_count,
        "early_checkouts": early_checkout_count,
        "attendance_rate": attendance_rate,
        "daily_trend": [
            {
                "date": record.date,
                "total_records": record.total,
            }
            for record in daily_records
        ],
    }


# =========================================================
# 2. LEAVE ANALYTICS
# =========================================================

@router.get("/leaves")
def leave_analytics(
    start_date: date = Query(...),
    end_date: date = Query(...),
    department: str | None = Query(default=None, max_length=100),
    employee_id: int | None = Query(default=None, gt=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    validate_date_range(start_date, end_date)

    scoped_employee_id = get_employee_scope(
        db,
        current_user,
        employee_id,
    )

    query = apply_leave_filters(
        db.query(Leave),
        start_date,
        end_date,
        scoped_employee_id,
        department,
    )

    total_requests = query.count()

    pending = query.filter(
        func.upper(Leave.status) == "PENDING"
    ).count()

    approved = query.filter(
        func.upper(Leave.status) == "APPROVED"
    ).count()

    rejected = query.filter(
        func.upper(Leave.status) == "REJECTED"
    ).count()

    leave_types = (
        query.with_entities(
            Leave.leave_type,
            func.count(Leave.id).label("total"),
        )
        .group_by(Leave.leave_type)
        .order_by(Leave.leave_type)
        .all()
    )

    return {
        "start_date": start_date,
        "end_date": end_date,
        "department": department,
        "employee_id": scoped_employee_id,
        "total_requests": total_requests,
        "pending": pending,
        "approved": approved,
        "rejected": rejected,
        "by_leave_type": [
            {
                "leave_type": record.leave_type,
                "count": record.total,
            }
            for record in leave_types
        ],
    }


# =========================================================
# 3. PERFORMANCE ANALYTICS
# =========================================================

@router.get("/performance")
def performance_analytics(
    start_date: date = Query(...),
    end_date: date = Query(...),
    department: str | None = Query(default=None, max_length=100),
    employee_id: int | None = Query(default=None, gt=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    validate_date_range(start_date, end_date)

    scoped_employee_id = get_employee_scope(
        db,
        current_user,
        employee_id,
    )

    query = apply_performance_filters(
        db.query(Performance),
        start_date,
        end_date,
        scoped_employee_id,
        department,
    )

    total_reviews = query.count()

    average_rating = query.with_entities(
        func.avg(Performance.rating)
    ).scalar()

    rating_distribution = (
        query.with_entities(
            Performance.rating,
            func.count(Performance.id).label("total"),
        )
        .group_by(Performance.rating)
        .order_by(Performance.rating)
        .all()
    )

    return {
        "start_date": start_date,
        "end_date": end_date,
        "department": department,
        "employee_id": scoped_employee_id,
        "total_reviews": total_reviews,
        "average_rating": (
            round(float(average_rating), 2)
            if average_rating is not None
            else 0
        ),
        "rating_distribution": [
            {
                "rating": record.rating,
                "count": record.total,
            }
            for record in rating_distribution
        ],
    }


# =========================================================
# 4. DEPARTMENT ANALYTICS
# HR AND ADMIN ONLY
# =========================================================

@router.get("/departments")
def department_analytics(
    start_date: date = Query(...),
    end_date: date = Query(...),
    department: str | None = Query(default=None, max_length=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    validate_date_range(start_date, end_date)

    if normalize_role(current_user) not in ("HR", "ADMIN"):
        raise HTTPException(
            status_code=403,
            detail="Only HR and Admin can access department reports.",
        )

    employee_query = db.query(Employee).filter(
        Employee.employment_status == "ACTIVE"
    )

    if department:
        employee_query = employee_query.filter(
            func.lower(Employee.department)
            == department.strip().lower()
        )

    employees = employee_query.order_by(
        Employee.department,
        Employee.full_name,
    ).all()

    results = []

    for employee in employees:
        attendance_query = db.query(Attendance).filter(
            Attendance.employee_id == employee.id,
            Attendance.date >= start_date,
            Attendance.date <= end_date,
        )

        attendance_total = attendance_query.count()

        attendance_present = attendance_query.filter(
            func.upper(Attendance.status) == "PRESENT"
        ).count()

        attendance_rate = (
            round(attendance_present / attendance_total * 100, 2)
            if attendance_total
            else 0
        )

        leave_query = db.query(Leave).filter(
            Leave.employee_id == employee.id,
            Leave.start_date <= end_date,
            Leave.end_date >= start_date,
        )

        performance_query = db.query(Performance).filter(
            Performance.employee_id == employee.id,
            func.date(Performance.created_at) >= start_date.isoformat(),
            func.date(Performance.created_at) <= end_date.isoformat(),
        )

        average_rating = performance_query.with_entities(
            func.avg(Performance.rating)
        ).scalar()

        results.append({
            "employee_id": employee.id,
            "employee_code": employee.employee_code,
            "employee_name": employee.full_name,
            "department": employee.department,
            "designation": employee.designation,
            "attendance_records": attendance_total,
            "present_records": attendance_present,
            "attendance_rate": attendance_rate,
            "leave_requests": leave_query.count(),
            "pending_leaves": leave_query.filter(
                func.upper(Leave.status) == "PENDING"
            ).count(),
            "approved_leaves": leave_query.filter(
                func.upper(Leave.status) == "APPROVED"
            ).count(),
            "performance_reviews": performance_query.count(),
            "average_rating": (
                round(float(average_rating), 2)
                if average_rating is not None
                else 0
            ),
        })

    department_summary = {}

    for item in results:
        name = item["department"]

        if name not in department_summary:
            department_summary[name] = {
                "department": name,
                "employee_count": 0,
                "attendance_records": 0,
                "present_records": 0,
                "leave_requests": 0,
                "performance_rating_sum": 0,
                "performance_review_count": 0,
            }

        summary = department_summary[name]

        summary["employee_count"] += 1
        summary["attendance_records"] += item["attendance_records"]
        summary["present_records"] += item["present_records"]
        summary["leave_requests"] += item["leave_requests"]

        if item["performance_reviews"]:
            summary["performance_rating_sum"] += (
                item["average_rating"] * item["performance_reviews"]
            )
            summary["performance_review_count"] += (
                item["performance_reviews"]
            )

    department_results = []

    for summary in department_summary.values():
        attendance_total = summary["attendance_records"]
        present_total = summary["present_records"]
        review_total = summary["performance_review_count"]

        department_results.append({
            "department": summary["department"],
            "employee_count": summary["employee_count"],
            "attendance_records": attendance_total,
            "present_records": present_total,
            "attendance_rate": (
                round(present_total / attendance_total * 100, 2)
                if attendance_total
                else 0
            ),
            "leave_requests": summary["leave_requests"],
            "average_rating": (
                round(
                    summary["performance_rating_sum"] / review_total,
                    2,
                )
                if review_total
                else 0
            ),
        })

    return {
        "start_date": start_date,
        "end_date": end_date,
        "department_filter": department,
        "total_active_employees": len(employees),
        "employees": results,
        "departments": department_results,
    }
