
import { useCallback, useEffect, useMemo, useState } from "react";

import {
    getMyOnboardingTasks,
    getAllOnboardingTasks,
    createOnboardingTask,
    completeMyOnboardingTask,
    deleteOnboardingTask,
} from "../services/onboardingService";

import "../style/Onboarding.css";

function Onboarding({ user }) {
    const role = String(user?.role || "").toUpperCase();
    const isHROrAdmin = role === "HR" || role === "ADMIN";

    const [tasks, setTasks] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const [statusFilter, setStatusFilter] = useState("ALL");
    const [employeeFilter, setEmployeeFilter] = useState("");

    const [form, setForm] = useState({
        employee_id: "",
        task_name: "",
        due_date: "",
    });

    const loadTasks = useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            const data = isHROrAdmin
                ? await getAllOnboardingTasks({
                      task_status:
                          statusFilter === "ALL" ? "" : statusFilter,
                      employee_id: employeeFilter || "",
                  })
                : await getMyOnboardingTasks();

            setTasks(Array.isArray(data) ? data : []);
        } catch (err) {
            setError(
                err.response?.data?.detail ||
                    "Unable to load onboarding tasks."
            );
        } finally {
            setLoading(false);
        }
    }, [isHROrAdmin, statusFilter, employeeFilter]);

    const loadEmployees = useCallback(async () => {
        if (!isHROrAdmin) return;

        try {
            const { data } = await (
                await import("../services/api")
            ).default.get("/employees");

            setEmployees(Array.isArray(data) ? data : []);
        } catch (err) {
            setError(
                err.response?.data?.detail ||
                    "Unable to load employees for task assignment."
            );
        }
    }, [isHROrAdmin]);

    useEffect(() => {
        loadTasks();
    }, [loadTasks]);

    useEffect(() => {
        loadEmployees();
    }, [loadEmployees]);

    const statistics = useMemo(() => {
        const total = tasks.length;
        const completed = tasks.filter(
            (task) => task.status === "COMPLETED"
        ).length;
        const pending = total - completed;

        return {
            total,
            completed,
            pending,
            percentage:
                total > 0 ? Math.round((completed / total) * 100) : 0,
        };
    }, [tasks]);

    const handleFormChange = (event) => {
        const { name, value } = event.target;

        setForm((previous) => ({
            ...previous,
            [name]: value,
        }));
    };

    const handleCreateTask = async (event) => {
        event.preventDefault();

        setError("");
        setSuccess("");

        if (!form.employee_id) {
            setError("Please select an employee.");
            return;
        }

        if (form.task_name.trim().length < 2) {
            setError("Task name must contain at least 2 characters.");
            return;
        }

        if (!form.due_date) {
            setError("Please select a due date.");
            return;
        }

        if (form.due_date < new Date().toLocaleDateString("en-CA")) {
            setError("Due date cannot be in the past.");
            return;
        }

        setSubmitting(true);

        try {
            await createOnboardingTask({
                employee_id: Number(form.employee_id),
                task_name: form.task_name.trim(),
                status: "PENDING",
                due_date: form.due_date,
            });

            setForm({
                employee_id: "",
                task_name: "",
                due_date: "",
            });

            setSuccess("Onboarding task assigned successfully.");
            await loadTasks();
        } catch (err) {
            setError(
                err.response?.data?.detail ||
                    "Unable to assign the onboarding task."
            );
        } finally {
            setSubmitting(false);
        }
    };

    const handleCompleteTask = async (taskId) => {
        setError("");
        setSuccess("");

        try {
            await completeMyOnboardingTask(taskId);
            setSuccess("Onboarding task marked as completed.");
            await loadTasks();
        } catch (err) {
            setError(
                err.response?.data?.detail ||
                    "Unable to complete this onboarding task."
            );
        }
    };

    const handleDeleteTask = async (taskId) => {
        const confirmed = window.confirm(
            "Are you sure you want to delete this onboarding task?"
        );

        if (!confirmed) return;

        setError("");
        setSuccess("");

        try {
            await deleteOnboardingTask(taskId);
            setSuccess("Onboarding task deleted successfully.");
            await loadTasks();
        } catch (err) {
            setError(
                err.response?.data?.detail ||
                    "Unable to delete this onboarding task."
            );
        }
    };

    const getEmployeeName = (employeeId) => {
        const employee = employees.find(
            (item) => item.id === employeeId
        );

        return (
            employee?.full_name ||
            employee?.name ||
            `Employee #${employeeId}`
        );
    };

    return (
        <section className="onboarding-page">
            <div className="onboarding-heading">
                <div>
                    <span className="onboarding-eyebrow">
                        MODULE 21 · EMPLOYEE EXPERIENCE
                    </span>

                    <h2>Employee Onboarding</h2>

                    <p>
                        {isHROrAdmin
                            ? "Assign onboarding activities and monitor employee progress."
                            : "Complete your onboarding checklist and track your progress."}
                    </p>
                </div>

                <button
                    type="button"
                    className="onboarding-refresh"
                    onClick={loadTasks}
                    disabled={loading}
                >
                    {loading ? "Refreshing..." : "Refresh"}
                </button>
            </div>

            {error && (
                <div className="onboarding-alert onboarding-alert-error">
                    {error}
                </div>
            )}

            {success && (
                <div className="onboarding-alert onboarding-alert-success">
                    {success}
                </div>
            )}

            <div className="onboarding-stats">
                <article className="onboarding-stat-card">
                    <span>Total Tasks</span>
                    <strong>{statistics.total}</strong>
                    <small>Tasks in this view</small>
                </article>

                <article className="onboarding-stat-card">
                    <span>Pending</span>
                    <strong>{statistics.pending}</strong>
                    <small>Tasks awaiting completion</small>
                </article>

                <article className="onboarding-stat-card">
                    <span>Completed</span>
                    <strong>{statistics.completed}</strong>
                    <small>Finished tasks</small>
                </article>

                <article className="onboarding-stat-card">
                    <span>Completion</span>
                    <strong>{statistics.percentage}%</strong>

                    <div
                        className="onboarding-progress-track"
                        role="progressbar"
                        aria-valuenow={statistics.percentage}
                        aria-valuemin="0"
                        aria-valuemax="100"
                        aria-label="Onboarding completion percentage"
                    >
                        <div
                            className="onboarding-progress-fill"
                            style={{
                                width: `${statistics.percentage}%`,
                            }}
                        />
                    </div>
                </article>
            </div>

            {isHROrAdmin && (
                <section className="onboarding-panel">
                    <div className="onboarding-panel-heading">
                        <div>
                            <h3>Assign Onboarding Task</h3>
                            <p>
                                Create a checklist item for an employee.
                            </p>
                        </div>
                    </div>

                    <form
                        className="onboarding-form"
                        onSubmit={handleCreateTask}
                    >
                        <div className="onboarding-field">
                            <label htmlFor="onboarding-employee">
                                Employee
                            </label>

                            <select
                                id="onboarding-employee"
                                name="employee_id"
                                value={form.employee_id}
                                onChange={handleFormChange}
                                required
                            >
                                <option value="">
                                    Select employee
                                </option>

                                {employees.map((employee) => (
                                    <option
                                        key={employee.id}
                                        value={employee.id}
                                    >
                                        {employee.full_name ||
                                            employee.name ||
                                            `Employee #${employee.id}`}
                                        {" · "}
                                        {employee.employee_code ||
                                            `ID ${employee.id}`}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="onboarding-field">
                            <label htmlFor="onboarding-task-name">
                                Task Name
                            </label>

                            <input
                                id="onboarding-task-name"
                                type="text"
                                name="task_name"
                                value={form.task_name}
                                onChange={handleFormChange}
                                placeholder="e.g. Submit ID proof"
                                minLength={2}
                                maxLength={200}
                                required
                            />
                        </div>

                        <div className="onboarding-field">
                            <label htmlFor="onboarding-due-date">
                                Due Date
                            </label>

                            <input
                                id="onboarding-due-date"
                                type="date"
                                name="due_date"
                                value={form.due_date}
                                min={new Date()
                                    .toLocaleDateString("en-CA")}
                                onChange={handleFormChange}
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            className="onboarding-primary-button"
                            disabled={submitting}
                        >
                            {submitting
                                ? "Assigning..."
                                : "Assign Task"}
                        </button>
                    </form>
                </section>
            )}

            <section className="onboarding-panel">
                <div className="onboarding-panel-heading onboarding-list-heading">
                    <div>
                        <h3>
                            {isHROrAdmin
                                ? "Onboarding Tasks"
                                : "My Onboarding Checklist"}
                        </h3>

                        <p>
                            Review task details, deadlines, and status.
                        </p>
                    </div>

                    {isHROrAdmin && (
                        <div className="onboarding-filters">
                            <select
                                aria-label="Filter by status"
                                value={statusFilter}
                                onChange={(event) =>
                                    setStatusFilter(event.target.value)
                                }
                            >
                                <option value="ALL">All statuses</option>
                                <option value="PENDING">Pending</option>
                                <option value="COMPLETED">
                                    Completed
                                </option>
                            </select>

                            <select
                                aria-label="Filter by employee"
                                value={employeeFilter}
                                onChange={(event) =>
                                    setEmployeeFilter(event.target.value)
                                }
                            >
                                <option value="">All employees</option>

                                {employees.map((employee) => (
                                    <option
                                        key={employee.id}
                                        value={employee.id}
                                    >
                                        {employee.full_name ||
                                            employee.name ||
                                            `Employee #${employee.id}`}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                {loading ? (
                    <div className="onboarding-empty-state">
                        Loading onboarding tasks...
                    </div>
                ) : tasks.length === 0 ? (
                    <div className="onboarding-empty-state">
                        <h4>No onboarding tasks found</h4>
                        <p>
                            {isHROrAdmin
                                ? "Assign a task or adjust your filters."
                                : "Your onboarding checklist is currently empty."}
                        </p>
                    </div>
                ) : (
                    <div className="onboarding-task-list">
                        {tasks.map((task) => (
                            <article
                                className="onboarding-task-card"
                                key={task.id}
                            >
                                <div className="onboarding-task-icon">
                                    {task.status === "COMPLETED"
                                        ? "✓"
                                        : "○"}
                                </div>

                                <div className="onboarding-task-content">
                                    <h4>{task.task_name}</h4>

                                    <div className="onboarding-task-meta">
                                        {isHROrAdmin && (
                                            <span>
                                                {getEmployeeName(
                                                    task.employee_id
                                                )}
                                            </span>
                                        )}

                                        <span>
                                            Due{" "}
                                            {new Date(
                                                `${task.due_date}T00:00:00`
                                            ).toLocaleDateString()}
                                        </span>

                                        <span>
                                            Task #{task.id}
                                        </span>
                                    </div>
                                </div>

                                <span
                                    className={`onboarding-status onboarding-status-${task.status.toLowerCase()}`}
                                >
                                    {task.status}
                                </span>

                                {!isHROrAdmin &&
                                    task.status === "PENDING" && (
                                        <button
                                            type="button"
                                            className="onboarding-complete-button"
                                            onClick={() =>
                                                handleCompleteTask(task.id)
                                            }
                                        >
                                            Mark Complete
                                        </button>
                                    )}

                                {isHROrAdmin && (
                                    <button
                                        type="button"
                                        className="onboarding-delete-button"
                                        onClick={() =>
                                            handleDeleteTask(task.id)
                                        }
                                        aria-label={`Delete ${task.task_name}`}
                                    >
                                        Delete
                                    </button>
                                )}
                            </article>
                        ))}
                    </div>
                )}
            </section>
        </section>
    );
}

export default Onboarding;
