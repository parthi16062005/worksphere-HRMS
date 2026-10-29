
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
    Text,
)

from database import Base


# ==========================================
# COMMON TIME FUNCTION
# ==========================================

def current_time():
    return datetime.now(timezone.utc)


# ==========================================
# USER MODEL
# ==========================================

class User(Base):
    __tablename__ = "users"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    username = Column(
        String(50),
        unique=True,
        nullable=False,
        index=True,
    )

    email = Column(
        String(255),
        unique=True,
        nullable=False,
        index=True,
    )

    hashed_password = Column(
        String(255),
        nullable=False,
    )

    role = Column(
        String(20),
        nullable=False,
        default="EMPLOYEE",
    )

    created_at = Column(
        DateTime(timezone=True),
        default=current_time,
        nullable=False,
    )


# ==========================================
# EMPLOYEE MODEL
# ==========================================

class Employee(Base):
    __tablename__ = "employees"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    employee_code = Column(
        String(20),
        unique=True,
        nullable=False,
        index=True,
    )

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        unique=True,
        nullable=True,
        index=True,
    )

    full_name = Column(
        String(100),
        nullable=False,
        index=True,
    )

    department = Column(
        String(100),
        nullable=False,
        index=True,
    )

    designation = Column(
        String(100),
        nullable=False,
    )

    joining_date = Column(
        Date,
        nullable=False,
    )

    salary = Column(
        Numeric(12, 2),
        nullable=False,
    )

    employment_status = Column(
        String(20),
        nullable=False,
        default="ACTIVE",
        index=True,
    )

    created_at = Column(
        DateTime(timezone=True),
        default=current_time,
        nullable=False,
    )


# ==========================================
# ATTENDANCE MODEL
# ==========================================

class Attendance(Base):
    __tablename__ = "attendance"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    employee_id = Column(
        Integer,
        ForeignKey("employees.id"),
        nullable=False,
        index=True,
    )

    check_in = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    check_out = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    date = Column(
        Date,
        nullable=False,
        index=True,
    )

    status = Column(
        String(20),
        nullable=False,
        default="PRESENT",
    )

    working_hours = Column(
        Numeric(5, 2),
        nullable=True,
    )

    # Module 10: Late check-in indicator
    is_late = Column(
        Boolean,
        nullable=False,
        default=False,
    )

    # Module 10: Early check-out indicator
    is_early_checkout = Column(
        Boolean,
        nullable=False,
        default=False,
    )

    created_at = Column(
        DateTime(timezone=True),
        default=current_time,
        nullable=False,
    )


# ==========================================
# LEAVE MANAGEMENT
# ==========================================

class Leave(Base):
    __tablename__ = "leaves"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    employee_id = Column(
        Integer,
        ForeignKey("employees.id"),
        nullable=False,
        index=True,
    )

    leave_type = Column(
        String(20),
        nullable=False,
        index=True,
    )

    start_date = Column(
        Date,
        nullable=False,
    )

    end_date = Column(
        Date,
        nullable=False,
    )

    reason = Column(
        String(500),
        nullable=False,
    )

    status = Column(
        String(20),
        nullable=False,
        default="PENDING",
        index=True,
    )

    applied_at = Column(
        DateTime(timezone=True),
        default=current_time,
        nullable=False,
    )

    reviewed_by = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=True,
    )

    reviewed_at = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    review_comment = Column(
        String(500),
        nullable=True,
    )

# ==========================================
# LEAVE POLICY MODEL
# Module 11
# ==========================================

class LeavePolicy(Base):
    __tablename__ = "leave_policies"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    leave_type = Column(
        String(20),
        unique=True,
        nullable=False,
        index=True,
    )

    total_days_allowed = Column(
        Integer,
        nullable=False,
        default=0,
    )
    
# ==========================================
# EMPLOYEE LEAVE BALANCE MODEL
# Module 11
# ==========================================

class LeaveBalance(Base):
    __tablename__ = "leave_balances"

    __table_args__ = (
        UniqueConstraint(
            "employee_id",
            "leave_type",
            name="uq_employee_leave_type",
        ),
    )

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    employee_id = Column(
        Integer,
        ForeignKey("employees.id"),
        nullable=False,
        index=True,
    )

    leave_type = Column(
        String(20),
        nullable=False,
        index=True,
    )

    remaining_days = Column(
        Integer,
        nullable=False,
        default=0,
    )

