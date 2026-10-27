
import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../services/api";
import "../style/LeaveCalendar.css";

function LeaveCalendar() {
    const today = new Date();

    const [currentMonth, setCurrentMonth] = useState(
        new Date(today.getFullYear(), today.getMonth(), 1)
    );
    const [selectedDate, setSelectedDate] = useState(
        formatDate(today)
    );
    const [department, setDepartment] = useState("");
    const [calendarItems, setCalendarItems] = useState([]);
    const [availability, setAvailability] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    function formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");

        return `${year}-${month}-${day}`;
    }

    const monthLabel = useMemo(
        () =>
            currentMonth.toLocaleDateString("en-IN", {
                month: "long",
                year: "numeric",
            }),
        [currentMonth]
    );

    const loadData = useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            const year = currentMonth.getFullYear();
            const month = currentMonth.getMonth();

            const startDate = formatDate(
                new Date(year, month, 1)
            );

            const endDate = formatDate(
                new Date(year, month + 1, 0)
            );

            const calendarParams = {
                start_date: startDate,
                end_date: endDate,
            };

            const availabilityParams = {
                selected_date: selectedDate,
            };

            if (department.trim()) {
                calendarParams.department = department.trim();
                availabilityParams.department = department.trim();
            }

            const [calendarResponse, availabilityResponse] =
                await Promise.all([
                    api.get("/leave-calendar", {
                        params: calendarParams,
                    }),
                    api.get("/leave-calendar/team-availability", {
                        params: availabilityParams,
                    }),
                ]);

            setCalendarItems(
                calendarResponse.data.items || []
            );

            setAvailability(availabilityResponse.data);
        } catch (err) {
            setError(
                err.response?.data?.detail ||
                    "Unable to load leave calendar. Please try again."
            );
        } finally {
            setLoading(false);
        }
    }, [currentMonth, selectedDate, department]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const calendarDays = useMemo(() => {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();

        const firstWeekday = new Date(
            year,
            month,
            1
        ).getDay();

        const daysInMonth = new Date(
            year,
            month + 1,
            0
        ).getDate();

        const cells = [];

        for (let i = 0; i < firstWeekday; i += 1) {
            cells.push(null);
        }

        for (let day = 1; day <= daysInMonth; day += 1) {
            cells.push(
                formatDate(new Date(year, month, day))
            );
        }

        while (cells.length % 7 !== 0) {
            cells.push(null);
        }

        return cells;
    }, [currentMonth]);

    function getLeavesForDate(dateString) {
        return calendarItems.filter(
            (leave) =>
                leave.start_date <= dateString &&
                leave.end_date >= dateString
        );
    }

    function changeMonth(offset) {
        setCurrentMonth(
            (previous) =>
                new Date(
                    previous.getFullYear(),
                    previous.getMonth() + offset,
                    1
                )
        );
    }

    function goToToday() {
        setCurrentMonth(
            new Date(today.getFullYear(), today.getMonth(), 1)
        );
        setSelectedDate(formatDate(today));
    }

    function selectDate(dateString) {
        if (dateString) {
            setSelectedDate(dateString);
        }
    }

    return (
        <div className="leave-calendar-page">
            <div className="lc-page-header">
                <div>
                    <span className="lc-eyebrow">
                        PEOPLE &amp; AVAILABILITY
                    </span>

                    <h1>Leave Calendar</h1>

                    <p>
                        Plan team availability and view approved
                        employee leaves in one place.
                    </p>
                </div>

                <button
                    type="button"
                    className="lc-refresh-button"
                    onClick={loadData}
                    disabled={loading}
                >
                    {loading ? "Loading..." : "↻ Refresh"}
                </button>
            </div>

            <div className="lc-filter-panel">
                <label htmlFor="lc-department">
                    Department
                </label>

                <select
                    id="lc-department"
                    value={department}
                    onChange={(event) =>
                        setDepartment(event.target.value)
                    }
                >
                    <option value="">All Departments</option>
                    <option value="IT">IT</option>
                    <option value="HR">HR</option>
                    <option value="Finance">Finance</option>
                    <option value="Marketing">Marketing</option>
                    <option value="Sales">Sales</option>
                </select>

                <span className="lc-filter-hint">
                    Select a department to filter the calendar
                    and availability.
                </span>
            </div>

            {error && (
                <div className="lc-error" role="alert">
                    {error}
                    <button
                        type="button"
                        onClick={loadData}
                    >
                        Retry
                    </button>
                </div>
            )}

            <div className="lc-stat-grid">
                <div className="lc-stat-card">
                    <span className="lc-stat-label">
                        Active Employees
                    </span>

                    <strong>
                        {availability?.total_active_employees ?? "—"}
                    </strong>

                    <span className="lc-stat-note">
                        In selected department
                    </span>
                </div>

                <div className="lc-stat-card lc-stat-leave">
                    <span className="lc-stat-label">
                        Employees on Leave
                    </span>

                    <strong>
                        {availability?.employees_on_leave ?? "—"}
                    </strong>

                    <span className="lc-stat-note">
                        Approved leave on selected date
                    </span>
                </div>

                <div className="lc-stat-card lc-stat-available">
                    <span className="lc-stat-label">
                        Employees Available
                    </span>

                    <strong>
                        {availability?.available_employees ?? "—"}
                    </strong>

                    <span className="lc-stat-note">
                        Not on approved leave
                    </span>
                </div>

                <div className="lc-stat-card lc-stat-percentage">
                    <span className="lc-stat-label">
                        Leave Percentage
                    </span>

                    <strong>
                        {availability
                            ? `${availability.leave_percentage}%`
                            : "—"}
                    </strong>

                    <span className="lc-stat-note">
                        For the selected date
                    </span>
                </div>
            </div>

            <div className="lc-main-grid">
                <section className="lc-panel lc-calendar-panel">
                    <div className="lc-calendar-heading">
                        <div>
                            <h2>{monthLabel}</h2>
                            <p>
                                Select a date to view team availability.
                            </p>
                        </div>

                        <div className="lc-month-controls">
                            <button
                                type="button"
                                onClick={() => changeMonth(-1)}
                                aria-label="Previous month"
                            >
                                ‹
                            </button>

                            <button
                                type="button"
                                onClick={goToToday}
                            >
                                Today
                            </button>

                            <button
                                type="button"
                                onClick={() => changeMonth(1)}
                                aria-label="Next month"
                            >
                                ›
                            </button>
                        </div>
                    </div>

                    <div className="lc-calendar-grid">
                        {[
                            "Sun",
                            "Mon",
                            "Tue",
                            "Wed",
                            "Thu",
                            "Fri",
                            "Sat",
                        ].map((day) => (
                            <div
                                className="lc-weekday"
                                key={day}
                            >
                                {day}
                            </div>
                        ))}

                        {calendarDays.map((dateString, index) => {
                            if (!dateString) {
                                return (
                                    <div
                                        className="lc-day lc-empty-day"
                                        key={`empty-${index}`}
                                    />
                                );
                            }

                            const dayNumber = Number(
                                dateString.slice(-2)
                            );

                            const leaves =
                                getLeavesForDate(dateString);

                            const isSelected =
                                selectedDate === dateString;

                            const isToday =
                                formatDate(today) === dateString;

                            return (
                                <button
                                    type="button"
                                    key={dateString}
                                    className={[
                                        "lc-day",
                                        isSelected
                                            ? "lc-day-selected"
                                            : "",
                                        isToday
                                            ? "lc-day-today"
                                            : "",
                                    ]
                                        .filter(Boolean)
                                        .join(" ")}
                                    onClick={() =>
                                        selectDate(dateString)
                                    }
                                    aria-pressed={isSelected}
                                >
                                    <span className="lc-day-number">
                                        {dayNumber}
                                    </span>

                                    {leaves.length > 0 && (
                                        <span className="lc-day-events">
                                            <span className="lc-event-dot" />
                                            <span>
                                                {leaves.length}{" "}
                                                {leaves.length === 1
                                                    ? "leave"
                                                    : "leaves"}
                                            </span>
                                        </span>
                                    )}

                                    {leaves.slice(0, 2).map(
                                        (leave) => (
                                            <span
                                                className="lc-leave-chip"
                                                key={leave.leave_id}
                                                title={`${leave.employee_name} — ${leave.leave_type}`}
                                            >
                                                {leave.employee_name}
                                            </span>
                                        )
                                    )}

                                    {leaves.length > 2 && (
                                        <span className="lc-more-events">
                                            +{leaves.length - 2} more
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    <div className="lc-calendar-legend">
                        <span>
                            <i className="lc-legend-dot" />
                            Approved leave
                        </span>

                        <span>
                            <i className="lc-legend-today" />
                            Today
                        </span>

                        <span>
                            <i className="lc-legend-selected" />
                            Selected date
                        </span>
                    </div>
                </section>

                <section className="lc-panel lc-team-panel">
                    <div className="lc-team-heading">
                        <div>
                            <h2>Team Availability</h2>

                            <p>
                                {selectedDate
                                    ? new Date(
                                          `${selectedDate}T12:00:00`
                                      ).toLocaleDateString(
                                          "en-IN",
                                          {
                                              day: "numeric",
                                              month: "short",
                                              year: "numeric",
                                          }
                                      )
                                    : ""}
                            </p>
                        </div>

                        <span className="lc-team-badge">
                            {availability?.employees_on_leave ?? 0} on leave
                        </span>
                    </div>

                    {loading ? (
                        <div className="lc-state-message">
                            Loading team availability...
                        </div>
                    ) : (
                        <>
                            <h3 className="lc-list-title">
                                On Approved Leave
                            </h3>

                            {availability?.on_leave?.length ? (
                                <div className="lc-employee-list">
                                    {availability.on_leave.map(
                                        (employee) => (
                                            <div
                                                className="lc-employee-row"
                                                key={employee.employee_id}
                                            >
                                                <div className="lc-avatar lc-avatar-leave">
                                                    {employee.employee_name
                                                        .charAt(0)
                                                        .toUpperCase()}
                                                </div>

                                                <div className="lc-employee-info">
                                                    <strong>
                                                        {employee.employee_name}
                                                    </strong>

                                                    <span>
                                                        {employee.department}
                                                        {" · "}
                                                        {employee.employee_code}
                                                    </span>
                                                </div>

                                                <span className="lc-status-pill lc-status-leave">
                                                    On leave
                                                </span>
                                            </div>
                                        )
                                    )}
                                </div>
                            ) : (
                                <div className="lc-empty-state">
                                    <span>✓</span>
                                    <strong>
                                        No employees on leave
                                    </strong>
                                    <p>
                                        No approved leave found for this
                                        date.
                                    </p>
                                </div>
                            )}

                            <h3 className="lc-list-title lc-available-title">
                                Available Employees
                            </h3>

                            {availability?.available?.length ? (
                                <div className="lc-employee-list">
                                    {availability.available.map(
                                        (employee) => (
                                            <div
                                                className="lc-employee-row"
                                                key={employee.employee_id}
                                            >
                                                <div className="lc-avatar lc-avatar-available">
                                                    {employee.employee_name
                                                        .charAt(0)
                                                        .toUpperCase()}
                                                </div>

                                                <div className="lc-employee-info">
                                                    <strong>
                                                        {employee.employee_name}
                                                    </strong>

                                                    <span>
                                                        {employee.department}
                                                        {" · "}
                                                        {employee.employee_code}
                                                    </span>
                                                </div>

                                                <span className="lc-status-pill lc-status-available">
                                                    Available
                                                </span>
                                            </div>
                                        )
                                    )}
                                </div>
                            ) : (
                                <div className="lc-empty-state lc-empty-compact">
                                    No available employees for this filter.
                                </div>
                            )}
                        </>
                    )}
                </section>
            </div>

            <section className="lc-panel lc-monthly-summary">
                <div>
                    <h2>Monthly Leave Summary</h2>
                    <p>
                        Approved leave periods overlapping{" "}
                        {monthLabel}.
                    </p>
                </div>

                <span className="lc-summary-count">
                    {calendarItems.length}{" "}
                    {calendarItems.length === 1
                        ? "leave record"
                        : "leave records"}
                </span>

                {calendarItems.length > 0 && (
                    <div className="lc-summary-table-wrap">
                        <table className="lc-summary-table">
                            <thead>
                                <tr>
                                    <th>Employee</th>
                                    <th>Department</th>
                                    <th>Leave Type</th>
                                    <th>Start Date</th>
                                    <th>End Date</th>
                                </tr>
                            </thead>

                            <tbody>
                                {calendarItems.map((leave) => (
                                    <tr key={leave.leave_id}>
                                        <td>
                                            <strong>
                                                {leave.employee_name}
                                            </strong>

                                            <span className="lc-table-code">
                                                {leave.employee_code}
                                            </span>
                                        </td>

                                        <td>{leave.department}</td>

                                        <td>
                                            <span className="lc-leave-type">
                                                {leave.leave_type}
                                            </span>
                                        </td>

                                        <td>{leave.start_date}</td>
                                        <td>{leave.end_date}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </div>
    );
}

export default LeaveCalendar;
