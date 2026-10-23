import { useCallback, useEffect, useState } from "react";
import {
    getEmployees,
    createEmployee,
    updateEmployee,
    deleteEmployee,
} from "../services/employeeService";
import "../style/Employees.css";

const initialForm = {
    employee_code: "",
    full_name: "",
    department: "",
    designation: "",
    joining_date: "",
    salary: "",
    employment_status: "ACTIVE",
    username: "",
    email: "",
    password: "",
};

function getStoredUser() {
    try {
        const storedUser = localStorage.getItem("worksphere_user");
        return storedUser ? JSON.parse(storedUser) : null;
    } catch {
        return null;
    }
}

function Employees() {
    const user = getStoredUser();

    const canManage =
        user?.role === "HR" || user?.role === "ADMIN";

    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [search, setSearch] = useState("");
    const [departmentFilter, setDepartmentFilter] = useState("");
    const [statusFilter, setStatusFilter] = useState("");

    const [showModal, setShowModal] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState(null);
    const [form, setForm] = useState(initialForm);

    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    // ==========================================
    // LOAD EMPLOYEES
    // ==========================================

    const loadEmployees = useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            const data = await getEmployees({
                search,
                department: departmentFilter,
                employment_status: statusFilter,
            });

            setEmployees(data);
        } catch (err) {
            setError(
                err.response?.data?.detail ||
                    "Unable to load employees. Please log in again if your session has expired."
            );
        } finally {
            setLoading(false);
        }
    }, [search, departmentFilter, statusFilter]);

    useEffect(() => {
        const timer = setTimeout(() => {
            loadEmployees();
        }, 250);

        return () => clearTimeout(timer);
    }, [loadEmployees]);

    // ==========================================
    // OPEN CREATE FORM
    // ==========================================

    const handleAddEmployee = () => {
        setEditingEmployee(null);
        setForm({ ...initialForm });
        setMessage("");
        setError("");
        setShowModal(true);
    };

    // ==========================================
    // OPEN EDIT FORM
    // ==========================================

    const handleEditEmployee = (employee) => {
        setEditingEmployee(employee);

        setForm({
            ...initialForm,
            employee_code: employee.employee_code || "",
            full_name: employee.full_name || "",
            department: employee.department || "",
            designation: employee.designation || "",
            joining_date: employee.joining_date || "",
            salary: employee.salary ?? "",
            employment_status:
                employee.employment_status || "ACTIVE",
            username: "",
            email: "",
            password: "",
        });

        setMessage("");
        setError("");
        setShowModal(true);
    };

    // ==========================================
    // HANDLE FORM INPUTS
    // ==========================================

    const handleChange = (event) => {
        const { name, value } = event.target;

        setForm((previous) => ({
            ...previous,
            [name]: value,
        }));
    };

    // ==========================================
    // CREATE OR UPDATE EMPLOYEE
    // ==========================================

    const handleSubmit = async (event) => {
        event.preventDefault();

        setSaving(true);
        setError("");
        setMessage("");

        try {
            const employeeData = {
                employee_code: form.employee_code.trim(),
                full_name: form.full_name.trim(),
                department: form.department.trim(),
                designation: form.designation.trim(),
                joining_date: form.joining_date,
                salary: Number(form.salary),
                employment_status: form.employment_status,
            };

            if (editingEmployee) {
                // Update existing employee information.
                employeeData.user_id =
                    editingEmployee.user_id ?? null;

                await updateEmployee(
                    editingEmployee.id,
                    employeeData
                );

                setMessage("Employee updated successfully.");
            } else {
                // Validate login account details.
                if (
                    !form.username.trim() ||
                    !form.email.trim() ||
                    !form.password
                ) {
                    setError(
                        "Username, email, and password are required."
                    );
                    setSaving(false);
                    return;
                }

                if (form.password.length < 8) {
                    setError(
                        "Password must contain at least 8 characters."
                    );
                    setSaving(false);
                    return;
                }

                // Create employee and login account together.
                await createEmployee({
                    ...employeeData,
                    username: form.username.trim(),
                    email: form.email.trim().toLowerCase(),
                    password: form.password,
                });

                setMessage(
                    "Employee and login account created successfully."
                );
            }

            setShowModal(false);
            setEditingEmployee(null);
            setForm({ ...initialForm });

            await loadEmployees();
        } catch (err) {
            setError(
                err.response?.data?.detail ||
                    "Unable to save employee. Please try again."
            );
        } finally {
            setSaving(false);
        }
    };

    // ==========================================
    // DELETE EMPLOYEE
    // ==========================================

    const handleDeleteEmployee = async (employee) => {
        const confirmed = window.confirm(
            `Are you sure you want to delete ${employee.full_name}'s employee record?`
        );

        if (!confirmed) {
            return;
        }

        setError("");
        setMessage("");

        try {
            await deleteEmployee(employee.id);

            setMessage("Employee record deleted successfully.");

            await loadEmployees();
        } catch (err) {
            setError(
                err.response?.data?.detail ||
                    "Unable to delete employee."
            );
        }
    };

    // ==========================================
    // SUMMARY STATISTICS
    // ==========================================

    const activeCount = employees.filter(
        (employee) => employee.employment_status === "ACTIVE"
    ).length;

    const inactiveCount = employees.filter(
        (employee) =>
            employee.employment_status === "INACTIVE"
    ).length;

    const departmentCount = new Set(
        employees.map((employee) => employee.department)
    ).size;

    // ==========================================
    // ACCESS CONTROL
    // ==========================================

    if (!user) {
        return (
            <div className="employees-page">
                <div className="employees-alert employees-alert-error">
                    Please log in to view employee records.
                </div>
            </div>
        );
    }

    // ==========================================
    // RENDER
    // ==========================================

    return (
        <div className="employees-page">
            <div className="employees-header">
                <div>
                    <h1>Employee Management</h1>
                    <p>
                        Manage employee information and login accounts.
                    </p>
                </div>

                {canManage && (
                    <button
                        type="button"
                        className="employees-primary-btn"
                        onClick={handleAddEmployee}
                    >
                        + Add Employee
                    </button>
                )}
            </div>

            {message && (
                <div className="employees-alert employees-alert-success">
                    {message}
                </div>
            )}

            {error && !showModal && (
                <div className="employees-alert employees-alert-error">
                    {error}
                </div>
            )}

            {/* SUMMARY CARDS */}

            <div className="employees-stats">
                <div className="employees-stat-card">
                    <span>Total Employees</span>
                    <strong>{employees.length}</strong>
                </div>

                <div className="employees-stat-card">
                    <span>Active Employees</span>
                    <strong>{activeCount}</strong>
                </div>

                <div className="employees-stat-card">
                    <span>Inactive Employees</span>
                    <strong>{inactiveCount}</strong>
                </div>

                <div className="employees-stat-card">
                    <span>Departments</span>
                    <strong>{departmentCount}</strong>
                </div>
            </div>

            {/* SEARCH AND FILTERS */}

            <div className="employees-toolbar">
                <input
                    type="text"
                    placeholder="Search name, employee code, department..."
                    value={search}
                    onChange={(event) =>
                        setSearch(event.target.value)
                    }
                    aria-label="Search employees"
                />

                <select
                    value={departmentFilter}
                    onChange={(event) =>
                        setDepartmentFilter(event.target.value)
                    }
                    aria-label="Filter by department"
                >
                    <option value="">All Departments</option>

                    {[
                        ...new Set(
                            employees.map(
                                (employee) => employee.department
                            )
                        ),
                    ]
                        .sort()
                        .map((department) => (
                            <option
                                key={department}
                                value={department}
                            >
                                {department}
                            </option>
                        ))}
                </select>

                <select
                    value={statusFilter}
                    onChange={(event) =>
                        setStatusFilter(event.target.value)
                    }
                    aria-label="Filter by employment status"
                >
                    <option value="">All Statuses</option>
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                    <option value="ON_LEAVE">On Leave</option>
                    <option value="TERMINATED">Terminated</option>
                </select>
            </div>

            {/* EMPLOYEE TABLE */}

            <div className="employees-table-container">
                {loading ? (
                    <div className="employees-empty">
                        Loading employees...
                    </div>
                ) : employees.length === 0 ? (
                    <div className="employees-empty">
                        <h3>No employees found</h3>
                        <p>
                            Try changing your search or filter settings.
                        </p>
                    </div>
                ) : (
                    <table className="employees-table">
                        <thead>
                            <tr>
                                <th>Employee</th>
                                <th>Employee Code</th>
                                <th>Department</th>
                                <th>Designation</th>
                                <th>Joining Date</th>
                                <th>Salary</th>
                                <th>Status</th>

                                {canManage && <th>Actions</th>}
                            </tr>
                        </thead>

                        <tbody>
                            {employees.map((employee) => (
                                <tr key={employee.id}>
                                    <td>
                                        <div className="employee-name-cell">
                                            <strong>
                                                {employee.full_name}
                                            </strong>
                                        </div>
                                    </td>

                                    <td>{employee.employee_code}</td>
                                    <td>{employee.department}</td>
                                    <td>{employee.designation}</td>
                                    <td>{employee.joining_date}</td>

                                    <td>
                                        ₹
                                        {Number(
                                            employee.salary
                                        ).toLocaleString("en-IN", {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                        })}
                                    </td>

                                    <td>
                                        <span
                                            className={`employee-status employee-status-${employee.employment_status?.toLowerCase()}`}
                                        >
                                            {employee.employment_status
                                                ?.replace("_", " ")
                                                .replace(/\b\w/g, (char) =>
                                                    char.toUpperCase()
                                                )}
                                        </span>
                                    </td>

                                    {canManage && (
                                        <td>
                                            <div className="employees-actions">
                                                <button
                                                    type="button"
                                                    className="employees-edit-btn"
                                                    onClick={() =>
                                                        handleEditEmployee(
                                                            employee
                                                        )
                                                    }
                                                >
                                                    Edit
                                                </button>

                                                <button
                                                    type="button"
                                                    className="employees-delete-btn"
                                                    onClick={() =>
                                                        handleDeleteEmployee(
                                                            employee
                                                        )
                                                    }
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* CREATE / EDIT MODAL */}

            {showModal && (
                <div
                    className="employees-modal-overlay"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) {
                            setShowModal(false);
                        }
                    }}
                >
                    <div className="employees-modal">
                        <div className="employees-modal-header">
                            <div>
                                <h2>
                                    {editingEmployee
                                        ? "Edit Employee"
                                        : "Create Employee"}
                                </h2>

                                <p>
                                    {editingEmployee
                                        ? "Update employee information."
                                        : "Enter employee information and create a login account."}
                                </p>
                            </div>

                            <button
                                type="button"
                                className="employees-modal-close"
                                onClick={() => setShowModal(false)}
                                aria-label="Close form"
                            >
                                ×
                            </button>
                        </div>

                        {error && (
                            <div className="employees-alert employees-alert-error">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit}>
                            <div className="employees-form-grid">
                                <div className="employees-form-group">
                                    <label htmlFor="employee_code">
                                        Employee Code
                                    </label>

                                    <input
                                        id="employee_code"
                                        name="employee_code"
                                        value={form.employee_code}
                                        onChange={handleChange}
                                        placeholder="EMP003"
                                        minLength={2}
                                        maxLength={20}
                                        pattern="[A-Za-z0-9_-]+"
                                        required
                                    />
                                </div>

                                <div className="employees-form-group">
                                    <label htmlFor="full_name">
                                        Full Name
                                    </label>

                                    <input
                                        id="full_name"
                                        name="full_name"
                                        value={form.full_name}
                                        onChange={handleChange}
                                        placeholder="Employee full name"
                                        minLength={2}
                                        maxLength={100}
                                        required
                                    />
                                </div>

                                <div className="employees-form-group">
                                    <label htmlFor="department">
                                        Department
                                    </label>

                                    <input
                                        id="department"
                                        name="department"
                                        value={form.department}
                                        onChange={handleChange}
                                        placeholder="IT"
                                        minLength={2}
                                        maxLength={100}
                                        required
                                    />
                                </div>

                                <div className="employees-form-group">
                                    <label htmlFor="designation">
                                        Designation
                                    </label>

                                    <input
                                        id="designation"
                                        name="designation"
                                        value={form.designation}
                                        onChange={handleChange}
                                        placeholder="Python Developer"
                                        minLength={2}
                                        maxLength={100}
                                        required
                                    />
                                </div>

                                <div className="employees-form-group">
                                    <label htmlFor="joining_date">
                                        Joining Date
                                    </label>

                                    <input
                                        id="joining_date"
                                        name="joining_date"
                                        type="date"
                                        value={form.joining_date}
                                        onChange={handleChange}
                                        required
                                    />
                                </div>

                                <div className="employees-form-group">
                                    <label htmlFor="salary">
                                        Salary
                                    </label>

                                    <input
                                        id="salary"
                                        name="salary"
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={form.salary}
                                        onChange={handleChange}
                                        placeholder="25000"
                                        required
                                    />
                                </div>

                                <div className="employees-form-group">
                                    <label htmlFor="employment_status">
                                        Employment Status
                                    </label>

                                    <select
                                        id="employment_status"
                                        name="employment_status"
                                        value={form.employment_status}
                                        onChange={handleChange}
                                        required
                                    >
                                        <option value="ACTIVE">
                                            Active
                                        </option>

                                        <option value="INACTIVE">
                                            Inactive
                                        </option>

                                        <option value="ON_LEAVE">
                                            On Leave
                                        </option>

                                        <option value="TERMINATED">
                                            Terminated
                                        </option>
                                    </select>
                                </div>
                            </div>

                            {!editingEmployee && (
                                <>
                                    <div className="employees-account-section">
                                        <h3>Employee Login Account</h3>

                                        <p>
                                            These credentials allow the
                                            employee to log in to WorkSphere.
                                        </p>
                                    </div>

                                    <div className="employees-form-grid">
                                        <div className="employees-form-group">
                                            <label htmlFor="username">
                                                Username
                                            </label>

                                            <input
                                                id="username"
                                                name="username"
                                                value={form.username}
                                                onChange={handleChange}
                                                placeholder="employee01"
                                                minLength={3}
                                                maxLength={50}
                                                autoComplete="off"
                                                required
                                            />
                                        </div>

                                        <div className="employees-form-group">
                                            <label htmlFor="email">
                                                Email Address
                                            </label>

                                            <input
                                                id="email"
                                                name="email"
                                                type="email"
                                                value={form.email}
                                                onChange={handleChange}
                                                placeholder="employee@example.com"
                                                maxLength={255}
                                                autoComplete="off"
                                                required
                                            />
                                        </div>

                                        <div className="employees-form-group employees-password-group">
                                            <label htmlFor="password">
                                                Initial Password
                                            </label>

                                            <input
                                                id="password"
                                                name="password"
                                                type="password"
                                                value={form.password}
                                                onChange={handleChange}
                                                placeholder="At least 8 characters"
                                                minLength={8}
                                                maxLength={128}
                                                autoComplete="new-password"
                                                required
                                            />

                                            <small>
                                                Share the initial password
                                                securely with the employee.
                                            </small>
                                        </div>
                                    </div>
                                </>
                            )}

                            <div className="employees-modal-actions">
                                <button
                                    type="button"
                                    className="employees-cancel-btn"
                                    onClick={() => setShowModal(false)}
                                    disabled={saving}
                                >
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    className="employees-primary-btn"
                                    disabled={saving}
                                >
                                    {saving
                                        ? "Saving..."
                                        : editingEmployee
                                          ? "Update Employee"
                                          : "Create Employee & Account"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Employees;