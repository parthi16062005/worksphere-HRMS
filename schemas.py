from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
)


# =====================================================
# USER ROLE
# =====================================================

RoleType = Literal["EMPLOYEE", "HR", "ADMIN"]


# =====================================================
# USER REGISTRATION
# =====================================================

class UserRegister(BaseModel):
    username: str = Field(
        min_length=3,
        max_length=50,
    )

    email: EmailStr

    password: str = Field(
        min_length=8,
        max_length=128,
    )


# =====================================================
# USER LOGIN
# =====================================================

class UserLogin(BaseModel):
    username: str

    password: str


# =====================================================
# USER RESPONSE
# =====================================================

class UserResponse(BaseModel):
    id: int
    username: str
    email: EmailStr
    role: RoleType
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# =====================================================
# USER PROFILE UPDATE
# =====================================================

class UserProfileUpdate(BaseModel):
    username: str = Field(
        min_length=3,
        max_length=50,
    )

    email: EmailStr


# =====================================================
# USER PROFILE RESPONSE
# =====================================================

class UserProfileResponse(BaseModel):
    id: int
    username: str
    email: EmailStr
    role: RoleType
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# =====================================================
# LOGIN TOKEN RESPONSE
# =====================================================

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


# =====================================================
# EMPLOYEE EMPLOYMENT STATUS
# =====================================================

EmploymentStatus = Literal[
    "ACTIVE",
    "INACTIVE",
    "ON_LEAVE",
    "TERMINATED",
]


# =====================================================
# CREATE EMPLOYEE
# Admin/HR creates employee and login account together
# =====================================================

class EmployeeCreate(BaseModel):
    employee_code: str = Field(
        min_length=2,
        max_length=20,
        pattern=r"^[A-Za-z0-9_-]+$",
    )

    full_name: str = Field(
        min_length=2,
        max_length=100,
    )

    department: str = Field(
        min_length=2,
        max_length=100,
    )

    designation: str = Field(
        min_length=2,
        max_length=100,
    )

    joining_date: date

    salary: Decimal = Field(
        ge=0,
        max_digits=12,
        decimal_places=2,
    )

    employment_status: EmploymentStatus = "ACTIVE"

    # Login account details
    username: str = Field(
        min_length=3,
        max_length=50,
    )

    email: EmailStr

    password: str = Field(
        min_length=8,
        max_length=128,
    )


# =====================================================
# UPDATE EMPLOYEE
# =====================================================

class EmployeeUpdate(BaseModel):
    employee_code: str = Field(
        min_length=2,
        max_length=20,
        pattern=r"^[A-Za-z0-9_-]+$",
    )

    user_id: int | None = Field(
        default=None,
        gt=0,
    )

    full_name: str = Field(
        min_length=2,
        max_length=100,
    )

    department: str = Field(
        min_length=2,
        max_length=100,
    )

    designation: str = Field(
        min_length=2,
        max_length=100,
    )

    joining_date: date

    salary: Decimal = Field(
        ge=0,
        max_digits=12,
        decimal_places=2,
    )

    employment_status: EmploymentStatus


# =====================================================
# EMPLOYEE RESPONSE
# =====================================================

class EmployeeResponse(BaseModel):
    id: int
    employee_code: str
    user_id: int | None
    full_name: str
    department: str
    designation: str
    joining_date: date
    salary: Decimal
    employment_status: EmploymentStatus
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

    # =====================================================
# ATTENDANCE MANAGEMENT
# =====================================================

AttendanceStatus = Literal[
    "PRESENT",
    "ABSENT",
    "HALF_DAY",
]


# =====================================================
# ATTENDANCE CHECK-IN RESPONSE
# =====================================================

class AttendanceCheckIn(BaseModel):
    employee_id: int = Field(
        gt=0,
    )


# =====================================================
# ATTENDANCE CHECK-OUT RESPONSE
# =====================================================

class AttendanceCheckOut(BaseModel):
    employee_id: int = Field(
        gt=0,
    )


# =====================================================
# ATTENDANCE RESPONSE
# =====================================================

class AttendanceResponse(BaseModel):
    id: int

    employee_id: int

    check_in: datetime

    check_out: datetime | None = None

    date: date

    status: AttendanceStatus

    working_hours: Decimal | None = None

    created_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
    )

# =====================================================
# LEAVE MANAGEMENT SCHEMAS
# =====================================================

LeaveType = Literal["SICK", "CASUAL", "PAID"]

LeaveStatus = Literal["PENDING", "APPROVED", "REJECTED"]


class LeaveCreate(BaseModel):
    leave_type: LeaveType

    start_date: date

    end_date: date

    reason: str = Field(
        min_length=5,
        max_length=500,
    )


class LeaveReview(BaseModel):
    status: Literal["APPROVED", "REJECTED"]

    review_comment: str | None = Field(
        default=None,
        max_length=500,
    )


class LeaveResponse(BaseModel):
    id: int

    employee_id: int

    leave_type: LeaveType

    start_date: date

    end_date: date

    reason: str

    status: LeaveStatus

    applied_at: datetime

    reviewed_by: int | None = None

    reviewed_at: datetime | None = None

    review_comment: str | None = None

    model_config = ConfigDict(from_attributes=True)


# =====================================================
# PAYROLL SCHEMAS
# =====================================================

from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


PayrollStatus = Literal["PENDING", "PAID"]


class PayrollCreate(BaseModel):
    employee_id: int = Field(gt=0)
    month: int = Field(ge=1, le=12)
    year: int = Field(ge=2000, le=2100)

    basic_salary: Decimal = Field(ge=0, max_digits=12, decimal_places=2)
    hra: Decimal = Field(default=Decimal("0.00"), ge=0, max_digits=12, decimal_places=2)
    da: Decimal = Field(default=Decimal("0.00"), ge=0, max_digits=12, decimal_places=2)
    other_allowances: Decimal = Field(default=Decimal("0.00"), ge=0, max_digits=12, decimal_places=2)

    pf_deduction: Decimal = Field(default=Decimal("0.00"), ge=0, max_digits=12, decimal_places=2)
    tax_deduction: Decimal = Field(default=Decimal("0.00"), ge=0, max_digits=12, decimal_places=2)
    other_deductions: Decimal = Field(default=Decimal("0.00"), ge=0, max_digits=12, decimal_places=2)


class PayrollResponse(BaseModel):
    id: int
    employee_id: int
    month: int
    year: int

    basic_salary: Decimal
    hra: Decimal
    da: Decimal
    other_allowances: Decimal

    gross_salary: Decimal

    pf_deduction: Decimal
    tax_deduction: Decimal
    other_deductions: Decimal

    total_deductions: Decimal
    net_salary: Decimal

    status: PayrollStatus
    payment_date: date | None = None
    generated_by: int
    generated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PayrollPaymentUpdate(BaseModel):
    status: Literal["PAID"]
    payment_date: date | None = None

# =====================================================
# NOTIFICATION SCHEMAS
# =====================================================

class NotificationResponse(BaseModel):
    id: int
    user_id: int
    title: str
    message: str
    is_read: int
    created_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
    )


class NotificationReadUpdate(BaseModel):
    is_read: int = Field(
        ge=0,
        le=1,
    )