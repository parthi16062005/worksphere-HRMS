from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from auth import require_roles
from database import get_db
from models import (
    User,
    Employee,
    Leave,
    LeavePolicy,
    LeaveBalance,
    Notification,
)
from schemas import (
    LeaveCreate,
    LeaveReview,
    LeaveResponse,
    LeaveStatus,
    LeavePolicyCreate,
    LeavePolicyResponse,
    LeaveBalanceResponse,
)


router = APIRouter(tags=["Leave Management"])


# =====================================================
# LEAVE MANAGEMENT CONSTANTS
# =====================================================

VALID_LEAVE_TYPES = {"SICK", "CASUAL", "PAID"}

VALID_LEAVE_STATUSES = {
    "PENDING",
    "APPROVED",
    "REJECTED",
}


# =====================================================
# CALCULATE LEAVE DAYS
# =====================================================

def calculate_leave_days(
    start_date: date,
    end_date: date,
) -> int:
    """Calculate leave duration including both dates."""

    return (end_date - start_date).days + 1


# =====================================================
# MODULE 11: LEAVE BALANCE INITIALIZATION
# =====================================================

def initialize_employee_leave_balances(
    db: Session,
    employee_id: int,
) -> None:
    """Create missing leave balances for an employee."""

    policies = db.query(LeavePolicy).all()

    for policy in policies:
        existing_balance = (
            db.query(LeaveBalance)
            .filter(
                LeaveBalance.employee_id == employee_id,
                LeaveBalance.leave_type == policy.leave_type,
            )
            .first()
        )

        if existing_balance is None:
            balance = LeaveBalance(
                employee_id=employee_id,
                leave_type=policy.leave_type,
                remaining_days=policy.total_days_allowed,
            )

            db.add(balance)

    db.flush()


# =====================================================
# EMPLOYEE: APPLY FOR LEAVE
# MODULE 11: POLICY AND BALANCE VALIDATION
# =====================================================

@router.post(
    "/leaves",
    response_model=LeaveResponse,
    status_code=201,
)
def apply_for_leave(
    leave_data: LeaveCreate,
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
            detail="No employee record is linked to this account.",
        )

    # Only active employees can apply for leave.
    if employee.employment_status != "ACTIVE":
        raise HTTPException(
            status_code=403,
            detail="Only active employees can apply for leave.",
        )

    # Validate the requested dates.
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

    # Check the leave policy.
    leave_type = leave_data.leave_type.upper()

    policy = (
        db.query(LeavePolicy)
        .filter(LeavePolicy.leave_type == leave_type)
        .first()
    )

    if policy is None:
        raise HTTPException(
            status_code=400,
            detail=f"No leave policy configured for {leave_type}.",
        )

    try:
        # Initialize missing balances.
        initialize_employee_leave_balances(
            db=db,
            employee_id=employee.id,
        )

        balance = (
            db.query(LeaveBalance)
            .filter(
                LeaveBalance.employee_id == employee.id,
                LeaveBalance.leave_type == leave_type,
            )
            .first()
        )

        # Calculate requested leave days.
        requested_days = calculate_leave_days(
            leave_data.start_date,
            leave_data.end_date,
        )

        if balance is None:
            raise HTTPException(
                status_code=400,
                detail="Leave balance could not be initialized.",
            )

        if balance.remaining_days < requested_days:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Insufficient {leave_type} leave balance. "
                    f"Remaining: {balance.remaining_days} days; "
                    f"requested: {requested_days} days."
                ),
            )

        # Create the leave request.
        leave = Leave(
            employee_id=employee.id,
            leave_type=leave_type,
            start_date=leave_data.start_date,
            end_date=leave_data.end_date,
            reason=leave_data.reason.strip(),
            status="PENDING",
        )

        db.add(leave)
        db.commit()
        db.refresh(leave)

        return leave

    except HTTPException:
        db.rollback()
        raise

    except Exception:
        db.rollback()
        raise


# =====================================================
# EMPLOYEE: VIEW OWN LEAVE REQUESTS
# =====================================================

@router.get(
    "/leaves/my",
    response_model=list[LeaveResponse],
)
def get_my_leaves(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("EMPLOYEE")
    ),
):
    employee = (
        db.query(Employee)
        .filter(Employee.user_id == current_user.id)
        .first()
    )

    if employee is None:
        raise HTTPException(
            status_code=404,
            detail="No employee record is linked to this account.",
        )

    return (
        db.query(Leave)
        .filter(Leave.employee_id == employee.id)
        .order_by(
            Leave.applied_at.desc(),
            Leave.id.desc(),
        )
        .all()
    )


# =====================================================
# HR / ADMIN: VIEW ALL LEAVE REQUESTS
# =====================================================

@router.get(
    "/leaves",
    response_model=list[LeaveResponse],
)
def get_all_leaves(
    leave_status: LeaveStatus | None = None,
    employee_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("HR", "ADMIN")
    ),
):
    query = db.query(Leave)

    if leave_status is not None:
        query = query.filter(
            Leave.status == leave_status
        )

    if employee_id is not None:
        query = query.filter(
            Leave.employee_id == employee_id
        )

    return query.order_by(
        Leave.applied_at.desc(),
        Leave.id.desc(),
    ).all()


