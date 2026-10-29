
from datetime import date
from html import escape

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from auth import get_current_user, require_roles
from database import get_db
from models import Employee, Task, User
from schemas import TaskCreate, TaskUpdate, TaskStatusUpdate, TaskResponse
from services.email_service import send_work_notification


router = APIRouter(
    prefix="/tasks",
    tags=["Task Assignment & Tracking"],
)


# =====================================================
# HELPER: FIND EMPLOYEE PROFILE FOR CURRENT USER
# =====================================================
def get_employee_profile(db: Session, user_id: int):
    employee = db.query(Employee).filter(
        Employee.user_id == user_id
    ).first()

    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee profile not found for this user.",
        )

    return employee


# =====================================================
# HELPER: SEND EMAIL WITHOUT BREAKING TASK OPERATIONS
# =====================================================
def send_task_assignment_email(
    db: Session,
    employee: Employee,
    task: Task,
):
    """
    Send an assignment email if the employee has an email address.

    Email failures must never undo an already-saved task.
    """

    try:
        user = db.query(User).filter(
            User.id == employee.user_id
        ).first()

        if not user:
            return

        recipient = getattr(user, "email", None)

        if not recipient:
            return

        employee_name = (
            getattr(user, "username", None)
            or getattr(user, "name", None)
            or "Employee"
        )

        safe_title = escape(task.title)
        safe_description = escape(task.description)
        safe_due_date = escape(str(task.due_date))

        email_message = (
            f"You have been assigned a new task: {task.title}\n\n"
            f"Description: {task.description}\n"
            f"Due date: {task.due_date}\n"
            "Status: PENDING\n\n"
            "Please log in to WorkSphere to review and complete "
            "your task."
        )

        email_html = f"""
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport"
                  content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin:0;padding:24px;background:#f1f5f9;
                     font-family:Arial,sans-serif;">
            <div style="max-width:600px;margin:auto;background:#fff;
                        border:1px solid #e2e8f0;border-radius:12px;
                        overflow:hidden;">
                <div style="padding:22px;background:#334155;color:#fff;">
                    <h2 style="margin:0;">WorkSphere</h2>
                    <p style="margin:8px 0 0;color:#e2e8f0;">
                        New Task Assignment
                    </p>
                </div>
                <div style="padding:28px;color:#334155;line-height:1.7;">
                    <p>Hello {escape(employee_name)},</p>
                    <p>A new task has been assigned to you.</p>
                    <h3 style="color:#0f172a;">{safe_title}</h3>
                    <p>{safe_description}</p>
                    <p><strong>Due date:</strong> {safe_due_date}</p>
                    <p><strong>Status:</strong> PENDING</p>
                    <p>Please log in to WorkSphere to review your task.</p>
                </div>
                <div style="padding:16px 28px;background:#f8fafc;
                            color:#64748b;font-size:12px;">
                    Automated notification from WorkSphere.
                </div>
            </div>
        </body>
        </html>
        """

        send_work_notification(
            recipient=recipient,
            recipient_name=employee_name,
            title="New Task Assignment",
            message=email_message,
            # The existing service accepts html_body, but its template
            # currently generates its own HTML. The task details are
            # therefore included in the plain-text email.
        )

    except Exception:
        # Email is a secondary operation. Do not undo or fail the
        # successful task creation because an email could not be sent.
        import logging

        logging.getLogger(__name__).exception(
            "Task assignment email could not be processed."
        )


# =====================================================
# CREATE TASK — HR / ADMIN
# =====================================================
@router.post(
    "",
    response_model=TaskResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_task(
    data: TaskCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("HR", "ADMIN")),
):
    employee = db.query(Employee).filter(
        Employee.id == data.assigned_to
    ).first()

    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assigned employee not found.",
        )

    title = data.title.strip()
    description = data.description.strip()

    if not title or not description:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Task title and description cannot be empty.",
        )

    task = Task(
        assigned_to=employee.id,
        title=title,
        description=description,
        due_date=data.due_date,
        status="PENDING",
    )

    db.add(task)
    db.commit()
    db.refresh(task)

    # Send email after the task has been committed successfully.
    send_task_assignment_email(
        db=db,
        employee=employee,
        task=task,
    )

    return task


