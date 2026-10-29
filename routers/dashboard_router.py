from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from auth import require_roles
from database import get_db
from models import User, Employee


router = APIRouter(
    tags=["Dashboard Management"],
)


# =====================================================
# DASHBOARD STATISTICS
# HR / ADMIN
# =====================================================

@router.get("/dashboard/statistics")
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
            Employee.created_at
            >= today_start.replace(tzinfo=None)
        )
        .scalar() or 0
    )

    return {
        "total_users": total_users,
        "total_employees": total_employees,
        "total_hr": total_hr,
        "total_admins": total_admins,
        "employees_registered_today": (
            employees_registered_today
        ),
        "generated_at": now.isoformat(),
        "requested_by": current_user.username,
    }


# =====================================================
# EMPLOYEE DASHBOARD
# =====================================================

@router.get("/employee/dashboard")
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

@router.get("/hr/dashboard")
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

@router.get("/admin/dashboard")
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