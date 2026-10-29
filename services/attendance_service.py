from sqlalchemy import inspect, text

from database import engine


def migrate_attendance_table():
    """
    Update the attendance table to support automatic absences.

    Existing attendance records are preserved.
    The check_in column is changed to allow NULL values.
    """

    inspector = inspect(engine)

    if "attendance" not in inspector.get_table_names():
        return

    columns = {
        column["name"]: column
        for column in inspector.get_columns("attendance")
    }

    # Add missing columns to an existing database.
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

    # Refresh the table information.
    inspector = inspect(engine)

    columns = {
        column["name"]: column
        for column in inspector.get_columns("attendance")
    }

    check_in_column = columns.get("check_in")

    # SQLite cannot directly remove NOT NULL from a column.
    if (
        engine.dialect.name == "sqlite"
        and check_in_column is not None
        and not check_in_column["nullable"]
    ):

        print(
            "[WorkSphere] Migrating attendance table..."
        )

        with engine.begin() as connection:

            connection.execute(
                text(
                    """
                    ALTER TABLE attendance
                    RENAME TO attendance_old
                    """
                )
            )

            connection.execute(
                text(
                    """
                    CREATE TABLE attendance_new (
                        id INTEGER NOT NULL PRIMARY KEY,
                        employee_id INTEGER NOT NULL,
                        check_in DATETIME,
                        check_out DATETIME,
                        date DATE NOT NULL,
                        status VARCHAR(20) NOT NULL DEFAULT 'PRESENT',
                        working_hours NUMERIC(5, 2),
                        is_late BOOLEAN NOT NULL DEFAULT 0,
                        is_early_checkout BOOLEAN NOT NULL DEFAULT 0,
                        created_at DATETIME NOT NULL,
                        FOREIGN KEY(employee_id)
                            REFERENCES employees (id)
                    )
                    """
                )
            )

            connection.execute(
                text(
                    """
                    INSERT INTO attendance_new (
                        id,
                        employee_id,
                        check_in,
                        check_out,
                        date,
                        status,
                        working_hours,
                        is_late,
                        is_early_checkout,
                        created_at
                    )
                    SELECT
                        id,
                        employee_id,
                        check_in,
                        check_out,
                        date,
                        status,
                        working_hours,
                        is_late,
                        is_early_checkout,
                        created_at
                    FROM attendance_old
                    """
                )
            )

            connection.execute(
                text("DROP TABLE attendance_old")
            )

            connection.execute(
                text(
                    """
                    ALTER TABLE attendance_new
                    RENAME TO attendance
                    """
                )
            )

            # Restore indexes.
            connection.execute(
                text(
                    """
                    CREATE INDEX IF NOT EXISTS ix_attendance_id
                    ON attendance (id)
                    """
                )
            )

            connection.execute(
                text(
                    """
                    CREATE INDEX IF NOT EXISTS ix_attendance_employee_id
                    ON attendance (employee_id)
                    """
                )
            )

            connection.execute(
                text(
                    """
                    CREATE INDEX IF NOT EXISTS ix_attendance_date
                    ON attendance (date)
                    """
                )
            )

        print(
            "[WorkSphere] Attendance migration completed."
        )