# ==========================================
# PAYROLL MODEL
# ==========================================

class Payroll(Base):
    __tablename__ = "payrolls"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    employee_id = Column(
        Integer,
        ForeignKey("employees.id"),
        nullable=False,
        index=True,
    )

    month = Column(
        Integer,
        nullable=False,
        index=True,
    )

    year = Column(
        Integer,
        nullable=False,
        index=True,
    )

    basic_salary = Column(
        Numeric(12, 2),
        nullable=False,
        default=0,
    )

    hra = Column(
        Numeric(12, 2),
        nullable=False,
        default=0,
    )

    da = Column(
        Numeric(12, 2),
        nullable=False,
        default=0,
    )

    other_allowances = Column(
        Numeric(12, 2),
        nullable=False,
        default=0,
    )

    gross_salary = Column(
        Numeric(12, 2),
        nullable=False,
        default=0,
    )

    pf_deduction = Column(
        Numeric(12, 2),
        nullable=False,
        default=0,
    )

    tax_deduction = Column(
        Numeric(12, 2),
        nullable=False,
        default=0,
    )

    other_deductions = Column(
        Numeric(12, 2),
        nullable=False,
        default=0,
    )

    total_deductions = Column(
        Numeric(12, 2),
        nullable=False,
        default=0,
    )

    net_salary = Column(
        Numeric(12, 2),
        nullable=False,
        default=0,
    )

    status = Column(
        String(20),
        nullable=False,
        default="PENDING",
        index=True,
    )

    payment_date = Column(
        Date,
        nullable=True,
    )

    generated_by = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
    )

    generated_at = Column(
        DateTime(timezone=True),
        default=current_time,
        nullable=False,
    )


# ==========================================
# NOTIFICATION MODEL
# ==========================================

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    title = Column(
        String(150),
        nullable=False,
    )

    message = Column(
        String(500),
        nullable=False,
    )

    is_read = Column(
        Integer,
        nullable=False,
        default=0,
    )

    created_at = Column(
        DateTime(timezone=True),
        default=current_time,
        nullable=False,
        index=True,
    )

    # ==========================================
# SHIFT MODEL
# Module 14: Automated Attendance & Shift Management
# ==========================================

from sqlalchemy import Time


class Shift(Base):
    __tablename__ = "shifts"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    name = Column(
        String(50),
        unique=True,
        nullable=False,
        index=True,
    )

    start_time = Column(
        Time,
        nullable=False,
    )

    end_time = Column(
        Time,
        nullable=False,
    )


# ==========================================
# EMPLOYEE SHIFT ASSIGNMENT MODEL
# Module 14
# ==========================================

class EmployeeShift(Base):
    __tablename__ = "employee_shifts"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    employee_id = Column(
        Integer,
        ForeignKey("employees.id"),
        nullable=False,
        index=True,
    )

    shift_id = Column(
        Integer,
        ForeignKey("shifts.id"),
        nullable=False,
        index=True,
    )

    assigned_at = Column(
        DateTime(timezone=True),
        default=current_time,
        nullable=False,
    )

# ==========================================
# DOCUMENT MANAGEMENT MODEL
# Module 16
# ==========================================

class Document(Base):
    __tablename__ = "documents"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    employee_id = Column(
        Integer,
        ForeignKey("employees.id"),
        nullable=False,
        index=True,
    )

    file_name = Column(
        String(255),
        nullable=False,
    )

    file_url = Column(
        String(500),
        nullable=False,
    )

    uploaded_at = Column(
        DateTime(timezone=True),
        default=current_time,
        nullable=False,
        index=True,
    )


# ==========================================
# MODULE 17: PERFORMANCE MANAGEMENT
# ==========================================

class Performance(Base):
    __tablename__ = "performance"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    employee_id = Column(
        Integer,
        ForeignKey("employees.id"),
        nullable=False,
        index=True,
    )

    review_period = Column(
        String(100),
        nullable=False,
    )

    rating = Column(
        Integer,
        nullable=False,
    )

    feedback = Column(
        Text,
        nullable=False,
    )

    created_at = Column(
        DateTime(timezone=True),
        default=current_time,
        nullable=False,
        index=True,
    )

