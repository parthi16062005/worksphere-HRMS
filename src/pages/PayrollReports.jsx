import { useCallback, useEffect, useState } from "react";
import api from "../services/api";
import "../style/PayrollReports.css";

const initialSummary = {
    total_payroll_records: 0,
    paid_payroll_count: 0,
    pending_payroll_count: 0,
    total_gross_salary: 0,
    total_deductions: 0,
    total_net_salary: 0,
    total_paid_salary: 0,
    total_pending_salary: 0,
};

function formatCurrency(value) {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2,
    }).format(Number(value) || 0);
}

function formatNumber(value) {
    return new Intl.NumberFormat("en-IN").format(Number(value) || 0);
}

function getCurrentYear() {
    return new Date().getFullYear();
}

function PayrollReports({ user }) {
    const isHRorAdmin = ["HR", "ADMIN"].includes(
        String(user?.role || "").toUpperCase()
    );

    const [summary, setSummary] = useState(initialSummary);
    const [departments, setDepartments] = useState([]);

    const [filters, setFilters] = useState({
        payroll_month: "",
        payroll_year: String(getCurrentYear()),
    });

    const [loading, setLoading] = useState(false);
    const [downloading, setDownloading] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const buildParams = useCallback(() => {
        const params = {};

        if (filters.payroll_month) {
            params.payroll_month = Number(filters.payroll_month);
        }

        if (filters.payroll_year) {
            params.payroll_year = Number(filters.payroll_year);
        }

        return params;
    }, [filters]);

    const loadReports = useCallback(async () => {
        if (!isHRorAdmin) {
            return;
        }

        setLoading(true);
        setError("");
        setSuccess("");

        try {
            const params = buildParams();

            const [summaryResponse, departmentResponse] =
                await Promise.all([
                    api.get("/payroll/reports/summary", { params }),
                    api.get("/payroll/reports/department", { params }),
                ]);

            setSummary({
                ...initialSummary,
                ...summaryResponse.data,
            });

            setDepartments(
                Array.isArray(departmentResponse.data)
                    ? departmentResponse.data
                    : []
            );
        } catch (err) {
            setError(
                err.response?.data?.detail ||
                    "Unable to load payroll reports. Please try again."
            );
        } finally {
            setLoading(false);
        }
    }, [isHRorAdmin, buildParams]);

    useEffect(() => {
        loadReports();
    }, [loadReports]);

    function handleFilterChange(event) {
        const { name, value } = event.target;

        setFilters((previous) => ({
            ...previous,
            [name]: value,
        }));
    }

    async function downloadReport(format) {
        setDownloading(format);
        setError("");
        setSuccess("");

        try {
            const response = await api.get(
                `/payroll/reports/export/${format}`,
                {
                    params: buildParams(),
                    responseType: "blob",
                }
            );

            const blob = new Blob([response.data], {
                type:
                    format === "excel"
                        ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                        : "text/csv;charset=utf-8;",
            });

            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement("a");

            link.href = downloadUrl;

            const extension = format === "excel" ? "xlsx" : "csv";

            link.download = `payroll_report.${extension}`;

            document.body.appendChild(link);
            link.click();
            link.remove();

            window.URL.revokeObjectURL(downloadUrl);

            setSuccess(
                `${format.toUpperCase()} report downloaded successfully.`
            );
        } catch (err) {
            let message = "Unable to download the report.";

            if (err.response?.data instanceof Blob) {
                try {
                    const responseText =
                        await err.response.data.text();

                    const responseJson = JSON.parse(responseText);

                    message = responseJson.detail || message;
                } catch {
                    // Keep the default error message.
                }
            } else if (err.response?.data?.detail) {
                message = err.response.data.detail;
            }

            setError(message);
        } finally {
            setDownloading("");
        }
    }

    if (!isHRorAdmin) {
        return (
            <div className="pr-page">
                <div className="pr-access-denied">
                    <h2>Access Restricted</h2>
                    <p>
                        Payroll reports are available to HR and Admin users
                        only.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="pr-page">
            <header className="pr-header">
                <div>
                    <p className="pr-eyebrow">WORKSPHERE / ANALYTICS</p>

                    <h1>Payroll Reports</h1>

                    <p className="pr-subtitle">
                        Review payroll costs, deductions, payments, and
                        department-wise salary summaries.
                    </p>
                </div>

                <button
                    type="button"
                    className="pr-refresh-button"
                    onClick={loadReports}
                    disabled={loading}
                >
                    {loading ? "Refreshing..." : "Refresh Reports"}
                </button>
            </header>

            {error && (
                <div className="pr-alert pr-alert-error" role="alert">
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
                <div className="pr-alert pr-alert-success" role="status">
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

            <section className="pr-filter-panel">
                <div className="pr-section-heading">
                    <div>
                        <h2>Report Filters</h2>
                        <p>Choose the period you want to analyze.</p>
                    </div>

                    <span className="pr-live-badge">
                        {loading ? "Loading..." : "Report Filters"}
                    </span>
                </div>

                <div className="pr-filter-grid">
                    <div className="pr-form-group">
                        <label htmlFor="payroll_month">
                            Payroll Month
                        </label>

                        <select
                            id="payroll_month"
                            name="payroll_month"
                            value={filters.payroll_month}
                            onChange={handleFilterChange}
                        >
                            <option value="">All Months</option>
                            <option value="1">January</option>
                            <option value="2">February</option>
                            <option value="3">March</option>
                            <option value="4">April</option>
                            <option value="5">May</option>
                            <option value="6">June</option>
                            <option value="7">July</option>
                            <option value="8">August</option>
                            <option value="9">September</option>
                            <option value="10">October</option>
                            <option value="11">November</option>
                            <option value="12">December</option>
                        </select>
                    </div>

                    <div className="pr-form-group">
                        <label htmlFor="payroll_year">
                            Payroll Year
                        </label>

                        <select
                            id="payroll_year"
                            name="payroll_year"
                            value={filters.payroll_year}
                            onChange={handleFilterChange}
                        >
                            <option value="">All Years</option>

                            {Array.from(
                                { length: 7 },
                                (_, index) => getCurrentYear() - index
                            ).map((year) => (
                                <option key={year} value={year}>
                                    {year}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="pr-filter-actions">
                        <button
                            type="button"
                            className="pr-apply-button"
                            onClick={loadReports}
                            disabled={loading}
                        >
                            Apply Filters
                        </button>

                        <button
                            type="button"
                            className="pr-reset-button"
                            onClick={() =>
                                setFilters({
                                    payroll_month: "",
                                    payroll_year: "",
                                })
                            }
                            disabled={loading}
                        >
                            Clear Filters
                        </button>
                    </div>
                </div>
            </section>

            <section className="pr-metrics-section">
                <div className="pr-section-heading">
                    <div>
                        <h2>Payroll Overview</h2>
                        <p>Key figures for the selected reporting period.</p>
                    </div>
                </div>

                <div className="pr-metrics-grid">
                    <article className="pr-metric-card pr-metric-blue">
                        <div className="pr-metric-top">
                            <span className="pr-metric-icon">PR</span>
                            <span className="pr-metric-label">
                                Payroll Records
                            </span>
                        </div>

                        <h3>{formatNumber(summary.total_payroll_records)}</h3>

                        <p>Total generated payroll records</p>
                    </article>

                    <article className="pr-metric-card pr-metric-green">
                        <div className="pr-metric-top">
                            <span className="pr-metric-icon">PA</span>
                            <span className="pr-metric-label">
                                Paid Payrolls
                            </span>
                        </div>

                        <h3>{formatNumber(summary.paid_payroll_count)}</h3>

                        <p>Payroll records marked as paid</p>
                    </article>

                    <article className="pr-metric-card pr-metric-orange">
                        <div className="pr-metric-top">
                            <span className="pr-metric-icon">PE</span>
                            <span className="pr-metric-label">
                                Pending Payrolls
                            </span>
                        </div>

                        <h3>{formatNumber(summary.pending_payroll_count)}</h3>

                        <p>Payroll records awaiting payment</p>
                    </article>

                    <article className="pr-metric-card pr-metric-purple">
                        <div className="pr-metric-top">
                            <span className="pr-metric-icon">IN</span>
                            <span className="pr-metric-label">
                                Net Payroll
                            </span>
                        </div>

                        <h3>
                            {formatCurrency(summary.total_net_salary)}
                        </h3>

                        <p>Total net salary generated</p>
                    </article>
                </div>
            </section>

            <section className="pr-financial-section">
                <div className="pr-section-heading">
                    <div>
                        <h2>Financial Breakdown</h2>
                        <p>Understand the total payroll expenditure.</p>
                    </div>
                </div>

                <div className="pr-financial-grid">
                    <article className="pr-financial-card">
                        <span className="pr-financial-label">
                            Gross Salary
                        </span>

                        <strong>
                            {formatCurrency(summary.total_gross_salary)}
                        </strong>

                        <p>Before deductions</p>
                    </article>

                    <article className="pr-financial-card">
                        <span className="pr-financial-label">
                            Total Deductions
                        </span>

                        <strong>
                            {formatCurrency(summary.total_deductions)}
                        </strong>

                        <p>PF, tax, and other deductions</p>
                    </article>

                    <article className="pr-financial-card">
                        <span className="pr-financial-label">
                            Paid Salary
                        </span>

                        <strong>
                            {formatCurrency(summary.total_paid_salary)}
                        </strong>

                        <p>Net salary already paid</p>
                    </article>

                    <article className="pr-financial-card">
                        <span className="pr-financial-label">
                            Pending Salary
                        </span>

                        <strong>
                            {formatCurrency(summary.total_pending_salary)}
                        </strong>

                        <p>Net salary awaiting payment</p>
                    </article>
                </div>
            </section>

            <section className="pr-department-panel">
                <div className="pr-section-heading">
                    <div>
                        <h2>Department-wise Payroll</h2>
                        <p>
                            Compare payroll expenditure across departments.
                        </p>
                    </div>

                    <span className="pr-record-count">
                        {departments.length} department
                        {departments.length === 1 ? "" : "s"}
                    </span>
                </div>

                <div className="pr-table-wrapper">
                    <table className="pr-table">
                        <thead>
                            <tr>
                                <th>Department</th>
                                <th>Records</th>
                                <th>Gross Salary</th>
                                <th>Deductions</th>
                                <th>Net Salary</th>
                                <th>Paid Salary</th>
                                <th>Pending Salary</th>
                            </tr>
                        </thead>

                        <tbody>
                            {loading && departments.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="pr-empty-state">
                                        Loading department reports...
                                    </td>
                                </tr>
                            ) : departments.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="pr-empty-state">
                                        No payroll records found for the
                                        selected filters.
                                    </td>
                                </tr>
                            ) : (
                                departments.map((department, index) => (
                                    <tr
                                        key={
                                            department.department ??
                                            `department-${index}`
                                        }
                                    >
                                        <td>
                                            <span className="pr-department-name">
                                                {department.department ||
                                                    "Unassigned"}
                                            </span>
                                        </td>

                                        <td>
                                            {formatNumber(
                                                department.payroll_count
                                            )}
                                        </td>

                                        <td>
                                            {formatCurrency(
                                                department.total_gross_salary
                                            )}
                                        </td>

                                        <td>
                                            {formatCurrency(
                                                department.total_deductions
                                            )}
                                        </td>

                                        <td className="pr-net-cell">
                                            {formatCurrency(
                                                department.total_net_salary
                                            )}
                                        </td>

                                        <td className="pr-paid-cell">
                                            {formatCurrency(
                                                department.total_paid_salary
                                            )}
                                        </td>

                                        <td className="pr-pending-cell">
                                            {formatCurrency(
                                                department.total_pending_salary
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </section>

            <section className="pr-export-panel">
                <div className="pr-export-content">
                    <div>
                        <h2>Export Payroll Reports</h2>

                        <p>
                            Download your filtered payroll data for
                            reporting, auditing, and further analysis.
                        </p>
                    </div>

                    <div className="pr-export-actions">
                        <button
                            type="button"
                            className="pr-csv-button"
                            onClick={() => downloadReport("csv")}
                            disabled={Boolean(downloading)}
                        >
                            {downloading === "csv"
                                ? "Downloading..."
                                : "Download CSV"}
                        </button>

                        <button
                            type="button"
                            className="pr-excel-button"
                            onClick={() => downloadReport("excel")}
                            disabled={Boolean(downloading)}
                        >
                            {downloading === "excel"
                                ? "Downloading..."
                                : "Download Excel"}
                        </button>
                    </div>
                </div>

                <div className="pr-export-note">
                    Exports use the selected month and year filters.
                </div>
            </section>

            <footer className="pr-footer">
                <span>WorkSphere HR Management System</span>
                <span>Payroll Reports &amp; Analytics</span>
            </footer>
        </div>
    );
}

export default PayrollReports;