from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from auth import require_roles
from database import get_db
from models import User, Employee, Payroll, Notification
from schemas import (
    PayrollCreate,
    PayrollResponse,
    PayrollPaymentUpdate,
)


router = APIRouter(tags=["Payroll Management"])


# =====================================================
# GENERATE MONTHLY PAYROLL
# HR / ADMIN ONLY
# WITH EMPLOYEE NOTIFICATION
# =====================================================

@router.post(
    "/payroll",
    response_model=PayrollResponse,
    status_code=201,
)
def generate_payroll(
    payroll_data: PayrollCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("HR", "ADMIN")
    ),
):
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
            detail=(
                "Payroll already exists for this employee and month."
            ),
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
        db.add(new_payroll)

        # Notify the employee if a login account exists.
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

    except Exception as exc:
        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to generate payroll and notification."
            ),
        ) from exc

    return new_payroll


# =====================================================
# GET MY PAYROLL HISTORY
# EMPLOYEE ONLY
# =====================================================

@router.get(
    "/payroll/my",
    response_model=list[PayrollResponse],
)
def get_my_payroll(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("EMPLOYEE")
    ),
):
    # Find the employee linked to the logged-in user.
    employee = (
        db.query(Employee)
        .filter(Employee.user_id == current_user.id)
        .first()
    )

    if employee is None:
        raise HTTPException(
            status_code=404,
            detail=(
                "No employee profile is linked to this account."
            ),
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
# GET ALL PAYROLL RECORDS
# HR / ADMIN ONLY
# =====================================================

@router.get(
    "/payroll",
    response_model=list[PayrollResponse],
)
def get_all_payroll(
    employee_id: int | None = None,
    payroll_month: int | None = None,
    payroll_year: int | None = None,
    payroll_status: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("HR", "ADMIN")
    ),
):
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

@router.patch(
    "/payroll/{payroll_id}/payment",
    response_model=PayrollResponse,
)
def mark_payroll_as_paid(
    payroll_id: int,
    payment_data: PayrollPaymentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("HR", "ADMIN")
    ),
):
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
            detail=(
                "This payroll has already been marked as paid."
            ),
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

    except Exception as exc:
        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to update payroll payment "
                "and notification."
            ),
        ) from exc

    return payroll