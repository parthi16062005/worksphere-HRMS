
import { useCallback, useEffect, useState } from "react";
import api from "../services/api";
import "../style/Attendance.css";

function getTodayDate() {
    const now = new Date();

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function formatDate(value) {
    if (!value) return "—";

    return new Date(`${value}T00:00:00`).toLocaleDateString(
        "en-IN",
        {
            day: "2-digit",
            month: "short",
            year: "numeric",
        }
    );
}

function formatTime(value) {
    if (!value) return "Not recorded";

    const normalizedValue = value.endsWith("Z")
        ? value
        : `${value}Z`;

    return new Date(normalizedValue).toLocaleTimeString(
        "en-IN",
        {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
        }
    );
}

function formatWorkingHours(value) {
    if (value === null || value === undefined) {
        return "In progress";
    }

    const hours = Number(value);

    if (!Number.isFinite(hours)) {
        return "—";
    }

    return `${hours.toFixed(2)} hrs`;
}

function getErrorMessage(error) {
    const detail = error.response?.data?.detail;

    if (typeof detail === "string") {
        return detail;
    }

    if (Array.isArray(detail)) {
        return detail
            .map((item) => item.msg)
            .join(", ");
    }

    return "Something went wrong. Please try again.";
}

function Attendance({ user }) {
    const isEmployee = user?.role === "EMPLOYEE";

    const canViewAll =
        user?.role === "HR" || user?.role === "ADMIN";

    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    const [filters, setFilters] = useState({
        attendance_date: "",
        employee_id: "",
        attendance_status: "",
    });

    const today = getTodayDate();

    const todayRecord = records.find(
        (record) => record.date === today
    );

    const checkedIn = Boolean(todayRecord);
    const checkedOut = Boolean(todayRecord?.check_out);

    // ==========================================
    // LOAD ATTENDANCE
    // ==========================================

    const loadAttendance = useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            let response;

            if (isEmployee) {
                response = await api.get("/attendance/my");
            } else if (canViewAll) {
                const params = {};

                if (filters.attendance_date) {
                    params.attendance_date =
                        filters.attendance_date;
                }

                if (filters.employee_id) {
                    params.employee_id =
                        Number(filters.employee_id);
                }

                if (filters.attendance_status) {
                    params.attendance_status =
                        filters.attendance_status;
                }

                response = await api.get("/attendance", {
                    params,
                });
            } else {
                setRecords([]);

                setError(
                    "Your account does not have permission to view attendance."
                );

                return;
            }

            setRecords(response.data);
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    }, [
        isEmployee,
        canViewAll,
        filters.attendance_date,
        filters.employee_id,
        filters.attendance_status,
    ]);

    useEffect(() => {
        loadAttendance();
    }, [loadAttendance]);

    // ==========================================
    // EMPLOYEE CHECK-IN
    // ==========================================

    const handleCheckIn = async () => {
        setActionLoading(true);
        setError("");
        setMessage("");

        try {
            const response = await api.post(
                "/attendance/check-in"
            );

            setMessage(
                response.data.is_late
                    ? "Check-in recorded. Your attendance is marked late."
                    : "Check-in recorded successfully."
            );

            await loadAttendance();
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setActionLoading(false);
        }
    };

    // ==========================================
    // EMPLOYEE CHECK-OUT
    // ==========================================

    const handleCheckOut = async () => {
        setActionLoading(true);
        setError("");
        setMessage("");

        try {
            const response = await api.post(
                "/attendance/check-out"
            );

            setMessage(
                response.data.is_early_checkout
                    ? "Check-out recorded. Your attendance is marked as an early check-out."
                    : "Check-out recorded successfully."
            );

            await loadAttendance();
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setActionLoading(false);
        }
    };

    // ==========================================
    // FILTER HANDLING
    // ==========================================

    const handleFilterChange = (event) => {
        const { name, value } = event.target;

        setFilters((previous) => ({
            ...previous,
            [name]: value,
        }));
    };

    const clearFilters = () => {
        setFilters({
            attendance_date: "",
            employee_id: "",
            attendance_status: "",
        });
    };

    // ==========================================
    // ATTENDANCE STATISTICS
    // ==========================================

    const presentCount = records.filter(
        (record) => record.status === "PRESENT"
    ).length;

    const halfDayCount = records.filter(
        (record) => record.status === "HALF_DAY"
    ).length;

    const absentCount = records.filter(
        (record) => record.status === "ABSENT"
    ).length;

    const lateCount = records.filter(
        (record) => record.is_late
    ).length;

    const earlyCheckoutCount = records.filter(
        (record) => record.is_early_checkout
    ).length;

    // ==========================================
    // ATTENDANCE PAGE
    // ==========================================

    return (
        <section className="attendance-page">

            {/* PAGE HEADING */}

            <div className="attendance-heading">
                <div>
                    <span className="attendance-eyebrow">
                        WORKSPHERE / HR MANAGEMENT
                    </span>

                    <h2>Attendance Management</h2>

                    <p>
                        {isEmployee
                            ? "Manage your daily attendance and track your working hours."
                            : "Monitor employee attendance, review working hours, and filter records."}
                    </p>
                </div>

                <button
                    type="button"
                    className="attendance-refresh-button"
                    onClick={loadAttendance}
                    disabled={loading}
                >
                    {loading ? "Refreshing..." : "Refresh"}
                </button>
            </div>

            {/* ERROR MESSAGE */}

            {error && (
                <div
                    className="attendance-alert attendance-alert-error"
                    role="alert"
                >
                    {error}
                </div>
            )}

            {/* SUCCESS MESSAGE */}

            {message && (
                <div
                    className="attendance-alert attendance-alert-success"
                    role="status"
                >
                    {message}
                </div>
            )}

            {/* EMPLOYEE CHECK-IN / CHECK-OUT CARD */}

            {isEmployee && (
                <div className="attendance-check-card">

                    <div className="attendance-check-info">

                        <span className="attendance-card-label">
                            TODAY'S ATTENDANCE
                        </span>

                        <h3>
                            {checkedOut
                                ? "Your workday is completed"
                                : checkedIn
                                  ? "You are checked in"
                                  : "Ready to start your workday?"}
                        </h3>

                        <p>
                            {checkedOut
                                ? "Your check-in and check-out have been recorded."
                                : checkedIn
                                  ? "Remember to check out when your workday ends."
                                  : "Record your check-in to start tracking today's working hours."}
                        </p>

                        {todayRecord && (
                            <div className="attendance-today-details">

                                <div>
                                    <span>Check-in</span>

                                    <strong>
                                        {formatTime(
                                            todayRecord.check_in
                                        )}
                                    </strong>
                                </div>

                                <div>
                                    <span>Check-out</span>

                                    <strong>
                                        {formatTime(
                                            todayRecord.check_out
                                        )}
                                    </strong>
                                </div>

                                <div>
                                    <span>Working hours</span>

                                    <strong>
                                        {formatWorkingHours(
                                            todayRecord.working_hours
                                        )}
                                    </strong>
                                </div>

                                {/* LATE CHECK-IN INDICATOR */}

                                <div>
                                    <span>Check-in status</span>

                                    <strong
                                        className={
                                            todayRecord.is_late
                                                ? "attendance-indicator-late"
                                                : "attendance-indicator-normal"
                                        }
                                    >
                                        {todayRecord.is_late
                                            ? "Late Check-in"
                                            : "On Time"}
                                    </strong>
                                </div>

                                {/* EARLY CHECK-OUT INDICATOR */}

                                {todayRecord.check_out && (
                                    <div>
                                        <span>Check-out status</span>

                                        <strong
                                            className={
                                                todayRecord.is_early_checkout
                                                    ? "attendance-indicator-late"
                                                    : "attendance-indicator-normal"
                                            }
                                        >
                                            {todayRecord.is_early_checkout
                                                ? "Early Check-out"
                                                : "On Time"}
                                        </strong>
                                    </div>
                                )}

                            </div>
                        )}
                    </div>

                    {/* ATTENDANCE ACTION BUTTONS */}

                    <div className="attendance-action-area">

                        {!checkedIn && (
                            <button
                                type="button"
                                className="attendance-action-button check-in-button"
                                onClick={handleCheckIn}
                                disabled={
                                    actionLoading || loading
                                }
                            >
                                {actionLoading
                                    ? "Please wait..."
                                    : "Check In"}
                            </button>
                        )}

                        {checkedIn && !checkedOut && (
                            <button
                                type="button"
                                className="attendance-action-button check-out-button"
                                onClick={handleCheckOut}
                                disabled={
                                    actionLoading || loading
                                }
                            >
                                {actionLoading
                                    ? "Please wait..."
                                    : "Check Out"}
                            </button>
                        )}

                        {checkedOut && (
                            <span className="attendance-completed-badge">
                                Workday Completed
                            </span>
                        )}

                    </div>
                </div>
            )}

            {/* ATTENDANCE STATISTICS */}

            <div className="attendance-stat-grid">

                <div className="attendance-stat-card">
                    <div className="attendance-stat-icon attendance-stat-blue">
                        A
                    </div>

                    <div>
                        <span>Total Records</span>
                        <h3>{records.length}</h3>
                        <p>Attendance entries</p>
                    </div>
                </div>

                <div className="attendance-stat-card">
                    <div className="attendance-stat-icon attendance-stat-green">
                        P
                    </div>

                    <div>
                        <span>Present</span>
                        <h3>{presentCount}</h3>
                        <p>Completed standard hours</p>
                    </div>
                </div>

                <div className="attendance-stat-card">
                    <div className="attendance-stat-icon attendance-stat-orange">
                        H
                    </div>

                    <div>
                        <span>Half Day</span>
                        <h3>{halfDayCount}</h3>
                        <p>Less than four hours</p>
                    </div>
                </div>

                <div className="attendance-stat-card">
                    <div className="attendance-stat-icon attendance-stat-red">
                        A
                    </div>

                    <div>
                        <span>Absent</span>
                        <h3>{absentCount}</h3>
                        <p>Recorded absences</p>
                    </div>
                </div>

                {/* LATE CHECK-IN COUNT */}

                <div className="attendance-stat-card">
                    <div className="attendance-stat-icon attendance-stat-orange">
                        L
                    </div>

                    <div>
                        <span>Late Check-ins</span>
                        <h3>{lateCount}</h3>
                        <p>After 9:45 AM</p>
                    </div>
                </div>

                {/* EARLY CHECK-OUT COUNT */}

                <div className="attendance-stat-card">
                    <div className="attendance-stat-icon attendance-stat-red">
                        E
                    </div>

                    <div>
                        <span>Early Check-outs</span>
                        <h3>{earlyCheckoutCount}</h3>
                        <p>Before 6:30 PM</p>
                    </div>
                </div>

            </div>

            {/* HR / ADMIN FILTERS */}

            {canViewAll && (
                <div className="attendance-filter-card">

                    <div className="attendance-section-heading">
                        <div>
                            <h3>Filter Attendance</h3>

                            <p>
                                Find records by date, employee ID, or status.
                            </p>
                        </div>
                    </div>

                    <div className="attendance-filter-grid">

                        <label>
                            Attendance Date

                            <input
                                type="date"
                                name="attendance_date"
                                value={filters.attendance_date}
                                onChange={handleFilterChange}
                            />
                        </label>

                        <label>
                            Employee ID

                            <input
                                type="number"
                                name="employee_id"
                                min="1"
                                placeholder="Enter employee ID"
                                value={filters.employee_id}
                                onChange={handleFilterChange}
                            />
                        </label>

                        <label>
                            Attendance Status

                            <select
                                name="attendance_status"
                                value={filters.attendance_status}
                                onChange={handleFilterChange}
                            >
                                <option value="">
                                    All statuses
                                </option>

                                <option value="PRESENT">
                                    Present
                                </option>

                                <option value="HALF_DAY">
                                    Half Day
                                </option>

                                <option value="ABSENT">
                                    Absent
                                </option>
                            </select>
                        </label>

                        <button
                            type="button"
                            className="attendance-clear-button"
                            onClick={clearFilters}
                        >
                            Clear Filters
                        </button>

                    </div>
                </div>
            )}

            {/* ATTENDANCE HISTORY TABLE */}

            <div className="attendance-table-card">

                <div className="attendance-section-heading">
                    <div>
                        <h3>
                            {isEmployee
                                ? "My Attendance History"
                                : "Employee Attendance Records"}
                        </h3>

                        <p>
                            {records.length} record
                            {records.length !== 1 ? "s" : ""}
                            {" "}found
                        </p>
                    </div>
                </div>

                {loading ? (
                    <div className="attendance-empty-state">
                        <div className="attendance-spinner"></div>

                        <p>Loading attendance records...</p>
                    </div>
                ) : records.length === 0 ? (
                    <div className="attendance-empty-state">

                        <div className="attendance-empty-icon">
                            A
                        </div>

                        <h3>No attendance records found</h3>

                        <p>
                            {canViewAll
                                ? "Try changing the filters or check again after an employee checks in."
                                : "Your attendance history will appear here after you check in."}
                        </p>

                    </div>
                ) : (
                    <div className="attendance-table-wrapper">

                        <table className="attendance-table">

                            <thead>
                                <tr>
                                    <th>DATE</th>

                                    {canViewAll && (
                                        <th>EMPLOYEE ID</th>
                                    )}

                                    <th>CHECK IN</th>
                                    <th>CHECK-IN STATUS</th>
                                    <th>CHECK OUT</th>
                                    <th>CHECK-OUT STATUS</th>
                                    <th>WORKING HOURS</th>
                                    <th>STATUS</th>
                                </tr>
                            </thead>

                            <tbody>
                                {records.map((record) => (
                                    <tr key={record.id}>

                                        <td>
                                            <strong>
                                                {formatDate(record.date)}
                                            </strong>
                                        </td>

                                        {canViewAll && (
                                            <td>
                                                <span className="attendance-employee-id">
                                                    #{record.employee_id}
                                                </span>
                                            </td>
                                        )}

                                        {/* CHECK-IN TIME */}

                                        <td>
                                            {formatTime(record.check_in)}
                                        </td>

                                        {/* CHECK-IN STATUS */}

                                        <td>
                                            <span
                                                className={
                                                    record.is_late
                                                        ? "attendance-indicator-late"
                                                        : "attendance-indicator-normal"
                                                }
                                            >
                                                {record.is_late
                                                    ? "Late"
                                                    : "On Time"}
                                            </span>
                                        </td>

                                        {/* CHECK-OUT TIME */}

                                        <td>
                                            {formatTime(record.check_out)}
                                        </td>

                                        {/* CHECK-OUT STATUS */}

                                        <td>
                                            {!record.check_out ? (
                                                <span>
                                                    Pending
                                                </span>
                                            ) : (
                                                <span
                                                    className={
                                                        record.is_early_checkout
                                                            ? "attendance-indicator-late"
                                                            : "attendance-indicator-normal"
                                                    }
                                                >
                                                    {record.is_early_checkout
                                                        ? "Early"
                                                        : "On Time"}
                                                </span>
                                            )}
                                        </td>

                                        {/* WORKING HOURS */}

                                        <td>
                                            <strong>
                                                {formatWorkingHours(
                                                    record.working_hours
                                                )}
                                            </strong>
                                        </td>

                                        {/* ATTENDANCE STATUS */}

                                        <td>
                                            <span
                                                className={`attendance-status-badge status-${record.status.toLowerCase()}`}
                                            >
                                                {record.status.replace(
                                                    "_",
                                                    " "
                                                )}
                                            </span>
                                        </td>

                                    </tr>
                                ))}
                            </tbody>

                        </table>
                    </div>
                )}
            </div>

            {/* ATTENDANCE POLICY */}

            <div className="attendance-note">

                <strong>Attendance policy</strong>

                <p>
                    Office check-in time is 9:30 AM, with a 15-minute
                    grace period. Check-ins after 9:45 AM are marked
                    late. Check-outs before 6:30 PM are marked as
                    early check-outs.
                </p>

                <p>
                    Working hours are calculated from check-in to
                    check-out. Less than four hours is classified
                    as HALF_DAY, and four hours or more is classified
                    as PRESENT.
                </p>

            </div>

        </section>
    );
}

export default Attendance;
