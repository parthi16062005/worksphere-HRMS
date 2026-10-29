
import { useCallback, useEffect, useState } from "react";
import api from "../services/api";
import {
    getMyTasks,
    getAllTasks,
    createTask,
    updateTask,
    updateMyTaskStatus,
    deleteTask,
} from "../services/taskService";
import "../style/Tasks.css";

function Tasks({ user }) {
    const role = String(user?.role || "").toUpperCase();
    const canManage = role === "HR" || role === "ADMIN";

    const [tasks, setTasks] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const [statusFilter, setStatusFilter] = useState("");
    const [employeeFilter, setEmployeeFilter] = useState("");
    const [search, setSearch] = useState("");

    const [showForm, setShowForm] = useState(false);
    const [editingTask, setEditingTask] = useState(null);

    const emptyForm = {
        assigned_to: "",
        title: "",
        description: "",
        due_date: "",
        status: "PENDING",
    };

    const [form, setForm] = useState(emptyForm);

    const loadTasks = useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            if (canManage) {
                const filters = {};

                if (statusFilter) {
                    filters.status = statusFilter;
                }

                if (employeeFilter) {
                    filters.employee_id = Number(employeeFilter);
                }

                const data = await getAllTasks(filters);
                setTasks(Array.isArray(data) ? data : []);
            } else {
                const data = await getMyTasks(statusFilter);
                setTasks(Array.isArray(data) ? data : []);
            }
        } catch (err) {
            setError(
                err.response?.data?.detail ||
                "Unable to load tasks. Please try again."
            );
        } finally {
            setLoading(false);
        }
    }, [canManage, statusFilter, employeeFilter]);

    const loadEmployees = useCallback(async () => {
        if (!canManage) return;

        try {
            const response = await api.get("/employees");
            const data = response.data;
            setEmployees(Array.isArray(data) ? data : data?.employees || []);
        } catch (err) {
            setError(
                err.response?.data?.detail ||
                "Unable to load employees for task assignment."
            );
        }
    }, [canManage]);

    useEffect(() => {
        loadTasks();
    }, [loadTasks]);

    useEffect(() => {
        loadEmployees();
    }, [loadEmployees]);

    const getEmployeeName = (employeeId) => {
        const employee = employees.find(
            (item) => Number(item.id) === Number(employeeId)
        );

        if (!employee) {
            return `Employee #${employeeId}`;
        }

        const fullName =
            employee.full_name ||
            [employee.first_name, employee.last_name]
                .filter(Boolean)
                .join(" ") ||
            employee.name ||
            employee.employee_name;

        return fullName || employee.employee_code || `Employee #${employeeId}`;
    };

    const handleFormChange = (event) => {
        const { name, value } = event.target;

        setForm((previous) => ({
            ...previous,
            [name]: value,
        }));
    };

    const openCreateForm = () => {
        setEditingTask(null);
        setForm(emptyForm);
        setError("");
        setSuccess("");
        setShowForm(true);
    };

    const openEditForm = (task) => {
        setEditingTask(task);
        setForm({
            assigned_to: String(task.assigned_to),
            title: task.title || "",
            description: task.description || "",
            due_date: task.due_date || "",
            status: task.status || "PENDING",
        });
        setError("");
        setSuccess("");
        setShowForm(true);
    };

    const closeForm = () => {
        setShowForm(false);
        setEditingTask(null);
        setForm(emptyForm);
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError("");
        setSuccess("");

        if (!form.title.trim() || form.title.trim().length < 3) {
            setError("Task title must contain at least 3 characters.");
            return;
        }

        if (
            !form.description.trim() ||
            form.description.trim().length < 5
        ) {
            setError("Description must contain at least 5 characters.");
            return;
        }

        if (!form.due_date) {
            setError("Please select a due date.");
            return;
        }

        if (!editingTask && !form.assigned_to) {
            setError("Please select an employee.");
            return;
        }

        const payload = {
            title: form.title.trim(),
            description: form.description.trim(),
            due_date: form.due_date,
        };

        setSaving(true);

        try {
            if (editingTask) {
                payload.status = form.status;
                await updateTask(editingTask.id, payload);
                setSuccess("Task updated successfully.");
            } else {
                payload.assigned_to = Number(form.assigned_to);
                await createTask(payload);
                setSuccess("Task assigned successfully.");
            }

            closeForm();
            await loadTasks();
        } catch (err) {
            setError(
                err.response?.data?.detail ||
                "Unable to save the task. Please try again."
            );
        } finally {
            setSaving(false);
        }
    };

    const handleStatusChange = async (task, newStatus) => {
        setError("");
        setSuccess("");

        try {
            if (canManage) {
                await updateTask(task.id, { status: newStatus });
            } else {
                await updateMyTaskStatus(task.id, newStatus);
            }

            setSuccess(
                newStatus === "COMPLETED"
                    ? "Task marked as completed."
                    : "Task moved back to pending."
            );

            await loadTasks();
        } catch (err) {
            setError(
                err.response?.data?.detail ||
                "Unable to update task status."
            );
        }
    };

    const handleDelete = async (task) => {
        const confirmed = window.confirm(
            `Are you sure you want to delete "${task.title}"?`
        );

        if (!confirmed) return;

        setError("");
        setSuccess("");

        try {
            await deleteTask(task.id);
            setSuccess("Task deleted successfully.");
            await loadTasks();
        } catch (err) {
            setError(
                err.response?.data?.detail ||
                "Unable to delete the task."
            );
        }
    };

    const filteredTasks = tasks.filter((task) => {
        const query = search.trim().toLowerCase();

        if (!query) return true;

        return (
            String(task.title || "").toLowerCase().includes(query) ||
            String(task.description || "").toLowerCase().includes(query) ||
            String(task.status || "").toLowerCase().includes(query) ||
            getEmployeeName(task.assigned_to).toLowerCase().includes(query)
        );
    });

    const completedCount = tasks.filter(
        (task) => task.status === "COMPLETED"
    ).length;

    const pendingCount = tasks.filter(
        (task) => task.status === "PENDING"
    ).length;

    const completionPercentage =
        tasks.length > 0
            ? Math.round((completedCount / tasks.length) * 100)
            : 0;

    const isOverdue = (task) =>
        task.status !== "COMPLETED" &&
        task.due_date &&
        task.due_date < new Date().toISOString().slice(0, 10);

    return (
        <div className="tasks-page">
            <div className="tasks-header">
                <div>
                    <span className="tasks-eyebrow">
                        MODULE 24 · TASK MANAGEMENT
                    </span>
                    <h1>Task Assignment &amp; Tracking</h1>
                    <p>
                        {canManage
                            ? "Assign work, manage deadlines, and track employee progress."
                            : "View your assigned work and keep your task progress up to date."}
                    </p>
                </div>

                <div className="tasks-header-actions">
                    <button
                        type="button"
                        className="tasks-button tasks-button-secondary"
                        onClick={loadTasks}
                        disabled={loading}
                    >
                        Refresh
                    </button>

                    {canManage && (
                        <button
                            type="button"
                            className="tasks-button tasks-button-primary"
                            onClick={openCreateForm}
                        >
                            + Assign Task
                        </button>
                    )}
                </div>
            </div>

            {error && (
                <div className="tasks-alert tasks-alert-error" role="alert">
                    {error}
                </div>
            )}

            {success && (
                <div className="tasks-alert tasks-alert-success" role="status">
                    {success}
                </div>
            )}

            <div className="tasks-stats-grid">
                <div className="tasks-stat-card">
                    <span className="tasks-stat-label">Total Tasks</span>
                    <strong>{tasks.length}</strong>
                    <span className="tasks-stat-caption">Tasks in this view</span>
                </div>

                <div className="tasks-stat-card">
                    <span className="tasks-stat-label">Pending</span>
                    <strong>{pendingCount}</strong>
                    <span className="tasks-stat-caption">Awaiting completion</span>
                </div>

                <div className="tasks-stat-card">
                    <span className="tasks-stat-label">Completed</span>
                    <strong>{completedCount}</strong>
                    <span className="tasks-stat-caption">Finished tasks</span>
                </div>

                <div className="tasks-stat-card tasks-stat-progress">
                    <span className="tasks-stat-label">Completion</span>
                    <strong>{completionPercentage}%</strong>
                    <div
                        className="tasks-progress-track"
                        role="progressbar"
                        aria-valuenow={completionPercentage}
                        aria-valuemin="0"
                        aria-valuemax="100"
                        aria-label="Task completion"
                    >
                        <div
                            className="tasks-progress-fill"
                            style={{ width: `${completionPercentage}%` }}
                        />
                    </div>
                </div>
            </div>

            <section className="tasks-panel">
                <div className="tasks-panel-heading">
                    <div>
                        <h2>{canManage ? "All Assigned Tasks" : "My Tasks"}</h2>
                        <p>Review task details, deadlines, and completion status.</p>
                    </div>

                    <span className="tasks-result-count">
                        {filteredTasks.length} {filteredTasks.length === 1 ? "task" : "tasks"}
                    </span>
                </div>

                <div className="tasks-filters">
                    <div className="tasks-search-field">
                        <label htmlFor="task-search">Search tasks</label>
                        <input
                            id="task-search"
                            type="search"
                            placeholder="Search title, description, employee..."
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                        />
                    </div>

                    <div className="tasks-filter-field">
                        <label htmlFor="task-status-filter">Status</label>
                        <select
                            id="task-status-filter"
                            value={statusFilter}
                            onChange={(event) => setStatusFilter(event.target.value)}
                        >
                            <option value="">All statuses</option>
                            <option value="PENDING">Pending</option>
                            <option value="COMPLETED">Completed</option>
                        </select>
                    </div>

                    {canManage && (
                        <div className="tasks-filter-field">
                            <label htmlFor="task-employee-filter">Employee</label>
                            <select
                                id="task-employee-filter"
                                value={employeeFilter}
                                onChange={(event) => setEmployeeFilter(event.target.value)}
                            >
                                <option value="">All employees</option>
                                {employees.map((employee) => (
                                    <option key={employee.id} value={employee.id}>
                                        {getEmployeeName(employee.id)}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                {loading ? (
                    <div className="tasks-state">
                        <div className="tasks-spinner" />
                        <p>Loading tasks...</p>
                    </div>
                ) : filteredTasks.length === 0 ? (
                    <div className="tasks-empty-state">
                        <div className="tasks-empty-icon">T</div>
                        <h3>No tasks found</h3>
                        <p>
                            {search || statusFilter || employeeFilter
                                ? "Try changing your search or filters."
                                : canManage
                                  ? "Assign a task to get started."
                                  : "You do not have any assigned tasks yet."}
                        </p>

                        {canManage && (
                            <button
                                type="button"
                                className="tasks-button tasks-button-primary"
                                onClick={openCreateForm}
                            >
                                + Assign Task
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="tasks-list">
                        {filteredTasks.map((task) => (
                            <article className="task-card" key={task.id}>
                                <div className="task-card-main">
                                    <div className="task-card-title-row">
                                        <h3>{task.title}</h3>

                                        <span
                                            className={`task-status-badge ${
                                                task.status === "COMPLETED"
                                                    ? "task-status-completed"
                                                    : "task-status-pending"
                                            }`}
                                        >
                                            {task.status === "COMPLETED"
                                                ? "Completed"
                                                : "Pending"}
                                        </span>
                                    </div>

                                    <p className="task-description">
                                        {task.description}
                                    </p>

                                    <div className="task-meta">
                                        {canManage && (
                                            <span>
                                                <strong>Assigned to:</strong>{" "}
                                                {getEmployeeName(task.assigned_to)}
                                            </span>
                                        )}

                                        <span
                                            className={
                                                isOverdue(task)
                                                    ? "task-due-date task-overdue"
                                                    : "task-due-date"
                                            }
                                        >
                                            <strong>Due date:</strong>{" "}
                                            {task.due_date || "Not set"}
                                            {isOverdue(task) && " · Overdue"}
                                        </span>
                                    </div>
                                </div>

                                <div className="task-card-actions">
                                    {task.status === "PENDING" ? (
                                        <button
                                            type="button"
                                            className="tasks-button tasks-button-complete"
                                            onClick={() =>
                                                handleStatusChange(task, "COMPLETED")
                                            }
                                        >
                                            Mark Complete
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            className="tasks-button tasks-button-secondary"
                                            onClick={() =>
                                                handleStatusChange(task, "PENDING")
                                            }
                                        >
                                            Reopen Task
                                        </button>
                                    )}

                                    {canManage && (
                                        <>
                                            <button
                                                type="button"
                                                className="tasks-button tasks-button-edit"
                                                onClick={() => openEditForm(task)}
                                            >
                                                Edit
                                            </button>

                                            <button
                                                type="button"
                                                className="tasks-button tasks-button-delete"
                                                onClick={() => handleDelete(task)}
                                            >
                                                Delete
                                            </button>
                                        </>
                                    )}
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </section>

            {showForm && canManage && (
                <div
                    className="tasks-modal-overlay"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) closeForm();
                    }}
                >
                    <section
                        className="tasks-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="task-form-title"
                    >
                        <div className="tasks-modal-header">
                            <div>
                                <span className="tasks-eyebrow">
                                    TASK MANAGEMENT
                                </span>
                                <h2 id="task-form-title">
                                    {editingTask ? "Edit Task" : "Assign New Task"}
                                </h2>
                            </div>

                            <button
                                type="button"
                                className="tasks-modal-close"
                                onClick={closeForm}
                                aria-label="Close form"
                            >
                                ×
                            </button>
                        </div>

                        <form onSubmit={handleSubmit}>
                            {!editingTask && (
                                <div className="tasks-form-field">
                                    <label htmlFor="assigned_to">Assign employee *</label>
                                    <select
                                        id="assigned_to"
                                        name="assigned_to"
                                        value={form.assigned_to}
                                        onChange={handleFormChange}
                                        required
                                    >
                                        <option value="">Select an employee</option>
                                        {employees.map((employee) => (
                                            <option
                                                key={employee.id}
                                                value={employee.id}
                                            >
                                                {getEmployeeName(employee.id)}
                                            </option>
                                        ))}
                                    </select>

                                    {employees.length === 0 && (
                                        <small>
                                            No employees loaded. Refresh the page or check employee access.
                                        </small>
                                    )}
                                </div>
                            )}

                            <div className="tasks-form-field">
                                <label htmlFor="task-title">Task title *</label>
                                <input
                                    id="task-title"
                                    name="title"
                                    type="text"
                                    minLength={3}
                                    maxLength={200}
                                    value={form.title}
                                    onChange={handleFormChange}
                                    placeholder="e.g. Complete onboarding documents"
                                    required
                                />
                            </div>

                            <div className="tasks-form-field">
                                <label htmlFor="task-description">Description *</label>
                                <textarea
                                    id="task-description"
                                    name="description"
                                    minLength={5}
                                    maxLength={5000}
                                    rows={4}
                                    value={form.description}
                                    onChange={handleFormChange}
                                    placeholder="Describe the task and expected outcome..."
                                    required
                                />
                            </div>

                            <div className="tasks-form-field">
                                <label htmlFor="task-due-date">Due date *</label>
                                <input
                                    id="task-due-date"
                                    name="due_date"
                                    type="date"
                                    value={form.due_date}
                                    onChange={handleFormChange}
                                    required
                                />
                            </div>

                            {editingTask && (
                                <div className="tasks-form-field">
                                    <label htmlFor="task-form-status">Status</label>
                                    <select
                                        id="task-form-status"
                                        name="status"
                                        value={form.status}
                                        onChange={handleFormChange}
                                    >
                                        <option value="PENDING">Pending</option>
                                        <option value="COMPLETED">Completed</option>
                                    </select>
                                </div>
                            )}

                            <div className="tasks-modal-actions">
                                <button
                                    type="button"
                                    className="tasks-button tasks-button-secondary"
                                    onClick={closeForm}
                                    disabled={saving}
                                >
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    className="tasks-button tasks-button-primary"
                                    disabled={saving}
                                >
                                    {saving
                                        ? "Saving..."
                                        : editingTask
                                          ? "Save Changes"
                                          : "Assign Task"}
                                </button>
                            </div>
                        </form>
                    </section>
                </div>
            )}
        </div>
    );
}

export default Tasks;
