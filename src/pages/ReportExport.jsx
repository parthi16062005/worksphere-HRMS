
import { useState } from "react";
import { downloadReport } from "../services/reportExportService";
import "../style/ReportExport.css";

const reports = [
    {
        id: "employees",
        title: "Employee Report",
        description: "Export employee records and workforce information.",
        category: "Workforce",
        icon: "👥",
    },
    {
        id: "attendance",
        title: "Attendance Report",
        description: "Export employee attendance and working-time records.",
        category: "Time & Attendance",
        icon: "🕒",
    },
    {
        id: "payroll",
        title: "Payroll Report",
        description: "Export payroll records and salary information.",
        category: "Finance",
        icon: "💰",
    },
    {
        id: "leaves",
        title: "Leave Report",
        description: "Export employee leave requests and their statuses.",
        category: "Leave Management",
        icon: "📅",
    },
];

function ReportExport({ user }) {
    const [loadingReport, setLoadingReport] = useState("");
    const [successMessage, setSuccessMessage] = useState("");
    const [errorMessage, setErrorMessage] = useState("");

    const role = String(
        user?.role ||
        JSON.parse(localStorage.getItem("worksphere_user") || "{}")?.role ||
        ""
    ).toUpperCase();

    const canExport = ["HR", "ADMIN"].includes(role);

    const handleDownload = async (reportType, format) => {
        const actionKey = `${reportType}-${format}`;

        setLoadingReport(actionKey);
        setSuccessMessage("");
        setErrorMessage("");

        try {
            await downloadReport(reportType, format);

            const report = reports.find(
                (item) => item.id === reportType
            );

            setSuccessMessage(
                `${report?.title || "Report"} downloaded successfully as ${format.toUpperCase()}.`
            );
        } catch (error) {
            let message = "Unable to download the report. Please try again.";

            if (error.response?.status === 401) {
                message = "Your session may have expired. Please log in again.";
            } else if (error.response?.status === 403) {
                message = "You do not have permission to export reports.";
            } else if (error.response?.data instanceof Blob) {
                try {
                    const responseText = await error.response.data.text();
                    const responseJson = JSON.parse(responseText);
                    message = responseJson.detail || message;
                } catch {
                    // Keep the default message if the response is not JSON.
                }
            } else if (error.message) {
                message = error.message;
            }

            setErrorMessage(message);
        } finally {
            setLoadingReport("");
        }
    };

    if (!canExport) {
        return (
            <div className="report-export-page">
                <section className="report-access-denied">
                    <div className="report-access-icon">!</div>
                    <h2>Access Restricted</h2>
                    <p>
                        Report exports are available to HR and Admin users only.
                    </p>
                </section>
            </div>
        );
    }

    return (
        <div className="report-export-page">
            <header className="report-page-header">
                <div>
                    <span className="report-eyebrow">
                        MODULE 25 · REPORTING
                    </span>

                    <h1>Report Export Center</h1>

                    <p>
                        Download your WorkSphere HR reports in CSV or PDF format.
                    </p>
                </div>

                <div className="report-header-badge">
                    <span className="report-header-badge-icon">↗</span>
                    <div>
                        <strong>Export Center</strong>
                        <span>CSV & PDF Downloads</span>
                    </div>
                </div>
            </header>

            <section className="report-summary-grid">
                <article className="report-summary-card">
                    <div className="report-summary-icon">▤</div>
                    <div>
                        <span>Available Reports</span>
                        <strong>04</strong>
                    </div>
                </article>

                <article className="report-summary-card">
                    <div className="report-summary-icon">CSV</div>
                    <div>
                        <span>Spreadsheet Format</span>
                        <strong>CSV</strong>
                    </div>
                </article>

                <article className="report-summary-card">
                    <div className="report-summary-icon">PDF</div>
                    <div>
                        <span>Document Format</span>
                        <strong>PDF</strong>
                    </div>
                </article>
            </section>

            {successMessage && (
                <div className="report-alert report-alert-success" role="status">
                    <span>✓</span>
                    <p>{successMessage}</p>
                    <button
                        type="button"
                        onClick={() => setSuccessMessage("")}
                        aria-label="Dismiss success message"
                    >
                        ×
                    </button>
                </div>
            )}

            {errorMessage && (
                <div className="report-alert report-alert-error" role="alert">
                    <span>!</span>
                    <p>{errorMessage}</p>
                    <button
                        type="button"
                        onClick={() => setErrorMessage("")}
                        aria-label="Dismiss error message"
                    >
                        ×
                    </button>
                </div>
            )}

            <section className="report-section-heading">
                <div>
                    <h2>Available Reports</h2>
                    <p>Select a report and choose your preferred format.</p>
                </div>

                <span className="report-count">
                    {reports.length} Reports
                </span>
            </section>

            <section className="report-cards-grid">
                {reports.map((report) => {
                    const isDownloading =
                        loadingReport?.startsWith(`${report.id}-`);

                    return (
                        <article className="report-card" key={report.id}>
                            <div className="report-card-top">
                                <div className={`report-card-icon report-icon-${report.id}`}>
                                    {report.icon}
                                </div>

                                <span className="report-category">
                                    {report.category}
                                </span>
                            </div>

                            <h3>{report.title}</h3>

                            <p className="report-card-description">
                                {report.description}
                            </p>

                            <div className="report-card-divider" />

                            <span className="report-format-label">
                                DOWNLOAD FORMAT
                            </span>

                            <div className="report-download-actions">
                                <button
                                    type="button"
                                    className="report-download-btn report-csv-btn"
                                    onClick={() =>
                                        handleDownload(report.id, "csv")
                                    }
                                    disabled={Boolean(loadingReport)}
                                >
                                    {loadingReport === `${report.id}-csv`
                                        ? "Preparing..."
                                        : "↓ CSV"}
                                </button>

                                <button
                                    type="button"
                                    className="report-download-btn report-pdf-btn"
                                    onClick={() =>
                                        handleDownload(report.id, "pdf")
                                    }
                                    disabled={Boolean(loadingReport)}
                                >
                                    {loadingReport === `${report.id}-pdf`
                                        ? "Preparing..."
                                        : "↓ PDF"}
                                </button>
                            </div>

                            {isDownloading && (
                                <div className="report-download-progress">
                                    Preparing your report. Please wait...
                                </div>
                            )}
                        </article>
                    );
                })}
            </section>

            <section className="report-info-panel">
                <div className="report-info-icon">i</div>

                <div>
                    <h3>Before you export</h3>
                    <p>
                        Reports contain information available in your WorkSphere
                        database. Export access is restricted to HR and Admin
                        accounts. Store downloaded employee and payroll data securely.
                    </p>
                </div>
            </section>
        </div>
    );
}

export default ReportExport;
