import asyncio
import logging

from routers.attendance_router import process_automatic_absences


# =====================================================
# CONFIGURATION
# =====================================================

ATTENDANCE_AUTOMATION_INTERVAL_SECONDS = 300

logger = logging.getLogger(__name__)


# =====================================================
# AUTOMATIC ATTENDANCE SCHEDULER
# =====================================================

async def automatic_attendance_loop():
    """
    Check for employees who need automatic absence records.

    The attendance check runs every five minutes.
    Attendance processing remains in attendance_router.py.
    """

    logger.info(
        "Automatic attendance scheduler started. "
        "Interval: 5 minutes."
    )

    while True:
        try:
            created_count = await asyncio.to_thread(
                process_automatic_absences
            )

            if created_count > 0:
                logger.info(
                    "Automatically recorded %s absence(s).",
                    created_count,
                )

        except asyncio.CancelledError:
            logger.info(
                "Automatic attendance scheduler stopped."
            )
            raise

        except Exception:
            logger.exception(
                "Automatic attendance check failed."
            )

        await asyncio.sleep(
            ATTENDANCE_AUTOMATION_INTERVAL_SECONDS
        )