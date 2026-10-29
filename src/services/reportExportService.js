
import axios from "axios";

const API_BASE_URL = "http://127.0.0.1:8000";

/**
 * Download a WorkSphere report in CSV or PDF format.
 *
 * Supported report types:
 * employees, attendance, payroll, leaves
 */
export const downloadReport = async (reportType, format) => {
    const supportedReports = [
        "employees",
        "attendance",
        "payroll",
        "leaves",
    ];

    const supportedFormats = ["csv", "pdf"];

    if (!supportedReports.includes(reportType)) {
        throw new Error("Invalid report type.");
    }

    if (!supportedFormats.includes(format)) {
        throw new Error("Invalid report format.");
    }

    const token = localStorage.getItem("worksphere_token");

    if (!token) {
        throw new Error("Please log in to download reports.");
    }

    const response = await axios.get(
        `${API_BASE_URL}/reports/export/${reportType}`,
        {
            params: {
                format,
            },
            headers: {
                Authorization: `Bearer ${token}`,
            },
            responseType: "blob",
        }
    );

    const blob = new Blob([response.data], {
        type:
            format === "csv"
                ? "text/csv;charset=utf-8;"
                : "application/pdf",
    });

    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = downloadUrl;
    link.download = `worksphere_${reportType}_report.${format}`;

    document.body.appendChild(link);
    link.click();

    link.remove();
    window.URL.revokeObjectURL(downloadUrl);

    return {
        success: true,
        message: `${reportType} report downloaded successfully.`,
    };
};