# =====================================================
# HR / ADMIN: REVIEW A LEAVE REQUEST
# MODULE 11: LEAVE BALANCE DEDUCTION
# =====================================================

@router.patch(
    "/leaves/{leave_id}/review",
    response_model=LeaveResponse,
)
def review_leave(
    leave_id: int,
    review_data: LeaveReview,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("HR", "ADMIN")
    ),
):
    # Find the leave request.
    leave = (
        db.query(Leave)
        .filter(Leave.id == leave_id)
        .first()
    )

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

    # Find the employee.
    employee = (
        db.query(Employee)
        .filter(Employee.id == leave.employee_id)
        .first()
    )

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

    # Calculate requested leave days.
    requested_days = calculate_leave_days(
        leave.start_date,
        leave.end_date,
    )

    if review_data.status == "APPROVED":

        # Check for overlapping approved leave.
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

        if overlapping_leave is not None:
            raise HTTPException(
                status_code=409,
                detail=(
                    "This employee already has approved leave "
                    "for overlapping dates."
                ),
            )

        # Find the employee's balance.
        balance = (
            db.query(LeaveBalance)
            .filter(
                LeaveBalance.employee_id == employee.id,
                LeaveBalance.leave_type == leave.leave_type,
            )
            .with_for_update()
            .first()
        )

        if balance is None:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"No {leave.leave_type} leave balance exists "
                    "for this employee."
                ),
            )

        if balance.remaining_days < requested_days:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Insufficient {leave.leave_type} leave balance. "
                    f"Remaining: {balance.remaining_days} days; "
                    f"requested: {requested_days} days."
                ),
            )

        # Deduct days only when approving.
        balance.remaining_days -= requested_days

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
            f"has been approved. {requested_days} leave day(s) "
            "have been deducted from your balance."
        )

    else:
        notification_title = "Leave Request Rejected"

        notification_message = (
            f"Your {leave.leave_type.lower()} leave request "
            f"from {leave.start_date} to {leave.end_date} "
            "has been rejected. Your leave balance was not changed."
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

    # Save changes.
    try:
        db.add(notification)
        db.commit()
        db.refresh(leave)

        return leave

    except Exception:
        db.rollback()

        raise HTTPException(
            status_code=500,
            detail="Unable to review leave and update its balance.",
        )


# =====================================================
# HR / ADMIN: VIEW A SPECIFIC LEAVE REQUEST
# =====================================================

@router.get(
    "/leaves/{leave_id}",
    response_model=LeaveResponse,
)
def get_leave_by_id(
    leave_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("HR", "ADMIN")
    ),
):
    leave = (
        db.query(Leave)
        .filter(Leave.id == leave_id)
        .first()
    )

    if leave is None:
        raise HTTPException(
            status_code=404,
            detail="Leave request not found.",
        )

    return leave


# =====================================================
# MODULE 11: LEAVE POLICY MANAGEMENT
# =====================================================

@router.get(
    "/leave-policies",
    response_model=list[LeavePolicyResponse],
    tags=["Leave Policies"],
)
def get_leave_policies(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("EMPLOYEE", "HR", "ADMIN")
    ),
):
    policies = (
        db.query(LeavePolicy)
        .order_by(LeavePolicy.leave_type)
        .all()
    )

    return policies


@router.post(
    "/leave-policies",
    response_model=LeavePolicyResponse,
    status_code=201,
    tags=["Leave Policies"],
)
def create_leave_policy(
    policy_data: LeavePolicyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("HR", "ADMIN")
    ),
):
    leave_type = policy_data.leave_type.upper()

    existing_policy = (
        db.query(LeavePolicy)
        .filter(LeavePolicy.leave_type == leave_type)
        .first()
    )

    if existing_policy is not None:
        raise HTTPException(
            status_code=409,
            detail=f"A policy for {leave_type} already exists.",
        )

    policy = LeavePolicy(
        leave_type=leave_type,
        total_days_allowed=policy_data.total_days_allowed,
    )

    try:
        db.add(policy)
        db.flush()

        employees = db.query(Employee).all()

        for employee in employees:
            existing_balance = (
                db.query(LeaveBalance)
                .filter(
                    LeaveBalance.employee_id == employee.id,
                    LeaveBalance.leave_type == leave_type,
                )
                .first()
            )

            if existing_balance is None:
                balance = LeaveBalance(
                    employee_id=employee.id,
                    leave_type=leave_type,
                    remaining_days=policy_data.total_days_allowed,
                )

                db.add(balance)

        db.commit()
        db.refresh(policy)

        return policy

    except Exception:
        db.rollback()
        raise


# =====================================================
# MODULE 11: EMPLOYEE LEAVE BALANCE
# =====================================================

@router.get(
    "/leaves/my/balances",
    response_model=list[LeaveBalanceResponse],
    tags=["Leave Policies"],
)
def get_my_leave_balances(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("EMPLOYEE")
    ),
):
    employee = (
        db.query(Employee)
        .filter(Employee.user_id == current_user.id)
        .first()
    )

    if employee is None:
        raise HTTPException(
            status_code=404,
            detail="Employee record not found.",
        )

    balances = (
        db.query(LeaveBalance)
        .filter(LeaveBalance.employee_id == employee.id)
        .order_by(LeaveBalance.leave_type)
        .all()
    )

    return balances