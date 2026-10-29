import { useCallback, useEffect, useState } from "react";
import api from "../services/api";
import "../style/ShiftManagement.css";

const EMPTY_FORM = {
    employee_id: "",
    shift_id: "",
};

function formatTime(value) {
    if (!value) return "--:--";

    const [hours, minutes] = value.split(":");
    const hour = Number(hours);

    const period = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;

    return `${String(displayHour).padStart(2, "0")}:${minutes} ${period}`;
}

function formatDate(value) {
    if (!value) return "Not available";

    return new Date(value).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}

function ShiftManagement({ user }) {
    const isAdminOrHR =
        user?.role === "ADMIN" || user?.role === "HR";

    const [shifts, setShifts] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [assignments, setAssignments] = useState([]);
    const [mySchedule, setMySchedule] = useState(null);

    const [form, setForm] = useState(EMPTY_FORM);
    const [shiftForm, setShiftForm] = useState({
        name: "Morning",
        start_time: "09:30",
        end_time: "18:30",
    });

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [creatingShift, setCreatingShift] = useState(false);
    const [showCreateForm, setShowCreateForm] = useState(false);

    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const getErrorMessage = (err) => {
        const detail = err.response?.data?.detail;

        if (Array.isArray(detail)) {
            return detail
                .map((item) => item.msg)
                .join(", ");
        }

        if (typeof detail === "string") {
            return detail;
        }

        if (err.response?.status === 401) {
            return "Your session may have expired. Please log in again.";
        }

        if (err.response?.status === 403) {
            return "You do not have permission to perform this action.";
        }

        return "Something went wrong. Please try again.";
    };

    const loadData = useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            if (isAdminOrHR) {
                const [shiftResponse, employeeResponse, assignmentResponse] =
                    await Promise.all([
                        api.get("/shifts"),
                        api.get("/employees"),
                        api.get("/shifts/assignments"),
                    ]);

                setShifts(
                    Array.isArray(shiftResponse.data)
                        ? shiftResponse.data
                        : []
                );

                setEmployees(
                    Array.isArray(employeeResponse.data)
                        ? employeeResponse.data
                        : []
                );

                setAssignments(
                    Array.isArray(assignmentResponse.data)
                        ? assignmentResponse.data
                        : []
                );
            } else {
                const [shiftResponse, scheduleResponse] =
                    await Promise.all([
                        api.get("/shifts"),
                        api.get("/shifts/my/schedule"),
                    ]);

                setShifts(
                    Array.isArray(shiftResponse.data)
                        ? shiftResponse.data
                        : []
                );

                setMySchedule(scheduleResponse.data);
            }
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    }, [isAdminOrHR]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleAssignment = async (event) => {
        event.preventDefault();

        setError("");
        setSuccess("");

        if (!form.employee_id || !form.shift_id) {
            setError("Please select an employee and a shift.");
            return;
        }

        setSubmitting(true);

        try {
            await api.post("/shifts/assign", {
                employee_id: Number(form.employee_id),
                shift_id: Number(form.shift_id),
            });

            setSuccess("Shift assigned successfully.");
            setForm(EMPTY_FORM);

            await loadData();
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setSubmitting(false);
        }
    };

    const handleCreateShift = async (event) => {
        event.preventDefault();

        setError("");
        setSuccess("");

        if (
            !shiftForm.name ||
            !shiftForm.start_time ||
            !shiftForm.end_time
        ) {
            setError("Please complete all shift fields.");
            return;
        }

        if (shiftForm.start_time === shiftForm.end_time) {
            setError("Shift start and end times cannot be identical.");
            return;
        }

        setCreatingShift(true);

        try {
            await api.post("/shifts", {
                name: shiftForm.name,
                start_time: `${shiftForm.start_time}:00`,
                end_time: `${shiftForm.end_time}:00`,
            });

            setSuccess(`${shiftForm.name} shift created successfully.`);
            setShowCreateForm(false);

            await loadData();
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setCreatingShift(false);
        }
    };

    const getEmployeeName = (employeeId) => {
        const employee = employees.find(
            (item) => item.id === employeeId
        );

        return employee?.full_name || `Employee #${employeeId}`;
    };

    const getShiftName = (shiftId) => {
        const shift = shifts.find(
            (item) => item.id === shiftId
        );

        return shift?.name || `Shift #${shiftId}`;
    };

    const getShiftClass = (name) => {
        switch (name?.toLowerCase()) {
            case "morning":
                return "morning";

            case "evening":
                return "evening";

            case "night":
                return "night";

            default:
                return "other";
        }
    };

    if (loading) {
        return (
            <div className="shift-loading">
                <div className="shift-spinner"></div>
                <p>Loading shift management...</p>
            </div>
        );
    }

    return (
        <section className="shift-page">
            <div className="shift-page-header">
                <div>
                    <span className="shift-eyebrow">
                        WORKSPHERE / MODULE 14
                    </span>

                    <h2>Shift Management</h2>

                    <p>
                        Manage work schedules and employee shift assignments.
                    </p>
                </div>

                <button
                    type="button"
                    className="shift-refresh-button"
                    onClick={loadData}
                    disabled={loading}
                >
                    Refresh
                </button>
            </div>

            {error && (
                <div className="shift-alert shift-alert-error">
                    <span>{error}</span>

                    <button
                        type="button"
                        onClick={() => setError("")}
                        aria-label="Dismiss error"
                    >
                        ×
                    </button>
                </div>
            )}

            {success && (
                <div className="shift-alert shift-alert-success">
                    <span>{success}</span>

                    <button
                        type="button"
                        onClick={() => setSuccess("")}
                        aria-label="Dismiss success message"
                    >
                        ×
                    </button>
                </div>
            )}

            {!isAdminOrHR && (
                <div className="shift-section">
                    <div className="shift-section-heading">
                        <div>
                            <h3>My Work Schedule</h3>
                            <p>Your currently assigned shift.</p>
                        </div>
                    </div>

                    {mySchedule?.shift_assigned ? (
                        <div className="my-shift-card">
                            <div
                                className={`shift-card-icon ${getShiftClass(
                                    mySchedule.shift.name
                                )}`}
                            >
                                {mySchedule.shift.name
                                    .charAt(0)
                                    .toUpperCase()}
                            </div>

                            <div className="my-shift-details">
                                <span className="shift-card-label">
                                    ASSIGNED SHIFT
                                </span>

                                <h3>{mySchedule.shift.name}</h3>

                                <p>
                                    {formatTime(
                                        mySchedule.shift.start_time
                                    )}
                                    {" – "}
                                    {formatTime(
                                        mySchedule.shift.end_time
                                    )}
                                </p>

                                {mySchedule.shift.is_overnight && (
                                    <span className="shift-overnight-tag">
                                        Overnight shift
                                    </span>
                                )}

                                <span className="shift-assigned-date">
                                    Assigned on{" "}
                                    {formatDate(mySchedule.assigned_at)}
                                </span>
                            </div>
                        </div>
                    ) : (
                        <div className="shift-empty-state">
                            <div className="shift-empty-icon">S</div>

                            <h3>No shift assigned yet</h3>

                            <p>
                                Your HR team or administrator has not
                                assigned a shift to you yet.
                            </p>
                        </div>
                    )}
                </div>
            )}

            {isAdminOrHR && (
                <>
                    <div className="shift-stat-grid">
                        <div className="shift-stat-card">
                            <div className="shift-stat-icon shift-stat-purple">
                                S
                            </div>

                            <div>
                                <span>Available Shifts</span>
                                <strong>{shifts.length}</strong>
                            </div>
                        </div>

                        <div className="shift-stat-card">
                            <div className="shift-stat-icon shift-stat-blue">
                                E
                            </div>

                            <div>
                                <span>Active Employees</span>
                                <strong>
                                    {
                                        employees.filter(
                                            (employee) =>
                                                employee.employment_status ===
                                                "ACTIVE"
                                        ).length
                                    }
                                </strong>
                            </div>
                        </div>

                        <div className="shift-stat-card">
                            <div className="shift-stat-icon shift-stat-green">
                                A
                            </div>

                            <div>
                                <span>Shift Assignments</span>
                                <strong>{assignments.length}</strong>
                            </div>
                        </div>
                    </div>

                    <div className="shift-section">
                        <div className="shift-section-heading">
                            <div>
                                <h3>Available Shifts</h3>
                                <p>
                                    Review the working hours configured
                                    for your organization.
                                </p>
                            </div>

                            <button
                                type="button"
                                className="shift-primary-button"
                                onClick={() =>
                                    setShowCreateForm((previous) => !previous)
                                }
                            >
                                {showCreateForm
                                    ? "Cancel"
                                    : "+ Create Shift"}
                            </button>
                        </div>

                        {showCreateForm && (
                            <form
                                className="shift-create-form"
                                onSubmit={handleCreateShift}
                            >
                                <div className="shift-form-field">
                                    <label htmlFor="shift-name">
                                        Shift Name
                                    </label>

                                    <select
                                        id="shift-name"
                                        value={shiftForm.name}
                                        onChange={(event) =>
                                            setShiftForm({
                                                ...shiftForm,
                                                name: event.target.value,
                                            })
                                        }
                                    >
                                        <option value="Morning">
                                            Morning
                                        </option>

                                        <option value="Evening">
                                            Evening
                                        </option>

                                        <option value="Night">
                                            Night
                                        </option>
                                    </select>
                                </div>

                                <div className="shift-form-field">
                                    <label htmlFor="shift-start">
                                        Start Time
                                    </label>

                                    <input
                                        id="shift-start"
                                        type="time"
                                        value={shiftForm.start_time}
                                        onChange={(event) =>
                                            setShiftForm({
                                                ...shiftForm,
                                                start_time: event.target.value,
                                            })
                                        }
                                        required
                                    />
                                </div>

                                <div className="shift-form-field">
                                    <label htmlFor="shift-end">
                                        End Time
                                    </label>

                                    <input
                                        id="shift-end"
                                        type="time"
                                        value={shiftForm.end_time}
                                        onChange={(event) =>
                                            setShiftForm({
                                                ...shiftForm,
                                                end_time: event.target.value,
                                            })
                                        }
                                        required
                                    />
                                </div>

                                <button
                                    type="submit"
                                    className="shift-primary-button"
                                    disabled={creatingShift}
                                >
                                    {creatingShift
                                        ? "Creating..."
                                        : "Save Shift"}
                                </button>
                            </form>
                        )}

                        {shifts.length === 0 ? (
                            <div className="shift-empty-state">
                                <h3>No shifts found</h3>
                                <p>Create a shift to get started.</p>
                            </div>
                        ) : (
                            <div className="shift-card-grid">
                                {shifts.map((shift) => {
                                    const isOvernight =
                                        shift.end_time < shift.start_time;

                                    return (
                                        <article
                                            className="shift-card"
                                            key={shift.id}
                                        >
                                            <div className="shift-card-top">
                                                <div
                                                    className={`shift-card-icon ${getShiftClass(
                                                        shift.name
                                                    )}`}
                                                >
                                                    {shift.name
                                                        .charAt(0)
                                                        .toUpperCase()}
                                                </div>

                                                <span className="shift-id-tag">
                                                    SHIFT #{shift.id}
                                                </span>
                                            </div>

                                            <h3>{shift.name}</h3>

                                            <div className="shift-time-range">
                                                <div>
                                                    <span>START</span>
                                                    <strong>
                                                        {formatTime(
                                                            shift.start_time
                                                        )}
                                                    </strong>
                                                </div>

                                                <div className="shift-time-divider">
                                                    →
                                                </div>

                                                <div>
                                                    <span>END</span>
                                                    <strong>
                                                        {formatTime(
                                                            shift.end_time
                                                        )}
                                                    </strong>
                                                </div>
                                            </div>

                                            <div className="shift-card-footer">
                                                {isOvernight
                                                    ? "Ends next day"
                                                    : "Same-day shift"}
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div className="shift-section">
                        <div className="shift-section-heading">
                            <div>
                                <h3>Assign Shift</h3>
                                <p>
                                    Assign a working schedule to an active
                                    employee or update their current shift.
                                </p>
                            </div>
                        </div>

                        <form
                            className="shift-assignment-form"
                            onSubmit={handleAssignment}
                        >
                            <div className="shift-form-field">
                                <label htmlFor="employee-select">
                                    Employee
                                </label>

                                <select
                                    id="employee-select"
                                    value={form.employee_id}
                                    onChange={(event) =>
                                        setForm({
                                            ...form,
                                            employee_id: event.target.value,
                                        })
                                    }
                                    required
                                >
                                    <option value="">
                                        Select an employee
                                    </option>

                                    {employees
                                        .filter(
                                            (employee) =>
                                                employee.employment_status ===
                                                "ACTIVE"
                                        )
                                        .map((employee) => (
                                            <option
                                                key={employee.id}
                                                value={employee.id}
                                            >
                                                {employee.full_name}
                                                {" — ID "}
                                                {employee.id}
                                            </option>
                                        ))}
                                </select>
                            </div>

                            <div className="shift-form-field">
                                <label htmlFor="shift-select">
                                    Shift
                                </label>

                                <select
                                    id="shift-select"
                                    value={form.shift_id}
                                    onChange={(event) =>
                                        setForm({
                                            ...form,
                                            shift_id: event.target.value,
                                        })
                                    }
                                    required
                                >
                                    <option value="">
                                        Select a shift
                                    </option>

                                    {shifts.map((shift) => (
                                        <option
                                            key={shift.id}
                                            value={shift.id}
                                        >
                                            {shift.name}
                                            {" ("}
                                            {formatTime(shift.start_time)}
                                            {" – "}
                                            {formatTime(shift.end_time)}
                                            {")"}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <button
                                type="submit"
                                className="shift-primary-button"
                                disabled={submitting}
                            >
                                {submitting
                                    ? "Assigning..."
                                    : "Assign / Update Shift"}
                            </button>
                        </form>
                    </div>

                    <div className="shift-section">
                        <div className="shift-section-heading">
                            <div>
                                <h3>Employee Shift Assignments</h3>
                                <p>
                                    View the latest assignment for each
                                    employee.
                                </p>
                            </div>
                        </div>

                        {assignments.length === 0 ? (
                            <div className="shift-empty-state">
                                <h3>No assignments found</h3>
                                <p>
                                    Assign a shift to an employee to see
                                    it listed here.
                                </p>
                            </div>
                        ) : (
                            <div className="shift-table-wrapper">
                                <table className="shift-table">
                                    <thead>
                                        <tr>
                                            <th>Employee</th>
                                            <th>Employee ID</th>
                                            <th>Assigned Shift</th>
                                            <th>Shift ID</th>
                                            <th>Assigned Date</th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {assignments.map((assignment) => (
                                            <tr key={assignment.id}>
                                                <td>
                                                    <div className="shift-employee-cell">
                                                        <span className="shift-employee-avatar">
                                                            {getEmployeeName(
                                                                assignment.employee_id
                                                            )
                                                                .charAt(0)
                                                                .toUpperCase()}
                                                        </span>

                                                        <strong>
                                                            {getEmployeeName(
                                                                assignment.employee_id
                                                            )}
                                                        </strong>
                                                    </div>
                                                </td>

                                                <td>
                                                    {assignment.employee_id}
                                                </td>

                                                <td>
                                                    <span
                                                        className={`shift-name-badge ${getShiftClass(
                                                            getShiftName(
                                                                assignment.shift_id
                                                            )
                                                        )}`}
                                                    >
                                                        {getShiftName(
                                                            assignment.shift_id
                                                        )}
                                                    </span>
                                                </td>

                                                <td>{assignment.shift_id}</td>

                                                <td>
                                                    {formatDate(
                                                        assignment.assigned_at
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}
        </section>
    );
}

export default ShiftManagement;