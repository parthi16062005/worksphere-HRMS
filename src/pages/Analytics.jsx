
import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    PieChart,
    Pie,
    Cell,
    Legend,
} from "recharts";

import "../style/Analytics.css";

const API_URL = "http://127.0.0.1:8000";

function getDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function Analytics({ user }) {
    const today = new Date();

    const firstDay = new Date(
        today.getFullYear(),
        today.getMonth(),
        1
    );

    const [startDate, setStartDate] = useState(
        getDateString(firstDay)
    );

    const [endDate, setEndDate] = useState(
        getDateString(today)
    );

    const [department, setDepartment] = useState("");
    const [analytics, setAnalytics] = useState({
        attendance: null,
        leaves: null,
        performance: null,
        departments: null,
    });

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const role = String(user?.role || "").toUpperCase();
    const isHROrAdmin = role === "HR" || role === "ADMIN";

    const token = localStorage.getItem("worksphere_token");

    const loadAnalytics = useCallback(async () => {
        if (!token) {
            setError("Your session has expired. Please log in again.");
            setLoading(false);
            return;
        }

        if (!startDate || !endDate) {
            setError("Please select both dates.");
            setLoading(false);
            return;
        }

        if (startDate > endDate) {
            setError("Start date cannot be after the end date.");
            setLoading(false);
            return;
        }

        setLoading(true);
        setError("");

        const params = {
            start_date: startDate,
            end_date: endDate,
        };

        if (isHROrAdmin && department) {
            params.department = department;
        }

        const config = {
            headers: {
                Authorization: `Bearer ${token}`,
            },
            params,
        };

        try {
            const requests = [
                axios.get(`${API_URL}/analytics/attendance`, config),
                axios.get(`${API_URL}/analytics/leaves`, config),
                axios.get(`${API_URL}/analytics/performance`, config),
            ];

            if (isHROrAdmin) {
                requests.push(
                    axios.get(`${API_URL}/analytics/departments`, config)
                );
            }

            const responses = await Promise.all(requests);

            setAnalytics({
                attendance: responses[0].data,
                leaves: responses[1].data,
                performance: responses[2].data,
                departments: isHROrAdmin
                    ? responses[3].data
                    : null,
            });
        } catch (err) {
            console.error("Analytics loading error:", err);

            setError(
                err.response?.data?.detail ||
                    "Unable to load analytics. Please check your backend and try again."
            );
        } finally {
            setLoading(false);
        }
    }, [
        token,
        startDate,
        endDate,
        department,
        isHROrAdmin,
    ]);

    useEffect(() => {
        loadAnalytics();
    }, [loadAnalytics]);

    const attendance = analytics.attendance;
    const leaves = analytics.leaves;
    const performance = analytics.performance;
    const departmentData = analytics.departments;

    const totalAttendance = Number(attendance?.total_records || 0);
    const presentCount = Number(attendance?.present || 0);
    const absentCount = Number(attendance?.absent || 0);

    const otherAttendance = Math.max(
        0,
        totalAttendance - presentCount - absentCount
    );

    const attendanceChartData = [
        { name: "Present", value: presentCount },
        { name: "Absent", value: absentCount },
        { name: "Other", value: otherAttendance },
    ].filter((item) => item.value > 0);

    const leaveChartData = [
        {
            name: "Pending",
            value: Number(leaves?.pending || 0),
        },
        {
            name: "Approved",
            value: Number(leaves?.approved || 0),
        },
        {
            name: "Rejected",
            value: Number(leaves?.rejected || 0),
        },
    ].filter((item) => item.value > 0);

    const performanceDistribution = performance?.rating_distribution;

    const performanceChartData = Array.isArray(performanceDistribution)
        ? performanceDistribution.map((item) => ({
              rating: item.rating,
              count: Number(item.count || 0),
          }))
        : performanceDistribution &&
            typeof performanceDistribution === "object"
          ? Object.entries(performanceDistribution).map(
                ([rating, count]) => ({
                    rating: Number(rating),
                    count: Number(count || 0),
                })
            )
          : [];

    const dailyTrend = Array.isArray(attendance?.daily_trend)
        ? attendance.daily_trend.map((item) => ({
              date: item.date,
              records: Number(
                  item.total_records ?? item.records ?? 0
              ),
          }))
        : [];

    const departmentRows = Array.isArray(departmentData?.departments)
        ? departmentData.departments
        : [];

    const leaveTypes = Array.isArray(leaves?.by_leave_type)
        ? leaves.by_leave_type
        : [];

    const departments = [
        ...new Set(
            departmentRows
                .map((item) => item.department)
                .filter(Boolean)
        ),
    ].sort();

    const attendanceRate = Number(
        attendance?.attendance_rate || 0
    );

    const averageRating = Number(
        performance?.average_rating || 0
    );

    return (
        <div className="analytics-page">
            <div className="analytics-heading">
                <div>
                    <span className="analytics-eyebrow">
                        WORKSPHERE INSIGHTS
                    </span>

                    <h1>Advanced Analytics &amp; Reports</h1>

                    <p>
                        Understand attendance, leave activity, and
                        performance for your selected period.
                    </p>
                </div>

                <button
                    type="button"
                    className="analytics-refresh"
                    onClick={loadAnalytics}
                    disabled={loading}
                >
                    {loading ? "Refreshing..." : "Refresh Reports"}
                </button>
            </div>

            <section className="analytics-filters">
                <div className="analytics-filter-field">
                    <label htmlFor="analytics-start-date">
                        Start Date
                    </label>

                    <input
                        id="analytics-start-date"
                        type="date"
                        value={startDate}
                        max={endDate}
                        onChange={(event) =>
                            setStartDate(event.target.value)
                        }
                    />
                </div>

                <div className="analytics-filter-field">
                    <label htmlFor="analytics-end-date">
                        End Date
                    </label>

                    <input
                        id="analytics-end-date"
                        type="date"
                        value={endDate}
                        min={startDate}
                        max={getDateString(today)}
                        onChange={(event) =>
                            setEndDate(event.target.value)
                        }
                    />
                </div>

                {isHROrAdmin && (
                    <div className="analytics-filter-field">
                        <label htmlFor="analytics-department">
                            Department
                        </label>

                        <select
                            id="analytics-department"
                            value={department}
                            onChange={(event) =>
                                setDepartment(event.target.value)
                            }
                        >
                            <option value="">All Departments</option>

                            {departments.map((name) => (
                                <option key={name} value={name}>
                                    {name}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                <div className="analytics-period">
                    <span>Selected Period</span>
                    <strong>
                        {startDate || "—"} to {endDate || "—"}
                    </strong>
                </div>
            </section>

            {error && (
                <div className="analytics-error" role="alert">
                    <strong>Unable to display reports</strong>
                    <p>{error}</p>

                    <button
                        type="button"
                        onClick={loadAnalytics}
                    >
                        Try Again
                    </button>
                </div>
            )}

            {loading && !attendance && !error && (
                <div className="analytics-loading">
                    <div className="analytics-spinner" />
                    <p>Loading analytics reports...</p>
                </div>
            )}

            {!loading && !error && attendance && leaves && performance && (
                <>
                    <section className="analytics-summary-grid">
                        <article className="analytics-summary-card">
                            <div className="analytics-card-icon attendance-icon">
                                A
                            </div>

                            <div>
                                <p>Attendance Rate</p>
                                <h2>{attendanceRate.toFixed(1)}%</h2>
                                <span>
                                    {presentCount} present records
                                </span>
                            </div>
                        </article>

                        <article className="analytics-summary-card">
                            <div className="analytics-card-icon leave-icon">
                                L
                            </div>

                            <div>
                                <p>Leave Requests</p>
                                <h2>
                                    {Number(leaves.total_requests || 0)}
                                </h2>
                                <span>
                                    {Number(leaves.pending || 0)} pending
                                    requests
                                </span>
                            </div>
                        </article>

                        <article className="analytics-summary-card">
                            <div className="analytics-card-icon performance-icon">
                                P
                            </div>

                            <div>
                                <p>Average Performance</p>
                                <h2>{averageRating.toFixed(2)} / 5</h2>
                                <span>
                                    {Number(performance.total_reviews || 0)}{" "}
                                    reviews
                                </span>
                            </div>
                        </article>

                        {isHROrAdmin && (
                            <article className="analytics-summary-card">
                                <div className="analytics-card-icon employees-icon">
                                    E
                                </div>

                                <div>
                                    <p>Employees in Report</p>
                                    <h2>
                                        {Number(
                                            departmentData?.total_active_employees ??
                                                departmentRows.length
                                        )}
                                    </h2>
                                    <span>
                                        {department
                                            ? department
                                            : "All departments"}
                                    </span>
                                </div>
                            </article>
                        )}
                    </section>

                    <section className="analytics-chart-grid">
                        <article className="analytics-panel">
                            <div className="analytics-panel-heading">
                                <div>
                                    <h3>Daily Attendance Trend</h3>
                                    <p>
                                        Attendance records by date
                                    </p>
                                </div>
                            </div>

                            {dailyTrend.length > 0 ? (
                                <div className="analytics-chart">
                                    <ResponsiveContainer
                                        width="100%"
                                        height="100%"
                                    >
                                        <BarChart
                                            data={dailyTrend}
                                            margin={{
                                                top: 10,
                                                right: 10,
                                                left: -15,
                                                bottom: 5,
                                            }}
                                        >
                                            <CartesianGrid
                                                strokeDasharray="3 3"
                                                vertical={false}
                                            />

                                            <XAxis
                                                dataKey="date"
                                                tick={{ fontSize: 11 }}
                                            />

                                            <YAxis allowDecimals={false} />

                                            <Tooltip />

                                            <Bar
                                                dataKey="records"
                                                name="Attendance Records"
                                                fill="#4776e6"
                                                radius={[5, 5, 0, 0]}
                                            />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : (
                                <div className="analytics-empty">
                                    No attendance trend data for this period.
                                </div>
                            )}
                        </article>

                        <article className="analytics-panel">
                            <div className="analytics-panel-heading">
                                <div>
                                    <h3>Attendance Breakdown</h3>
                                    <p>
                                        Present, absent, and other records
                                    </p>
                                </div>
                            </div>

                            {attendanceChartData.length > 0 ? (
                                <div className="analytics-chart analytics-pie-chart">
                                    <ResponsiveContainer
                                        width="100%"
                                        height="100%"
                                    >
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
                                                            key={`${entry.name}-${index}`}
                                                            fill={
                                                                [
                                                                    "#22a06b",
                                                                    "#e05252",
                                                                    "#e5a33d",
                                                                ][index % 3]
                                                            }
                                                        />
                                                    )
                                                )}
                                            </Pie>

                                            <Tooltip />
                                            <Legend />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : (
                                <div className="analytics-empty">
                                    No attendance records found.
                                </div>
                            )}
                        </article>

                        <article className="analytics-panel">
                            <div className="analytics-panel-heading">
                                <div>
                                    <h3>Leave Request Status</h3>
                                    <p>
                                        Current status of leave requests
                                    </p>
                                </div>
                            </div>

                            {leaveChartData.length > 0 ? (
                                <div className="analytics-chart analytics-pie-chart">
                                    <ResponsiveContainer
                                        width="100%"
                                        height="100%"
                                    >
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
                                                            key={`${entry.name}-${index}`}
                                                            fill={
                                                                [
                                                                    "#e5a33d",
                                                                    "#22a06b",
                                                                    "#e05252",
                                                                ][index % 3]
                                                            }
                                                        />
                                                    )
                                                )}
                                            </Pie>

                                            <Tooltip />
                                            <Legend />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : (
                                <div className="analytics-empty">
                                    No leave requests found.
                                </div>
                            )}
                        </article>

                        <article className="analytics-panel">
                            <div className="analytics-panel-heading">
                                <div>
                                    <h3>Performance Rating Distribution</h3>
                                    <p>
                                        Number of reviews by rating
                                    </p>
                                </div>
                            </div>

                            {performanceChartData.length > 0 ? (
                                <div className="analytics-chart">
                                    <ResponsiveContainer
                                        width="100%"
                                        height="100%"
                                    >
                                        <BarChart
                                            data={performanceChartData}
                                            margin={{
                                                top: 10,
                                                right: 10,
                                                left: -15,
                                                bottom: 5,
                                            }}
                                        >
                                            <CartesianGrid
                                                strokeDasharray="3 3"
                                                vertical={false}
                                            />

                                            <XAxis
                                                dataKey="rating"
                                                label={{
                                                    value: "Rating",
                                                    position: "insideBottom",
                                                    offset: -2,
                                                }}
                                            />

                                            <YAxis allowDecimals={false} />

                                            <Tooltip />

                                            <Bar
                                                dataKey="count"
                                                name="Reviews"
                                                fill="#8250df"
                                                radius={[5, 5, 0, 0]}
                                            />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : (
                                <div className="analytics-empty">
                                    No performance reviews found.
                                </div>
                            )}
                        </article>
                    </section>

                    {leaveTypes.length > 0 && (
                        <section className="analytics-panel analytics-table-panel">
                            <div className="analytics-panel-heading">
                                <div>
                                    <h3>Leave Type Summary</h3>
                                    <p>
                                        Requests grouped by leave type
                                    </p>
                                </div>
                            </div>

                            <div className="analytics-table-wrapper">
                                <table className="analytics-table">
                                    <thead>
                                        <tr>
                                            <th>Leave Type</th>
                                            <th>Requests</th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {leaveTypes.map((item, index) => (
                                            <tr
                                                key={
                                                    item.leave_type ||
                                                    item.type ||
                                                    index
                                                }
                                            >
                                                <td>
                                                    {item.leave_type ||
                                                        item.type ||
                                                        "Other"}
                                                </td>
                                                <td>
                                                    {Number(
                                                        item.count ??
                                                            item.total ??
                                                            item.total_requests ??
                                                            0
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    )}

                    {isHROrAdmin && (
                        <section className="analytics-panel analytics-table-panel">
                            <div className="analytics-panel-heading">
                                <div>
                                    <h3>Department Report</h3>
                                    <p>
                                        Attendance, leave, and performance
                                        by department
                                    </p>
                                </div>
                            </div>

                            {departmentRows.length > 0 ? (
                                <div className="analytics-table-wrapper">
                                    <table className="analytics-table">
                                        <thead>
                                            <tr>
                                                <th>Department</th>
                                                <th>Employees</th>
                                                <th>Attendance Rate</th>
                                                <th>Leave Requests</th>
                                                <th>Avg. Rating</th>
                                            </tr>
                                        </thead>

                                        <tbody>
                                            {departmentRows.map(
                                                (item, index) => (
                                                    <tr
                                                        key={
                                                            item.department ||
                                                            index
                                                        }
                                                    >
                                                        <td>
                                                            {item.department ||
                                                                "Unassigned"}
                                                        </td>

                                                        <td>
                                                            {Number(
                                                                item.employee_count ||
                                                                    0
                                                            )}
                                                        </td>

                                                        <td>
                                                            {Number(
                                                                item.attendance_rate ||
                                                                    0
                                                            ).toFixed(1)}
                                                            %
                                                        </td>

                                                        <td>
                                                            {Number(
                                                                item.leave_requests ||
                                                                    0
                                                            )}
                                                        </td>

                                                        <td>
                                                            {Number(
                                                                item.average_rating ||
                                                                    0
                                                            ).toFixed(2)}
                                                        </td>
                                                    </tr>
                                                )
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="analytics-empty">
                                    No department report data available.
                                </div>
                            )}
                        </section>
                    )}
                </>
            )}
        </div>
    );
}

export default Analytics;
