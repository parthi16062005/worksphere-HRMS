from datetime import date, datetime, time
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

    # Can be None when the system automatically marks
    # the employee as ABSENT.
    check_in: datetime | None = None

    check_out: datetime | None = None

    date: date

    status: AttendanceStatus

    working_hours: Decimal | None = None

    # Module 10: Advanced Attendance Controls
    is_late: bool = False
    is_early_checkout: bool = False

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

# ==========================================
# MODULE 11: LEAVE POLICY SCHEMAS
# ==========================================

class LeavePolicyCreate(BaseModel):
    leave_type: Literal["SICK", "CASUAL", "PAID"]
    total_days_allowed: int = Field(ge=0, le=365)


class LeavePolicyResponse(BaseModel):
    id: int
    leave_type: str
    total_days_allowed: int

    model_config = ConfigDict(from_attributes=True)


class LeaveBalanceResponse(BaseModel):
    id: int
    employee_id: int
    leave_type: str
    remaining_days: int

    model_config = ConfigDict(from_attributes=True)

# =====================================================
# MODULE 14: SHIFT MANAGEMENT SCHEMAS
# =====================================================

from typing import Literal


# =====================================================
# SHIFT TYPES
# =====================================================

ShiftName = Literal["Morning", "Evening", "Night"]


# =====================================================
# CREATE SHIFT
# HR / ADMIN ONLY
# =====================================================

class ShiftCreate(BaseModel):
    name: ShiftName

    start_time: time

    end_time: time


# =====================================================
# SHIFT RESPONSE
# =====================================================

class ShiftResponse(BaseModel):
    id: int

    name: str

    start_time: time

    end_time: time

    model_config = ConfigDict(
        from_attributes=True,
    )


# =====================================================
# ASSIGN SHIFT TO EMPLOYEE
# HR / ADMIN ONLY
# =====================================================

class EmployeeShiftAssign(BaseModel):
    employee_id: int = Field(
        gt=0,
    )

    shift_id: int = Field(
        gt=0,
    )


# =====================================================
# EMPLOYEE SHIFT ASSIGNMENT RESPONSE
# =====================================================

class EmployeeShiftResponse(BaseModel):
    id: int

    employee_id: int

    shift_id: int

    assigned_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
    )    

# ==========================================
# MODULE 21: EMPLOYEE ONBOARDING SCHEMAS
# ==========================================

from datetime import date
from pydantic import BaseModel, Field, ConfigDict


class OnboardingCreate(BaseModel):
    employee_id: int = Field(..., gt=0)
    task_name: str = Field(..., min_length=2, max_length=200)
    status: str = Field(default="PENDING", min_length=7, max_length=9)
    due_date: date


class OnboardingUpdate(BaseModel):
    task_name: str | None = Field(
        default=None,
        min_length=2,
        max_length=200,
    )

    status: str | None = Field(
        default=None,
        min_length=7,
        max_length=9,
    )

    due_date: date | None = None


class OnboardingResponse(BaseModel):
    id: int
    employee_id: int
    task_name: str
    status: str
    due_date: date

    model_config = ConfigDict(from_attributes=True)   

# ==========================================
# MODULE 22: RESIGNATION & EXIT MANAGEMENT
# ==========================================

from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class ResignationCreate(BaseModel):
    reason: str = Field(
        ...,
        min_length=5,
        max_length=1000,
    )

    notice_period: int = Field(
        ...,
        ge=1,
        le=365,
    )


class ResignationReview(BaseModel):
    status: str = Field(
        ...,
        min_length=6,
        max_length=8,
    )


class ResignationResponse(BaseModel):
    id: int
    employee_id: int
    reason: str
    notice_period: int
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# ==========================================
# MODULE 23: INTERNAL ANNOUNCEMENTS SCHEMAS
# ==========================================

class AnnouncementCreate(BaseModel):
    title: str = Field(
        ...,
        min_length=3,
        max_length=200,
    )

    message: str = Field(
        ...,
        min_length=5,
        max_length=5000,
    )


class AnnouncementUpdate(BaseModel):
    title: str | None = Field(
        default=None,
        min_length=3,
        max_length=200,
    )

    message: str | None = Field(
        default=None,
        min_length=5,
        max_length=5000,
    )


class AnnouncementResponse(BaseModel):
    id: int
    title: str
    message: str
    created_by: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# ==========================================
# MODULE 24: TASK ASSIGNMENT & TRACKING SCHEMAS
# ==========================================

class TaskCreate(BaseModel):
    assigned_to: int = Field(..., gt=0)
    title: str = Field(..., min_length=3, max_length=200)
    description: str = Field(..., min_length=5, max_length=5000)
    due_date: date


class TaskUpdate(BaseModel):
    title: str | None = Field(
        default=None,
        min_length=3,
        max_length=200,
    )
    description: str | None = Field(
        default=None,
        min_length=5,
        max_length=5000,
    )
    due_date: date | None = None
    status: str | None = Field(
        default=None,
        pattern="^(PENDING|COMPLETED)$",
    )


class TaskStatusUpdate(BaseModel):
    status: str = Field(
        ...,
        pattern="^(PENDING|COMPLETED)$",
    )


class TaskResponse(BaseModel):
    id: int
    assigned_to: int
    title: str
    description: str
    due_date: date
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# MODULE 26: EMPLOYEE FEEDBACK SCHEMAS
# ==========================================

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class FeedbackCreate(BaseModel):
    category: Literal[
        "GENERAL",
        "WORKPLACE",
        "MANAGEMENT",
        "TEAMWORK",
        "SUGGESTION",
    ] = "GENERAL"

    rating: int = Field(
        ...,
        ge=1,
        le=5,
        description="Feedback rating from 1 to 5",
    )

    message: str = Field(
        ...,
        min_length=5,
        max_length=2000,
        description="Employee feedback message",
    )


class FeedbackReview(BaseModel):
    status: Literal[
        "REVIEWED",
        "RESOLVED",
    ]

    review_comment: str | None = Field(
        default=None,
        max_length=2000,
    )


class FeedbackResponse(BaseModel):
    id: int
    employee_id: int
    category: str
    rating: int
    message: str
    status: str
    reviewed_by: int | None = None
    review_comment: str | None = None
    created_at: datetime
    reviewed_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)

    # ==========================================
# MODULE 27: CHANGE PASSWORD
# ==========================================

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

class NotificationPreferenceUpdate(BaseModel):
    attendance_notifications: bool = True
    leave_notifications: bool = True
    payroll_notifications: bool = True
    task_notifications: bool = True
    announcement_notifications: bool = True
    email_notifications: bool = False


class NotificationPreferenceResponse(BaseModel):
    user_id: int
    attendance_notifications: bool
    leave_notifications: bool
    payroll_notifications: bool
    task_notifications: bool
    announcement_notifications: bool
    email_notifications: bool

    model_config = ConfigDict(from_attributes=True)