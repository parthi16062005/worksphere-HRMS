
import { useCallback, useEffect, useState } from "react";
import api from "../services/api";
import { getDashboardStatistics } from "../services/dashboardService";
import {
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Tooltip,
    Legend,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
} from "recharts";

import "../style/Dashboard.css";

const formatCurrency = (amount) =>
    new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2,
    }).format(Number(amount || 0));

const formatMonth = (month, year) =>
    new Date(Number(year), Number(month) - 1).toLocaleDateString("en-IN", {
        month: "long",
        year: "numeric",
    });

function Dashboard({ user, onNavigate }) {
    const isEmployee = user?.role === "EMPLOYEE";
    const isHROrAdmin = ["HR", "ADMIN"].includes(user?.role);

    const [statistics, setStatistics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState("");

    const [attendance, setAttendance] = useState([]);
    const [attendanceLoading, setAttendanceLoading] = useState(true);
    const [attendanceError, setAttendanceError] = useState("");

    const [leaves, setLeaves] = useState([]);
    const [leavesLoading, setLeavesLoading] = useState(true);
    const [leavesError, setLeavesError] = useState("");

    const [payroll, setPayroll] = useState([]);
    const [payrollLoading, setPayrollLoading] = useState(true);
    const [payrollError, setPayrollError] = useState("");

    const getDashboardName = (role) => {
        if (role === "ADMIN") return "Admin Dashboard";
        if (role === "HR") return "HR Dashboard";
        return "Employee Dashboard";
    };

    // Organization statistics: HR and ADMIN only.
    const loadStatistics = useCallback(
        async (showRefresh = false) => {
            if (!isHROrAdmin) {
                setStatistics(null);
                setError("");
                setLoading(false);
                setRefreshing(false);
                return;
            }

            if (showRefresh) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }

            try {
                const data = await getDashboardStatistics();
                setStatistics(data);
                setError("");
            } catch (err) {
                setError(
                    err.response?.data?.detail ||
                        "Unable to load dashboard statistics."
                );
            } finally {
                setLoading(false);
                setRefreshing(false);
            }
        },
        [isHROrAdmin]
    );

    // Attendance summary.
    const loadAttendance = useCallback(async () => {
        setAttendanceLoading(true);
        setAttendanceError("");

        try {
            const response = isEmployee
                ? await api.get("/attendance/my")
                : await api.get("/attendance");

            setAttendance(
                Array.isArray(response.data) ? response.data : []
            );
        } catch (err) {
            setAttendance([]);
            setAttendanceError(
                err.response?.data?.detail ||
                    "Unable to load attendance summary."
            );
        } finally {
            setAttendanceLoading(false);
        }
    }, [isEmployee]);

    // Leave summary.
    const loadLeaves = useCallback(async () => {
        setLeavesLoading(true);
        setLeavesError("");

        try {
            const response = isEmployee
                ? await api.get("/leaves/my")
                : await api.get("/leaves");

            setLeaves(
                Array.isArray(response.data) ? response.data : []
            );
        } catch (err) {
            setLeaves([]);
            setLeavesError(
                err.response?.data?.detail ||
                    "Unable to load leave summary."
            );
        } finally {
            setLeavesLoading(false);
        }
    }, [isEmployee]);

    // Payroll summary.
    const loadPayroll = useCallback(async () => {
        setPayrollLoading(true);
        setPayrollError("");

        try {
            const response = isEmployee
                ? await api.get("/payroll/my")
                : await api.get("/payroll");

            setPayroll(
                Array.isArray(response.data) ? response.data : []
            );
        } catch (err) {
            setPayroll([]);
            setPayrollError(
                err.response?.data?.detail ||
                    "Unable to load payroll summary."
            );
        } finally {
            setPayrollLoading(false);
        }
    }, [isEmployee]);

    // Load each dashboard section independently.
    useEffect(() => {
        loadStatistics();
        loadAttendance();
        loadLeaves();
        loadPayroll();
    }, [loadStatistics, loadAttendance, loadLeaves, loadPayroll]);

    // Organization KPI cards.
    const statisticCards = statistics
        ? [
              {
                  title: "Total Users",
                  value: statistics.total_users,
                  description: "All registered accounts",
                  icon: "US",
              },
              {
                  title: "Employees",
                  value: statistics.total_employees,
                  description: "Employee accounts",
                  icon: "EM",
              },
              {
                  title: "HR Members",
                  value: statistics.total_hr,
                  description: "Human resource accounts",
                  icon: "HR",
              },
              {
                  title: "Administrators",
                  value: statistics.total_admins,
                  description: "Administrative accounts",
                  icon: "AD",
              },
              {
                  title: "Employees Joined Today",
                  value: statistics.employees_registered_today,
                  description: "New employee registrations",
                  icon: "TD",
              },
          ]
        : [];

    // Attendance counts.
    const attendanceCounts = {
        present: attendance.filter(
            (record) => record.status === "PRESENT"
        ).length,

        halfDay: attendance.filter(
            (record) => record.status === "HALF_DAY"
        ).length,

        absent: attendance.filter(
            (record) => record.status === "ABSENT"
        ).length,
    };

    // Leave counts.
    const leaveCounts = {
        pending: leaves.filter(
            (leave) => leave.status === "PENDING"
        ).length,

        approved: leaves.filter(
            (leave) => leave.status === "APPROVED"
        ).length,

        rejected: leaves.filter(
            (leave) => leave.status === "REJECTED"
        ).length,
    };

    // Sort payroll records from newest to oldest.
    const sortedPayroll = [...payroll].sort((a, b) => {
        const dateA = Number(a.year) * 100 + Number(a.month);
        const dateB = Number(b.year) * 100 + Number(b.month);

        return dateB - dateA || Number(b.id) - Number(a.id);
    });

    // Latest payslip:
    // Employee sees their own latest record.
    // HR/Admin see the most recent payroll record in the organization.
    const latestPayroll = sortedPayroll[0] || null;

    // Find each employee's latest payroll record.
    // This prevents older payroll periods from being counted repeatedly.
    const payrollByEmployee = payroll.reduce((result, record) => {
        const employeeId = record.employee_id;

        if (employeeId == null) {
            return result;
        }

        const current = result[employeeId];

        const recordPeriod =
            Number(record.year) * 100 + Number(record.month);

        const currentPeriod = current
            ? Number(current.year) * 100 + Number(current.month)
            : -1;

        if (
            !current ||
            recordPeriod > currentPeriod ||
            (
                recordPeriod === currentPeriod &&
                Number(record.id) > Number(current.id)
            )
        ) {
            result[employeeId] = record;
        }

        return result;
    }, {});

    const latestPayrollByEmployee = Object.values(payrollByEmployee).sort(
        (a, b) => Number(a.employee_id) - Number(b.employee_id)
    );

    // Attendance chart data.
    const attendanceChartData = [
        { name: "Present", value: attendanceCounts.present },
        { name: "Half Day", value: attendanceCounts.halfDay },
        { name: "Absent", value: attendanceCounts.absent },
    ];

    // Leave chart data.
    const leaveChartData = [
        { name: "Pending", value: leaveCounts.pending },
        { name: "Approved", value: leaveCounts.approved },
        { name: "Rejected", value: leaveCounts.rejected },
    ];

    // Payroll chart data:
    // Each bar represents one employee's latest payroll.
    const payrollChartData = latestPayrollByEmployee.map((record) => ({
        name: `Employee ${record.employee_id}`,
        grossSalary: Number(record.gross_salary || 0),
        deductions: Number(record.total_deductions || 0),
        netSalary: Number(record.net_salary || 0),
    }));

    const chartColors = ["#16a34a", "#f59e0b", "#dc2626"];

    // Dashboard shortcuts.
    const quickActions = [
        {
            title: "Attendance",
            description: isEmployee
                ? "View your attendance history."
                : "Review employee attendance records.",
            page: "attendance",
            icon: "AT",
        },
        {
            title: "Leave Management",
            description: isEmployee
                ? "Apply for leave and track requests."
                : "Review and manage leave requests.",
            page: "leaves",
            icon: "LV",
        },
        {
            title: "Payroll",
            description: isEmployee
                ? "View your salary and payment history."
                : "Manage salary records and payments.",
            page: "payroll",
            icon: "PY",
        },
        {
            title: "My Profile",
            description: "View and update your account details.",
            page: "profile",
            icon: "PR",
        },
        ...(isHROrAdmin
            ? [
                  {
                      title: "Employees",
                      description: "Manage employee information.",
                      page: "employees",
                      icon: "EM",
                  },
              ]
            : []),
    ];

    return (
        <main className="dashboard-container">
            {/* Welcome section */}
            <section className="dashboard-welcome-card">
                <div className="dashboard-welcome-content">
                    <span className="dashboard-welcome-label">
                        WORKSPACE OVERVIEW
                    </span>

                    <h1>Welcome back, {user?.username || "User"}!</h1>

                    <p>
                        Manage your work, track your progress, and stay
                        connected with your organization.
                    </p>

                    <span className="dashboard-role-label">
                        {getDashboardName(user?.role)}
                    </span>
                </div>

                <div className="dashboard-welcome-avatar">
                    {(user?.username || "U").charAt(0).toUpperCase()}
                </div>
            </section>

            {/* Organization statistics */}
            {isHROrAdmin && (
                <section className="dashboard-statistics-section">
                    <div className="dashboard-section-heading">
                        <div>
                            <span className="dashboard-section-eyebrow">
                                ORGANIZATION OVERVIEW
                            </span>

                            <h2>Dashboard Statistics</h2>

                            <p>
                                Latest counts from your WorkSphere database.
                            </p>
                        </div>

                        <button
                            type="button"
                            className="dashboard-refresh-button"
                            onClick={() => loadStatistics(true)}
                            disabled={loading || refreshing}
                        >
                            {refreshing ? "Refreshing..." : "Refresh"}
                        </button>
                    </div>

                    {loading && (
                        <div className="dashboard-info-message">
                            Loading dashboard statistics...
                        </div>
                    )}

                    {error && (
                        <div
                            className="dashboard-error-message"
                            role="alert"
                        >
                            <span>{error}</span>

                            <button
                                type="button"
                                onClick={() => loadStatistics(true)}
                                disabled={refreshing}
                            >
                                Try Again
                            </button>
                        </div>
                    )}

                    {!loading && !error && statistics && (
                        <>
                            <div className="dashboard-statistics-grid">
                                {statisticCards.map((card) => (
                                    <article
                                        className="dashboard-stat-card"
                                        key={card.title}
                                    >
                                        <div className="dashboard-stat-card-top">
                                            <span className="dashboard-stat-icon">
                                                {card.icon}
                                            </span>

                                            <span className="dashboard-stat-indicator">
                                                Live
                                            </span>
                                        </div>

                                        <p className="dashboard-stat-title">
                                            {card.title}
                                        </p>

                                        <h3 className="dashboard-stat-value">
                                            {card.value}
                                        </h3>

                                        <p className="dashboard-stat-description">
                                            {card.description}
                                        </p>
                                    </article>
                                ))}
                            </div>

                            {statistics.generated_at && (
                                <p className="dashboard-statistics-updated">
                                    Last updated:{" "}
                                    {new Date(
                                        statistics.generated_at
                                    ).toLocaleString("en-IN")}
                                </p>
                            )}
                        </>
                    )}
                </section>
            )}

            {/* Attendance summary */}
            <section className="dashboard-summary-section">
                <div className="dashboard-section-heading">
                    <div>
                        <span className="dashboard-section-eyebrow">
                            TIME & ATTENDANCE
                        </span>

                        <h2>Attendance Overview</h2>

                        <p>
                            {isEmployee
                                ? "A summary of your recorded attendance."
                                : "Attendance summary across employee records."}
                        </p>
                    </div>

                    <button
                        type="button"
                        className="dashboard-text-button"
                        onClick={() => onNavigate?.("attendance")}
                    >
                        View Attendance
                    </button>
                </div>

                {attendanceLoading ? (
                    <div className="dashboard-info-message">
                        Loading attendance summary...
                    </div>
                ) : attendanceError ? (
                    <div className="dashboard-error-message" role="alert">
                        {attendanceError}
                    </div>
                ) : (
                    <div className="dashboard-summary-grid">
                        <article className="dashboard-summary-card">
                            <span className="dashboard-summary-label">
                                Present
                            </span>
                            <strong>{attendanceCounts.present}</strong>
                            <small>Present records</small>
                        </article>

                        <article className="dashboard-summary-card">
                            <span className="dashboard-summary-label">
                                Half Day
                            </span>
                            <strong>{attendanceCounts.halfDay}</strong>
                            <small>Half-day records</small>
                        </article>

                        <article className="dashboard-summary-card">
                            <span className="dashboard-summary-label">
                                Absent
                            </span>
                            <strong>{attendanceCounts.absent}</strong>
                            <small>Absent records</small>
                        </article>
                    </div>
                )}
            </section>

            {/* Leave summary */}
            <section className="dashboard-summary-section">
                <div className="dashboard-section-heading">
                    <div>
                        <span className="dashboard-section-eyebrow">
                            LEAVE MANAGEMENT
                        </span>

                        <h2>Leave Overview</h2>

                        <p>
                            {isEmployee
                                ? "Track your leave application statuses."
                                : "Review leave request statuses."}
                        </p>
                    </div>

                    <button
                        type="button"
                        className="dashboard-text-button"
                        onClick={() => onNavigate?.("leaves")}
                    >
                        View Leaves
                    </button>
                </div>

                {leavesLoading ? (
                    <div className="dashboard-info-message">
                        Loading leave summary...
                    </div>
                ) : leavesError ? (
                    <div className="dashboard-error-message" role="alert">
                        {leavesError}
                    </div>
                ) : (
                    <div className="dashboard-summary-grid">
                        <article className="dashboard-summary-card pending">
                            <span className="dashboard-summary-label">
                                Pending
                            </span>
                            <strong>{leaveCounts.pending}</strong>
                            <small>Awaiting review</small>
                        </article>

                        <article className="dashboard-summary-card approved">
                            <span className="dashboard-summary-label">
                                Approved
                            </span>
                            <strong>{leaveCounts.approved}</strong>
                            <small>Approved requests</small>
                        </article>

                        <article className="dashboard-summary-card rejected">
                            <span className="dashboard-summary-label">
                                Rejected
                            </span>
                            <strong>{leaveCounts.rejected}</strong>
                            <small>Rejected requests</small>
                        </article>
                    </div>
                )}
            </section>

            {/* Latest payslip */}
            <section className="dashboard-summary-section">
                <div className="dashboard-section-heading">
                    <div>
                        <span className="dashboard-section-eyebrow">
                            COMPENSATION
                        </span>

                        <h2>Latest Payslip</h2>

                        <p>
                            {isEmployee
                                ? "Your most recent salary record."
                                : "The most recent payroll record in the organization."}
                        </p>
                    </div>

                    <button
                        type="button"
                        className="dashboard-text-button"
                        onClick={() => onNavigate?.("payroll")}
                    >
                        View Payroll
                    </button>
                </div>

                {payrollLoading ? (
                    <div className="dashboard-info-message">
                        Loading payroll information...
                    </div>
                ) : payrollError ? (
                    <div className="dashboard-error-message" role="alert">
                        {payrollError}
                    </div>
                ) : !latestPayroll ? (
                    <div className="dashboard-empty-message">
                        <h3>No payroll record available</h3>
                        <p>
                            A payslip will appear here after payroll has been
                            generated.
                        </p>
                    </div>
                ) : (
                    <article className="dashboard-payslip-card">
                        <div className="dashboard-payslip-header">
                            <div>
                                <span className="dashboard-payslip-label">
                                    SALARY PERIOD
                                </span>

                                <h3>
                                    {formatMonth(
                                        latestPayroll.month,
                                        latestPayroll.year
                                    )}
                                </h3>

                                <p>Payroll ID: #{latestPayroll.id}</p>
                            </div>

                            <span
                                className={`dashboard-payslip-status ${
                                    latestPayroll.status === "PAID"
                                        ? "is-paid"
                                        : "is-pending"
                                }`}
                            >
                                {latestPayroll.status}
                            </span>
                        </div>

                        <div className="dashboard-payslip-grid">
                            <div>
                                <span>Gross Salary</span>
                                <strong>
                                    {formatCurrency(
                                        latestPayroll.gross_salary
                                    )}
                                </strong>
                            </div>

                            <div>
                                <span>Total Deductions</span>
                                <strong>
                                    {formatCurrency(
                                        latestPayroll.total_deductions
                                    )}
                                </strong>
                            </div>

                            <div className="dashboard-payslip-net">
                                <span>Net Salary</span>
                                <strong>
                                    {formatCurrency(
                                        latestPayroll.net_salary
                                    )}
                                </strong>
                            </div>
                        </div>

                        {latestPayroll.payment_date && (
                            <p className="dashboard-payment-date">
                                Payment date: {latestPayroll.payment_date}
                            </p>
                        )}
                    </article>
                )}
            </section>

            {/* Dashboard Analytics Charts */}
            <section className="dashboard-summary-section">
                <div className="dashboard-section-heading">
                    <div>
                        <span className="dashboard-section-eyebrow">
                            ANALYTICS & REPORTS
                        </span>

                        <h2>Dashboard Analytics</h2>

                        <p>
                            Visual reports for attendance, leave, and payroll.
                        </p>
                    </div>
                </div>

                <div className="dashboard-charts-grid">
                    {/* Attendance chart */}
                    <article className="dashboard-chart-card">
                        <h3>Attendance Summary</h3>

                        <p>
                            Distribution of recorded attendance statuses.
                        </p>

                        {attendanceLoading ? (
                            <div className="dashboard-info-message">
                                Loading attendance chart...
                            </div>
                        ) : attendanceError ? (
                            <div className="dashboard-error-message">
                                {attendanceError}
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height={280}>
                                <PieChart>
                                    <Pie
                                        data={attendanceChartData}
                                        dataKey="value"
                                        nameKey="name"
                                        cx="50%"
                                        cy="45%"
                                        outerRadius={85}
                                        label
                                    >
                                        {attendanceChartData.map(
                                            (entry, index) => (
                                                <Cell
                                                    key={entry.name}
                                                    fill={chartColors[index]}
                                                />
                                            )
                                        )}
                                    </Pie>

                                    <Tooltip />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </article>

                    {/* Leave chart */}
                    <article className="dashboard-chart-card">
                        <h3>Leave Statistics</h3>

                        <p>Overview of leave application statuses.</p>

                        {leavesLoading ? (
                            <div className="dashboard-info-message">
                                Loading leave chart...
                            </div>
                        ) : leavesError ? (
                            <div className="dashboard-error-message">
                                {leavesError}
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height={280}>
                                <PieChart>
                                    <Pie
                                        data={leaveChartData}
                                        dataKey="value"
                                        nameKey="name"
                                        cx="50%"
                                        cy="45%"
                                        outerRadius={85}
                                        label
                                    >
                                        {leaveChartData.map(
                                            (entry, index) => (
                                                <Cell
                                                    key={entry.name}
                                                    fill={chartColors[index]}
                                                />
                                            )
                                        )}
                                    </Pie>

                                    <Tooltip />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </article>

                    {/* Payroll overview for every employee with payroll */}
                    <article className="dashboard-chart-card dashboard-payroll-chart">
                        <h3>Payroll Overview</h3>

                        <p>
                            Latest payroll comparison for each employee.
                        </p>

                        {payrollLoading ? (
                            <div className="dashboard-info-message">
                                Loading payroll chart...
                            </div>
                        ) : payrollError ? (
                            <div className="dashboard-error-message">
                                {payrollError}
                            </div>
                        ) : payrollChartData.length === 0 ? (
                            <div className="dashboard-empty-message">
                                <h3>No payroll data available</h3>
                                <p>
                                    Payroll figures will appear after payroll
                                    records have been generated.
                                </p>
                            </div>
                        ) : (
                            <ResponsiveContainer
                                width="100%"
                                height={340}
                            >
                                <BarChart
                                    data={payrollChartData}
                                    margin={{
                                        top: 20,
                                        right: 20,
                                        left: 10,
                                        bottom: 10,
                                    }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" />

                                    <XAxis
                                        dataKey="name"
                                        tick={{ fontSize: 12 }}
                                    />

                                    <YAxis
                                        tickFormatter={(value) =>
                                            `₹${Number(value).toLocaleString(
                                                "en-IN"
                                            )}`
                                        }
                                    />

                                    <Tooltip
                                        formatter={(value, name) => [
                                            formatCurrency(value),
                                            name,
                                        ]}
                                    />

                                    <Legend />

                                    <Bar
                                        dataKey="grossSalary"
                                        name="Gross Salary"
                                        fill="#2563eb"
                                        radius={[4, 4, 0, 0]}
                                    />

                                    <Bar
                                        dataKey="deductions"
                                        name="Deductions"
                                        fill="#dc2626"
                                        radius={[4, 4, 0, 0]}
                                    />

                                    <Bar
                                        dataKey="netSalary"
                                        name="Net Salary"
                                        fill="#16a34a"
                                        radius={[4, 4, 0, 0]}
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        )}

                        {!payrollLoading &&
                            !payrollError &&
                            isHROrAdmin &&
                            payrollChartData.length > 0 && (
                                <div className="dashboard-payroll-report">
                                    <h4>Employee Payroll Report</h4>

                                    <div className="dashboard-payroll-table-wrapper">
                                        <table className="dashboard-payroll-table">
                                            <thead>
                                                <tr>
                                                    <th>Employee ID</th>
                                                    <th>Period</th>
                                                    <th>Gross Salary</th>
                                                    <th>Deductions</th>
                                                    <th>Net Salary</th>
                                                    <th>Status</th>
                                                </tr>
                                            </thead>

                                            <tbody>
                                                {latestPayrollByEmployee.map(
                                                    (record) => (
                                                        <tr key={record.id}>
                                                            <td>
                                                                Employee #
                                                                {record.employee_id}
                                                            </td>

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

                                                            <td>
                                                                {formatCurrency(
                                                                    record.net_salary
                                                                )}
                                                            </td>

                                                            <td>
                                                                <span
                                                                    className={`dashboard-payslip-status ${
                                                                        record.status ===
                                                                        "PAID"
                                                                            ? "is-paid"
                                                                            : "is-pending"
                                                                    }`}
                                                                >
                                                                    {
                                                                        record.status
                                                                    }
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    )
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                    </article>
                </div>
            </section>

            {/* Quick actions */}
            <section className="dashboard-summary-section">
                <div className="dashboard-section-heading">
                    <div>
                        <span className="dashboard-section-eyebrow">
                            WORKSPACE SHORTCUTS
                        </span>

                        <h2>Quick Actions</h2>

                        <p>Open a section directly from your dashboard.</p>
                    </div>
                </div>

                <div className="dashboard-quick-actions-grid">
                    {quickActions.map((action) => (
                        <button
                            type="button"
                            className="dashboard-quick-action"
                            key={action.page}
                            onClick={() => onNavigate?.(action.page)}
                        >
                            <span className="dashboard-quick-action-icon">
                                {action.icon}
                            </span>

                            <span className="dashboard-quick-action-content">
                                <strong>{action.title}</strong>
                                <small>{action.description}</small>
                            </span>

                            <span className="dashboard-quick-action-arrow">
                                →
                            </span>
                        </button>
                    ))}
                </div>
            </section>

            {/* Existing account information */}
            <section className="dashboard-grid">
                <article className="dashboard-card">
                    <div className="dashboard-card-icon">01</div>

                    <h3>{getDashboardName(user?.role)}</h3>

                    <p>
                        Welcome to your WorkSphere workspace. Access your
                        account and manage your organizational activities.
                    </p>

                    <span className="dashboard-status-badge">
                        Account Active
                    </span>
                </article>

                <article className="dashboard-card">
                    <div className="dashboard-card-icon">02</div>

                    <h3>My Account</h3>

                    <p>
                        View your account information and profile details.
                    </p>

                    <div className="dashboard-profile-details">
                        <div>
                            <span>Username</span>
                            <strong>{user?.username || "—"}</strong>
                        </div>

                        <div>
                            <span>Email Address</span>
                            <strong>{user?.email || "—"}</strong>
                        </div>

                        <div>
                            <span>Account Role</span>
                            <strong>{user?.role || "—"}</strong>
                        </div>

                        <div>
                            <span>Account ID</span>
                            <strong>{user?.id ?? "—"}</strong>
                        </div>
                    </div>

                    <button
                        type="button"
                        className="dashboard-profile-button"
                        onClick={() => onNavigate?.("profile")}
                    >
                        Manage My Profile
                    </button>
                </article>
            </section>
        </main>
    );
}

export default Dashboard;
