import asyncio
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import Base, engine

from routers import (
    auth_router,
    employee_router,
    attendance_router,
    leave_router,
    payroll_router,
    notification_router,
    dashboard_router,
    salary_slip_router,
    payroll_reports_router,
    shift_router,
    leave_calendar_router,
    document_router,
    performance_router,
    analytics_router,
)

from services.attendance_scheduler import automatic_attendance_loop
from services.attendance_service import migrate_attendance_table


# =====================================================
# ENVIRONMENT CONFIGURATION
# =====================================================

BASE_DIR = Path(__file__).resolve().parent

load_dotenv(BASE_DIR / ".env")


# =====================================================
# APPLICATION LIFECYCLE
# =====================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Initialize the database and start background services.
    """

    # Create missing database tables.
    Base.metadata.create_all(bind=engine)

    # Run the database migration from the service layer.
    migrate_attendance_table()

    print(
        "[WorkSphere] Database initialization completed."
    )

    # Start automatic attendance processing.
    attendance_task = asyncio.create_task(
        automatic_attendance_loop()
    )

    print(
        "[WorkSphere] Automatic attendance enabled. "
        "Interval: 5 minutes."
    )

    try:
        yield

    finally:
        attendance_task.cancel()

        try:
            await attendance_task

        except asyncio.CancelledError:
            pass

        print(
            "[WorkSphere] Background services stopped."
        )


# =====================================================
# FASTAPI APPLICATION
# =====================================================

app = FastAPI(
    title="WorkSphere - HR Management System",
    description="HR Management System API",
    version="1.2.0",
    lifespan=lifespan,
)


# =====================================================
# ROUTER REGISTRATION
# =====================================================

app.include_router(auth_router.router)
app.include_router(employee_router.router)
app.include_router(attendance_router.router)
app.include_router(leave_router.router)
app.include_router(payroll_router.router)
app.include_router(salary_slip_router.router)
app.include_router(notification_router.router)
app.include_router(dashboard_router.router)
app.include_router(payroll_reports_router.router)
app.include_router(shift_router.router)
app.include_router(leave_calendar_router.router)
app.include_router(document_router.router)
app.include_router(performance_router.router)
app.include_router(analytics_router.router)

# =====================================================
# CORS CONFIGURATION
# =====================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =====================================================
# HOME ENDPOINT
# =====================================================

@app.get("/")
def home():
    return {
        "message": "Welcome to WorkSphere HRMS API",
        "status": "running",
        "automatic_attendance": "enabled",
        "attendance_check_interval_minutes": 5,
    }