# =====================================================
# GET MY TASKS — EMPLOYEE
# =====================================================
@router.get(
    "/my",
    response_model=list[TaskResponse],
)
def get_my_tasks(
    task_status: str | None = Query(
        default=None,
        alias="status",
        pattern="^(PENDING|COMPLETED)$",
    ),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    employee = get_employee_profile(db, current_user.id)

    query = db.query(Task).filter(
        Task.assigned_to == employee.id
    )

    if task_status:
        query = query.filter(Task.status == task_status)

    return query.order_by(
        Task.due_date.asc(),
        Task.id.desc(),
    ).all()


# =====================================================
# GET ALL TASKS — HR / ADMIN
# =====================================================
@router.get(
    "",
    response_model=list[TaskResponse],
)
def get_all_tasks(
    task_status: str | None = Query(
        default=None,
        alias="status",
        pattern="^(PENDING|COMPLETED)$",
    ),
    employee_id: int | None = Query(default=None, gt=0),
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("HR", "ADMIN")),
):
    query = db.query(Task)

    if task_status:
        query = query.filter(Task.status == task_status)

    if employee_id:
        query = query.filter(Task.assigned_to == employee_id)

    return query.order_by(
        Task.due_date.asc(),
        Task.id.desc(),
    ).all()


# =====================================================
# GET ONE TASK — OWNER / HR / ADMIN
# =====================================================
@router.get(
    "/{task_id}",
    response_model=TaskResponse,
)
def get_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    task = db.query(Task).filter(Task.id == task_id).first()

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found.",
        )

    role = str(current_user.role).upper()

    if role not in {"HR", "ADMIN"}:
        employee = get_employee_profile(db, current_user.id)

        if task.assigned_to != employee.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only view tasks assigned to you.",
            )

    return task


# =====================================================
# UPDATE TASK — HR / ADMIN
# =====================================================
@router.put(
    "/{task_id}",
    response_model=TaskResponse,
)
def update_task(
    task_id: int,
    data: TaskUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("HR", "ADMIN")),
):
    task = db.query(Task).filter(Task.id == task_id).first()

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found.",
        )

    updates = data.model_dump(exclude_unset=True)

    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide at least one field to update.",
        )

    for field, value in updates.items():
        if value is None:
            continue

        if field in {"title", "description"}:
            value = value.strip()

            if not value:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"{field.capitalize()} cannot be empty.",
                )

        if field == "status":
            value = value.upper()

            if value not in {"PENDING", "COMPLETED"}:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Status must be PENDING or COMPLETED.",
                )

        setattr(task, field, value)

    db.commit()
    db.refresh(task)

    return task


# =====================================================
# COMPLETE / REOPEN OWN TASK — EMPLOYEE
# =====================================================
@router.patch(
    "/{task_id}/status",
    response_model=TaskResponse,
)
def update_my_task_status(
    task_id: int,
    data: TaskStatusUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    employee = get_employee_profile(db, current_user.id)

    task = db.query(Task).filter(
        Task.id == task_id
    ).first()

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found.",
        )

    if task.assigned_to != employee.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update tasks assigned to you.",
        )

    task.status = data.status.upper()

    db.commit()
    db.refresh(task)

    return task


# =====================================================
# DELETE TASK — HR / ADMIN
# =====================================================
@router.delete(
    "/{task_id}",
    status_code=status.HTTP_200_OK,
)
def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("HR", "ADMIN")),
):
    task = db.query(Task).filter(Task.id == task_id).first()

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found.",
        )

    db.delete(task)
    db.commit()

    return {
        "message": "Task deleted successfully.",
        "task_id": task_id,
    }