# ==========================================
# MODULE 21: EMPLOYEE ONBOARDING
# ==========================================

class Onboarding(Base):
    __tablename__ = "onboarding"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    employee_id = Column(
        Integer,
        ForeignKey("employees.id"),
        nullable=False,
        index=True,
    )

    task_name = Column(
        String(200),
        nullable=False,
    )

    status = Column(
        String(20),
        nullable=False,
        default="PENDING",
        index=True,
    )

    due_date = Column(
        Date,
        nullable=False,
        index=True,
    )

# ==========================================
# MODULE 22: RESIGNATION & EXIT MANAGEMENT
# ==========================================

class Resignation(Base):
    __tablename__ = "resignations"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    employee_id = Column(
        Integer,
        ForeignKey("employees.id"),
        nullable=False,
        index=True,
    )

    reason = Column(
        String(1000),
        nullable=False,
    )

    notice_period = Column(
        Integer,
        nullable=False,
    )

    status = Column(
        String(20),
        nullable=False,
        default="PENDING",
        index=True,
    )

    created_at = Column(
        DateTime(timezone=True),
        default=current_time,
        nullable=False,
        index=True,
    )

# ==========================================
# MODULE 23: INTERNAL ANNOUNCEMENTS
# ==========================================

class Announcement(Base):
    __tablename__ = "announcements"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    title = Column(
        String(200),
        nullable=False,
    )

    message = Column(
        Text,
        nullable=False,
    )

    created_by = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    created_at = Column(
        DateTime(timezone=True),
        default=current_time,
        nullable=False,
        index=True,
    )

# ==========================================
# MODULE 24: TASK ASSIGNMENT & TRACKING
# ==========================================

class Task(Base):
    __tablename__ = "tasks"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    assigned_to = Column(
        Integer,
        ForeignKey("employees.id"),
        nullable=False,
        index=True,
    )

    title = Column(
        String(200),
        nullable=False,
    )

    description = Column(
        Text,
        nullable=False,
    )

    due_date = Column(
        Date,
        nullable=False,
        index=True,
    )

    status = Column(
        String(20),
        nullable=False,
        default="PENDING",
        index=True,
    )

    created_at = Column(
        DateTime(timezone=True),
        default=current_time,
        nullable=False,
    )

# ==========================================
# MODULE 26: EMPLOYEE FEEDBACK
# ==========================================

class Feedback(Base):
    __tablename__ = "feedback"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    employee_id = Column(
        Integer,
        ForeignKey("employees.id"),
        nullable=False,
        index=True,
    )

    category = Column(
        String(50),
        nullable=False,
        default="GENERAL",
        index=True,
    )

    rating = Column(
        Integer,
        nullable=False,
    )

    message = Column(
        Text,
        nullable=False,
    )

    status = Column(
        String(20),
        nullable=False,
        default="SUBMITTED",
        index=True,
    )

    reviewed_by = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=True,
    )

    review_comment = Column(
        Text,
        nullable=True,
    )

    created_at = Column(
        DateTime(timezone=True),
        default=current_time,
        nullable=False,
        index=True,
    )

    reviewed_at = Column(
        DateTime(timezone=True),
        nullable=True,
    )

# ==========================================
# MODULE 27: CHANGE PASSWORD
# ==========================================

from pydantic import BaseModel, Field


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(
        ...,
        min_length=1,
        max_length=128,
    )

    new_password: str = Field(
        ...,
        min_length=8,
        max_length=128,
    )

  # ==========================================
# MODULE 27: NOTIFICATION PREFERENCES
# ==========================================

class NotificationPreference(Base):
    __tablename__ = "notification_preferences"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
        unique=True,
        index=True,
    )

    attendance_notifications = Column(
        Boolean,
        default=True,
        nullable=False,
    )

    leave_notifications = Column(
        Boolean,
        default=True,
        nullable=False,
    )

    payroll_notifications = Column(
        Boolean,
        default=True,
        nullable=False,
    )

    task_notifications = Column(
        Boolean,
        default=True,
        nullable=False,
    )

    announcement_notifications = Column(
        Boolean,
        default=True,
        nullable=False,
    )

    email_notifications = Column(
        Boolean,
        default=False,
        nullable=False,
    )  