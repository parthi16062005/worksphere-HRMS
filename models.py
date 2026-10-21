
from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
)

from database import Base


def current_time():
    return datetime.now(timezone.utc)


# ==========================================
# USER MODEL
# ==========================================

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)

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

    id = Column(Integer, primary_key=True, index=True)

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
        nullable=False,
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

    created_at = Column(
        DateTime(timezone=True),
        default=current_time,
        nullable=False,
    )


# =====================================================
# LEAVE MANAGEMENT
# =====================================================

class Leave(Base):
    __tablename__ = "leaves"

    id = Column(Integer, primary_key=True, index=True)

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


# =====================================================
# PAYROLL MODEL
# =====================================================

class Payroll(Base):
    __tablename__ = "payrolls"

    id = Column(Integer, primary_key=True, index=True)

    employee_id = Column(
        Integer,
        ForeignKey("employees.id"),
        nullable=False,
        index=True,
    )

    month = Column(Integer, nullable=False, index=True)
    year = Column(Integer, nullable=False, index=True)

    basic_salary = Column(Numeric(12, 2), nullable=False, default=0)
    hra = Column(Numeric(12, 2), nullable=False, default=0)
    da = Column(Numeric(12, 2), nullable=False, default=0)
    other_allowances = Column(Numeric(12, 2), nullable=False, default=0)

    gross_salary = Column(Numeric(12, 2), nullable=False, default=0)

    pf_deduction = Column(Numeric(12, 2), nullable=False, default=0)
    tax_deduction = Column(Numeric(12, 2), nullable=False, default=0)
    other_deductions = Column(Numeric(12, 2), nullable=False, default=0)

    total_deductions = Column(Numeric(12, 2), nullable=False, default=0)
    net_salary = Column(Numeric(12, 2), nullable=False, default=0)

    status = Column(
        String(20),
        nullable=False,
        default="PENDING",
        index=True,
    )

    payment_date = Column(Date, nullable=True)

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

# =====================================================
# NOTIFICATION MODEL
# =====================================================

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