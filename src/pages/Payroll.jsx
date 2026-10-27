
import { useCallback, useEffect, useState } from "react";
import api from "../services/api";
import "../style/Payroll.css";

const initialForm = {
    employee_id: "",
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    basic_salary: "",
    hra: "0",
    da: "0",
    other_allowances: "0",
    pf_deduction: "0",
    tax_deduction: "0",
    other_deductions: "0",
};

const formatCurrency = (amount) =>
    new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2,
    }).format(Number(amount || 0));

const formatMonth = (month, year) =>
    new Date(Number(year), Number(month) - 1).toLocaleDateString(
        "en-IN",
        { month: "long", year: "numeric" }
    );

function Payroll({ user }) {
    const isHRorAdmin = ["HR", "ADMIN"].includes(user?.role);

    const [records, setRecords] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [form, setForm] = useState(initialForm);

    const [showForm, setShowForm] = useState(false);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [updatingId, setUpdatingId] = useState(null);
    const [downloadingId, setDownloadingId] = useState(null);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    const [filters, setFilters] = useState({
        employee_id: "",
        month: "",
        year: "",
        status: "",
    });

    const loadPayroll = useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            if (!isHRorAdmin) {
                const response = await api.get("/payroll/my");
                setRecords(response.data);
                return;
            }

            const params = {};

            if (filters.employee_id) {
                params.employee_id = Number(filters.employee_id);
            }

            if (filters.month) {
                params.payroll_month = Number(filters.month);
            }

            if (filters.year) {
                params.payroll_year = Number(filters.year);
            }

            if (filters.status) {
                params.payroll_status = filters.status;
            }

            const response = await api.get("/payroll", { params });
            setRecords(response.data);
        } catch (err) {
            setError(
                err.response?.data?.detail ||
                    "Unable to load payroll records."
            );
        } finally {
            setLoading(false);
        }
    }, [isHRorAdmin, filters]);

    const loadEmployees = useCallback(async () => {
        if (!isHRorAdmin) return;

        try {
            const response = await api.get("/employees");

            const employeeList = Array.isArray(response.data)
                ? response.data
                : response.data.items || [];

            setEmployees(employeeList);
        } catch {
            setEmployees([]);
        }
    }, [isHRorAdmin]);

    useEffect(() => {
        loadPayroll();
    }, [loadPayroll]);

    useEffect(() => {
        loadEmployees();
    }, [loadEmployees]);

    const handleFormChange = (event) => {
        const { name, value } = event.target;

        setForm((previous) => ({
            ...previous,
            [name]: value,
        }));
    };

    const handleFilterChange = (event) => {
        const { name, value } = event.target;

        setFilters((previous) => ({
            ...previous,
            [name]: value,
        }));
    };

    const grossSalary =
        Number(form.basic_salary || 0) +
        Number(form.hra || 0) +
        Number(form.da || 0) +
        Number(form.other_allowances || 0);

    const totalDeductions =
        Number(form.pf_deduction || 0) +
        Number(form.tax_deduction || 0) +
        Number(form.other_deductions || 0);

    const netSalary = grossSalary - totalDeductions;

    const handleGeneratePayroll = async (event) => {
        event.preventDefault();

        setError("");
        setMessage("");

        if (!form.employee_id) {
            setError("Please select an employee.");
            return;
        }

        if (!form.basic_salary || Number(form.basic_salary) < 0) {
            setError("Enter a valid basic salary.");
            return;
        }

        if (totalDeductions > grossSalary) {
            setError("Total deductions cannot exceed gross salary.");
            return;
        }

        setSubmitting(true);

        try {
            const payload = {
                ...form,
                employee_id: Number(form.employee_id),
                month: Number(form.month),
                year: Number(form.year),
                basic_salary: Number(form.basic_salary),
                hra: Number(form.hra || 0),
                da: Number(form.da || 0),
                other_allowances: Number(form.other_allowances || 0),
                pf_deduction: Number(form.pf_deduction || 0),
                tax_deduction: Number(form.tax_deduction || 0),
                other_deductions: Number(form.other_deductions || 0),
            };

            await api.post("/payroll", payload);

            setMessage("Payroll generated successfully.");
            setForm(initialForm);
            setShowForm(false);

            await loadPayroll();
        } catch (err) {
            setError(
                err.response?.data?.detail ||
                    "Unable to generate payroll."
            );
        } finally {
            setSubmitting(false);
        }
    };

    const handleMarkAsPaid = async (record) => {
        const confirmed = window.confirm(
            `Mark payroll for employee ${record.employee_id} (${formatMonth(
                record.month,
                record.year
            )}) as PAID?`
        );

        if (!confirmed) return;

        setError("");
        setMessage("");
        setUpdatingId(record.id);

        try {
            await api.patch(`/payroll/${record.id}/payment`, {
                status: "PAID",
            });

            setMessage("Payroll marked as paid successfully.");
            await loadPayroll();
        } catch (err) {
            setError(
                err.response?.data?.detail ||
                    "Unable to update payment status."
            );
        } finally {
            setUpdatingId(null);
        }
    };

    // Download the salary slip as a PDF using the authenticated API.
    const handleDownloadSalarySlip = async (record) => {
        setError("");
        setMessage("");
        setDownloadingId(record.id);

        try {
            const endpoint = isHRorAdmin
                ? `/payroll/${record.id}/salary-slip`
                : `/payroll/my/${record.id}/salary-slip`;

            const response = await api.get(endpoint, {
                responseType: "blob",
            });

            const pdfBlob = new Blob([response.data], {
                type: "application/pdf",
            });

            const downloadUrl = window.URL.createObjectURL(pdfBlob);
            const link = document.createElement("a");

            link.href = downloadUrl;
            link.download = `salary_slip_payroll_${record.id}_${record.year}_${String(
                record.month
            ).padStart(2, "0")}.pdf`;

            document.body.appendChild(link);
            link.click();
            link.remove();

            window.URL.revokeObjectURL(downloadUrl);

            setMessage(
                `Salary slip for ${formatMonth(
                    record.month,
                    record.year
                )} downloaded successfully.`
            );
        } catch (err) {
            let errorMessage = "Unable to download the salary slip.";

            if (err.response?.data instanceof Blob) {
                try {
                    const responseText = await err.response.data.text();
                    const errorData = JSON.parse(responseText);

                    errorMessage =
                        errorData.detail || errorMessage;
                } catch {
                    // Keep the default error message.
                }
            } else if (err.response?.data?.detail) {
                errorMessage = err.response.data.detail;
            }

            setError(errorMessage);
        } finally {
            setDownloadingId(null);
        }
    };

    const totalGross = records.reduce(
        (sum, record) => sum + Number(record.gross_salary || 0),
        0
    );

    const totalNet = records.reduce(
        (sum, record) => sum + Number(record.net_salary || 0),
        0
    );

    const pendingCount = records.filter(
        (record) => record.status === "PENDING"
    ).length;

    const paidCount = records.filter(
        (record) => record.status === "PAID"
    ).length;

    return (
        <section className="ws-payroll-page">
            <div className="ws-payroll-heading">
                <div>
                    <span className="ws-payroll-eyebrow">
                        WORKSPHERE / COMPENSATION
                    </span>

                    <h2>
                        {isHRorAdmin
                            ? "Payroll Management"
                            : "My Salary History"}
                    </h2>

                    <p>
                        {isHRorAdmin
                            ? "Generate payroll and manage employee salary payments."
                            : "View your monthly salary details, download salary slips, and check payment status."}
                    </p>
                </div>

                {isHRorAdmin && (
                    <button
                        type="button"
                        className="ws-payroll-primary"
                        onClick={() => {
                            setError("");
                            setMessage("");
                            setShowForm((previous) => !previous);
                        }}
                    >
                        {showForm ? "Close Form" : "Generate Payroll"}
                    </button>
                )}
            </div>

            {error && (
                <div className="ws-payroll-alert ws-payroll-alert-error">
                    {error}
                </div>
            )}

            {message && (
                <div className="ws-payroll-alert ws-payroll-alert-success">
                    {message}
                </div>
            )}

            <div className="ws-payroll-stats">
                <article className="ws-payroll-stat">
                    <span>Total Records</span>
                    <strong>{records.length}</strong>
                    <small>Payroll entries</small>
                </article>

                <article className="ws-payroll-stat">
                    <span>Total Gross Salary</span>
                    <strong>{formatCurrency(totalGross)}</strong>
                    <small>For displayed records</small>
                </article>

                <article className="ws-payroll-stat">
                    <span>Net Salary</span>
                    <strong>{formatCurrency(totalNet)}</strong>
                    <small>For displayed records</small>
                </article>

                <article className="ws-payroll-stat">
                    <span>Payment Status</span>
                    <strong>{pendingCount} Pending</strong>
                    <small>{paidCount} paid records</small>
                </article>
            </div>

            {showForm && isHRorAdmin && (
                <section className="ws-payroll-panel">
                    <div className="ws-payroll-panel-heading">
                        <div>
                            <h3>Generate Monthly Payroll</h3>
                            <p>
                                Enter salary components to calculate
                                gross and net salary.
                            </p>
                        </div>
                    </div>

                    <form
                        className="ws-payroll-form"
                        onSubmit={handleGeneratePayroll}
                    >
                        <label>
                            Employee
                            <select
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
                                        {employee.full_name} —{" "}
                                        {employee.employee_code}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label>
                            Month
                            <select
                                name="month"
                                value={form.month}
                                onChange={handleFormChange}
                                required
                            >
                                {Array.from(
                                    { length: 12 },
                                    (_, index) => index + 1
                                ).map((month) => (
                                    <option key={month} value={month}>
                                        {formatMonth(
                                            month,
                                            form.year
                                        ).split(" ")[0]}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label>
                            Year
                            <input
                                type="number"
                                name="year"
                                min="2000"
                                max="2100"
                                value={form.year}
                                onChange={handleFormChange}
                                required
                            />
                        </label>

                        <label>
                            Basic Salary (₹)
                            <input
                                type="number"
                                name="basic_salary"
                                min="0"
                                step="0.01"
                                value={form.basic_salary}
                                onChange={handleFormChange}
                                required
                            />
                        </label>

                        <label>
                            HRA (₹)
                            <input
                                type="number"
                                name="hra"
                                min="0"
                                step="0.01"
                                value={form.hra}
                                onChange={handleFormChange}
                            />
                        </label>

                        <label>
                            DA (₹)
                            <input
                                type="number"
                                name="da"
                                min="0"
                                step="0.01"
                                value={form.da}
                                onChange={handleFormChange}
                            />
                        </label>

                        <label>
                            Other Allowances (₹)
                            <input
                                type="number"
                                name="other_allowances"
                                min="0"
                                step="0.01"
                                value={form.other_allowances}
                                onChange={handleFormChange}
                            />
                        </label>

                        <label>
                            PF Deduction (₹)
                            <input
                                type="number"
                                name="pf_deduction"
                                min="0"
                                step="0.01"
                                value={form.pf_deduction}
                                onChange={handleFormChange}
                            />
                        </label>

                        <label>
                            Tax Deduction (₹)
                            <input
                                type="number"
                                name="tax_deduction"
                                min="0"
                                step="0.01"
                                value={form.tax_deduction}
                                onChange={handleFormChange}
                            />
                        </label>

                        <label>
                            Other Deductions (₹)
                            <input
                                type="number"
                                name="other_deductions"
                                min="0"
                                step="0.01"
                                value={form.other_deductions}
                                onChange={handleFormChange}
                            />
                        </label>

                        <div className="ws-payroll-calculation">
                            <div>
                                <span>Gross Salary</span>
                                <strong>
                                    {formatCurrency(grossSalary)}
                                </strong>
                            </div>

                            <div>
                                <span>Total Deductions</span>
                                <strong>
                                    {formatCurrency(totalDeductions)}
                                </strong>
                            </div>

                            <div>
                                <span>Net Salary</span>
                                <strong>
                                    {formatCurrency(netSalary)}
                                </strong>
                            </div>
                        </div>

                        <div className="ws-payroll-form-actions">
                            <button
                                type="button"
                                className="ws-payroll-secondary"
                                onClick={() => setShowForm(false)}
                            >
                                Cancel
                            </button>

                            <button
                                type="submit"
                                className="ws-payroll-primary"
                                disabled={
                                    submitting ||
                                    !form.employee_id ||
                                    netSalary < 0
                                }
                            >
                                {submitting
                                    ? "Generating..."
                                    : "Generate Payroll"}
                            </button>
                        </div>
                    </form>
                </section>
            )}

            {isHRorAdmin && (
                <section className="ws-payroll-panel">
                    <div className="ws-payroll-panel-heading">
                        <div>
                            <h3>Filter Payroll Records</h3>
                            <p>
                                Narrow the records by employee,
                                month, year, or payment status.
                            </p>
                        </div>
                    </div>

                    <div className="ws-payroll-filters">
                        <label>
                            Employee ID
                            <input
                                type="number"
                                name="employee_id"
                                min="1"
                                placeholder="All employees"
                                value={filters.employee_id}
                                onChange={handleFilterChange}
                            />
                        </label>

                        <label>
                            Month
                            <select
                                name="month"
                                value={filters.month}
                                onChange={handleFilterChange}
                            >
                                <option value="">All months</option>

                                {Array.from(
                                    { length: 12 },
                                    (_, index) => index + 1
                                ).map((month) => (
                                    <option key={month} value={month}>
                                        {formatMonth(month, 2026).split(" ")[0]}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label>
                            Year
                            <input
                                type="number"
                                name="year"
                                min="2000"
                                max="2100"
                                placeholder="All years"
                                value={filters.year}
                                onChange={handleFilterChange}
                            />
                        </label>

                        <label>
                            Payment Status
                            <select
                                name="status"
                                value={filters.status}
                                onChange={handleFilterChange}
                            >
                                <option value="">All statuses</option>
                                <option value="PENDING">Pending</option>
                                <option value="PAID">Paid</option>
                            </select>
                        </label>

                        <button
                            type="button"
                            className="ws-payroll-secondary"
                            onClick={() =>
                                setFilters({
                                    employee_id: "",
                                    month: "",
                                    year: "",
                                    status: "",
                                })
                            }
                        >
                            Clear Filters
                        </button>
                    </div>
                </section>
            )}

            <section className="ws-payroll-panel">
                <div className="ws-payroll-panel-heading">
                    <div>
                        <h3>Payroll Records</h3>
                        <p>
                            {records.length} record
                            {records.length === 1 ? "" : "s"} displayed
                        </p>
                    </div>

                    <button
                        type="button"
                        className="ws-payroll-secondary"
                        onClick={loadPayroll}
                        disabled={loading}
                    >
                        Refresh
                    </button>
                </div>

                {loading ? (
                    <div className="ws-payroll-empty">
                        Loading payroll records...
                    </div>
                ) : records.length === 0 ? (
                    <div className="ws-payroll-empty">
                        <h3>No payroll records found</h3>
                        <p>
                            Payroll records will appear here after
                            they have been generated.
                        </p>
                    </div>
                ) : (
                    <div className="ws-payroll-table-wrapper">
                        <table className="ws-payroll-table">
                            <thead>
                                <tr>
                                    <th>Payroll ID</th>

                                    {isHRorAdmin && (
                                        <th>Employee ID</th>
                                    )}

                                    <th>Salary Month</th>
                                    <th>Gross Salary</th>
                                    <th>Deductions</th>
                                    <th>Net Salary</th>
                                    <th>Status</th>
                                    <th>Payment Date</th>
                                    <th>Salary Slip</th>

                                    {isHRorAdmin && (
                                        <th>Action</th>
                                    )}
                                </tr>
                            </thead>

                            <tbody>
                                {records.map((record) => (
                                    <tr key={record.id}>
                                        <td>#{record.id}</td>

                                        {isHRorAdmin && (
                                            <td>{record.employee_id}</td>
                                        )}

                                        <td>
                                            {formatMonth(
                                                record.month,
                                                record.year
                                            )}
                                        </td>

                                        <td>
                                            {formatCurrency(
                                                record.gross_salary
                                            )}
                                        </td>

                                        <td>
                                            {formatCurrency(
                                                record.total_deductions
                                            )}
                                        </td>

                                        <td className="ws-payroll-net">
                                            {formatCurrency(
                                                record.net_salary
                                            )}
                                        </td>

                                        <td>
                                            <span
                                                className={`ws-payroll-status ${
                                                    record.status === "PAID"
                                                        ? "is-paid"
                                                        : "is-pending"
                                                }`}
                                            >
                                                {record.status}
                                            </span>
                                        </td>

                                        <td>
                                            {record.payment_date || "—"}
                                        </td>

                                        <td>
                                            <button
                                                type="button"
                                                className="ws-payroll-secondary"
                                                onClick={() =>
                                                    handleDownloadSalarySlip(
                                                        record
                                                    )
                                                }
                                                disabled={
                                                    downloadingId ===
                                                    record.id
                                                }
                                            >
                                                {downloadingId === record.id
                                                    ? "Downloading..."
                                                    : "Download PDF"}
                                            </button>
                                        </td>

                                        {isHRorAdmin && (
                                            <td>
                                                {record.status === "PENDING" ? (
                                                    <button
                                                        type="button"
                                                        className="ws-payroll-paid-button"
                                                        onClick={() =>
                                                            handleMarkAsPaid(
                                                                record
                                                            )
                                                        }
                                                        disabled={
                                                            updatingId ===
                                                            record.id
                                                        }
                                                    >
                                                        {updatingId === record.id
                                                            ? "Updating..."
                                                            : "Mark as Paid"}
                                                    </button>
                                                ) : (
                                                    <span className="ws-payroll-completed">
                                                        Completed
                                                    </span>
                                                )}
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </section>
    );
}

export default Payroll;
