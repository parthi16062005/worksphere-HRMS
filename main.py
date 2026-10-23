from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

from database import Base, engine

from routers import (
    auth_router,
    employee_router,
    attendance_router,
    leave_router,
    payroll_router,
    salary_slip_router,
    notification_router,
    dashboard_router,
)


# =====================================================
# ENVIRONMENT CONFIGURATION
# =====================================================

BASE_DIR = Path(__file__).resolve().parent

load_dotenv(BASE_DIR / ".env")


# =====================================================
# ATTENDANCE DATABASE MIGRATION
# =====================================================

def migrate_attendance_table():
    """Add missing columns to an existing attendance table."""

    inspector = inspect(engine)

    if "attendance" not in inspector.get_table_names():
        return

    columns = {
        column["name"]
        for column in inspector.get_columns("attendance")
    }

    with engine.begin() as connection:

        if "is_late" not in columns:
            connection.execute(
                text(
                    """
                    ALTER TABLE attendance
                    ADD COLUMN is_late BOOLEAN NOT NULL DEFAULT 0
                    """
                )
            )

        if "is_early_checkout" not in columns:
            connection.execute(
                text(
                    """
                    ALTER TABLE attendance
                    ADD COLUMN is_early_checkout BOOLEAN NOT NULL DEFAULT 0
                    """
                )
            )


# =====================================================
# DATABASE INITIALIZATION
# =====================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database tables when the application starts."""

    # Create tables that do not already exist.
    Base.metadata.create_all(bind=engine)

    # Update the existing attendance table if needed.
    migrate_attendance_table()

    yield


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
# REGISTER ROUTERS
# =====================================================

app.include_router(auth_router.router)
app.include_router(employee_router.router)
app.include_router(attendance_router.router)
app.include_router(leave_router.router)
app.include_router(payroll_router.router)
app.include_router(salary_slip_router.router)
app.include_router(notification_router.router)
app.include_router(dashboard_router.router)

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
# HOME API
# =====================================================

@app.get("/")
def home():
    return {
        "message": "Welcome to WorkSphere HRMS API",
        "status": "running",
    }