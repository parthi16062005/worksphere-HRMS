
import { useCallback, useEffect, useState } from "react";
import api from "../services/api";
import "../style/Leaves.css";

const initialForm = {
    leave_type: "CASUAL",
    start_date: "",
    end_date: "",
    reason: "",
};

function formatDate(value) {
    if (!value) return "-";

    return new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}

function formatDateTime(value) {
    if (!value) return "-";

    const normalizedValue = value.endsWith("Z")
        ? value
        : `${value}Z`;

    return new Date(normalizedValue).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
    });
}

function getErrorMessage(error) {
    const detail = error.response?.data?.detail;

    if (typeof detail === "string") {
        return detail;
    }

    if (Array.isArray(detail)) {
        return detail.map((item) => item.msg).join(", ");
    }

    return "Something went wrong. Please try again.";
}

function Leaves({ user }) {
    const isEmployee = user?.role === "EMPLOYEE";
    const isHROrAdmin = user?.role === "HR" || user?.role === "ADMIN";

    const [leaves, setLeaves] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [reviewingId, setReviewingId] = useState(null);

    const [form, setForm] = useState(initialForm);
    const [reviewComments, setReviewComments] = useState({});
    const [filterStatus, setFilterStatus] = useState("");
    const [filterEmployeeId, setFilterEmployeeId] = useState("");

    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    const loadLeaves = useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            let response;

            if (isEmployee) {
                response = await api.get("/leaves/my");
            } else if (isHROrAdmin) {
                const params = {};

                if (filterStatus) {
                    params.leave_status = filterStatus;
                }

                if (filterEmployeeId.trim()) {
                    params.employee_id = Number(filterEmployeeId);
                }

                response = await api.get("/leaves", { params });
            } else {
                setLeaves([]);
                setError("You do not have permission to access leave management.");
                return;
            }

            setLeaves(response.data);
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    }, [isEmployee, isHROrAdmin, filterStatus, filterEmployeeId]);

    useEffect(() => {
        loadLeaves();
    }, [loadLeaves]);

    const handleFormChange = (event) => {
        const { name, value } = event.target;

        setForm((previous) => ({
            ...previous,
            [name]: value,
        }));
    };

    const handleApplyLeave = async (event) => {
        event.preventDefault();

        setError("");
        setMessage("");

        if (form.end_date < form.start_date) {
            setError("The end date cannot be before the start date.");
            return;
        }

        if (form.start_date < getTodayDate()) {
            setError("Please select today or a future date.");
            return;
        }

        if (form.reason.trim().length < 5) {
            setError("Please enter a reason with at least 5 characters.");
            return;
        }

        setSubmitting(true);

        try {
            await api.post("/leaves", {
                ...form,
                reason: form.reason.trim(),
            });

            setMessage("Your leave application was submitted successfully.");
            setForm(initialForm);

            await loadLeaves();
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setSubmitting(false);
        }
    };

    const handleReview = async (leaveId, status) => {
        setError("");
        setMessage("");

        const action = status === "APPROVED" ? "approve" : "reject";

        const confirmed = window.confirm(
            `Are you sure you want to ${action} this leave request?`
        );

        if (!confirmed) return;

        setReviewingId(leaveId);

        try {
            await api.patch(`/leaves/${leaveId}/review`, {
                status,
                review_comment: reviewComments[leaveId]?.trim() || null,
            });

            setMessage(
                `Leave request #${leaveId} was ${status.toLowerCase()} successfully.`
            );

            await loadLeaves();
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setReviewingId(null);
        }
    };

    const pendingCount = leaves.filter(
        (leave) => leave.status === "PENDING"
    ).length;

    const approvedCount = leaves.filter(
        (leave) => leave.status === "APPROVED"
    ).length;

    const rejectedCount = leaves.filter(
        (leave) => leave.status === "REJECTED"
    ).length;

    return (
        <div className="ws-leaves-page">
            <div className="ws-leaves-header">
                <div>
                    <span className="ws-leaves-eyebrow">
                        WORKSPHERE / HUMAN RESOURCES
                    </span>

                    <h2>
                        {isEmployee ? "My Leave Management" : "Leave Management"}
                    </h2>

                    <p>
                        {isEmployee
                            ? "Apply for leave and track the status of your applications."
                            : "Review employee leave applications and manage requests."}
                    </p>
                </div>

                <button
                    type="button"
                    className="ws-leaves-refresh"
                    onClick={loadLeaves}
                    disabled={loading}
                >
                    {loading ? "Refreshing..." : "Refresh"}
                </button>
            </div>

            {error && (
                <div className="ws-leaves-alert ws-leaves-error" role="alert">
                    {error}
                </div>
            )}

            {message && (
                <div className="ws-leaves-alert ws-leaves-success" role="status">
                    {message}
                </div>
            )}

            <div className="ws-leaves-stats">
                <div className="ws-leaves-stat-card">
                    <span className="ws-leaves-stat-label">Total Requests</span>
                    <strong>{leaves.length}</strong>
                    <span className="ws-leaves-stat-caption">
                        {isEmployee ? "Your applications" : "Matching requests"}
                    </span>
                </div>

                <div className="ws-leaves-stat-card pending">
                    <span className="ws-leaves-stat-label">Pending</span>
                    <strong>{pendingCount}</strong>
                    <span className="ws-leaves-stat-caption">
                        Awaiting review
                    </span>
                </div>

                <div className="ws-leaves-stat-card approved">
                    <span className="ws-leaves-stat-label">Approved</span>
                    <strong>{approvedCount}</strong>
                    <span className="ws-leaves-stat-caption">
                        Approved requests
                    </span>
                </div>

                <div className="ws-leaves-stat-card rejected">
                    <span className="ws-leaves-stat-label">Rejected</span>
                    <strong>{rejectedCount}</strong>
                    <span className="ws-leaves-stat-caption">
                        Rejected requests
                    </span>
                </div>
            </div>

            {isEmployee && (
                <section className="ws-leaves-panel">
                    <div className="ws-leaves-panel-heading">
                        <div>
                            <h3>Apply for Leave</h3>
                            <p>Complete the form to submit a new application.</p>
                        </div>
                    </div>

                    <form
                        className="ws-leaves-form"
                        onSubmit={handleApplyLeave}
                    >
                        <div className="ws-leaves-form-grid">
                            <div className="ws-leaves-field">
                                <label htmlFor="leave_type">Leave Type</label>

                                <select
                                    id="leave_type"
                                    name="leave_type"
                                    value={form.leave_type}
                                    onChange={handleFormChange}
                                    required
                                >
                                    <option value="CASUAL">Casual Leave</option>
                                    <option value="SICK">Sick Leave</option>
                                    <option value="PAID">Paid Leave</option>
                                </select>
                            </div>

                            <div className="ws-leaves-field">
                                <label htmlFor="start_date">Start Date</label>

                                <input
                                    id="start_date"
                                    type="date"
                                    name="start_date"
                                    min={getTodayDate()}
                                    value={form.start_date}
                                    onChange={handleFormChange}
                                    required
                                />
                            </div>

                            <div className="ws-leaves-field">
                                <label htmlFor="end_date">End Date</label>

                                <input
                                    id="end_date"
                                    type="date"
                                    name="end_date"
                                    min={form.start_date || getTodayDate()}
                                    value={form.end_date}
                                    onChange={handleFormChange}
                                    required
                                />
                            </div>
                        </div>

                        <div className="ws-leaves-field">
                            <label htmlFor="reason">Reason for Leave</label>

                            <textarea
                                id="reason"
                                name="reason"
                                rows="4"
                                maxLength="500"
                                minLength="5"
                                placeholder="Explain why you need leave..."
                                value={form.reason}
                                onChange={handleFormChange}
                                required
                            />

                            <span className="ws-leaves-character-count">
                                {form.reason.length}/500 characters
                            </span>
                        </div>

                        <div className="ws-leaves-form-footer">
                            <span className="ws-leaves-note">
                                Your application will initially be marked Pending.
                            </span>

                            <button
                                type="submit"
                                className="ws-leaves-primary-button"
                                disabled={submitting}
                            >
                                {submitting
                                    ? "Submitting..."
                                    : "Submit Application"}
                            </button>
                        </div>
                    </form>
                </section>
            )}

            {isHROrAdmin && (
                <section className="ws-leaves-panel">
                    <div className="ws-leaves-panel-heading">
                        <div>
                            <h3>Filter Leave Requests</h3>
                            <p>Find applications by status or employee ID.</p>
                        </div>
                    </div>

                    <div className="ws-leaves-filters">
                        <div className="ws-leaves-field">
                            <label htmlFor="filter_status">Application Status</label>

                            <select
                                id="filter_status"
                                value={filterStatus}
                                onChange={(event) =>
                                    setFilterStatus(event.target.value)
                                }
                            >
                                <option value="">All Statuses</option>
                                <option value="PENDING">Pending</option>
                                <option value="APPROVED">Approved</option>
                                <option value="REJECTED">Rejected</option>
                            </select>
                        </div>

                        <div className="ws-leaves-field">
                            <label htmlFor="filter_employee_id">
                                Employee ID
                            </label>

                            <input
                                id="filter_employee_id"
                                type="number"
                                min="1"
                                placeholder="Enter employee ID"
                                value={filterEmployeeId}
                                onChange={(event) =>
                                    setFilterEmployeeId(event.target.value)
                                }
                            />
                        </div>

                        <button
                            type="button"
                            className="ws-leaves-primary-button"
                            onClick={loadLeaves}
                            disabled={loading}
                        >
                            Apply Filters
                        </button>
                    </div>
                </section>
            )}

            <section className="ws-leaves-panel">
                <div className="ws-leaves-panel-heading">
                    <div>
                        <h3>
                            {isEmployee
                                ? "My Leave History"
                                : "Employee Leave Requests"}
                        </h3>

                        <p>
                            {leaves.length}{" "}
                            {leaves.length === 1 ? "record" : "records"} found
                        </p>
                    </div>
                </div>

                {loading ? (
                    <div className="ws-leaves-state">
                        Loading leave records...
                    </div>
                ) : leaves.length === 0 ? (
                    <div className="ws-leaves-empty">
                        <div className="ws-leaves-empty-icon">L</div>
                        <h3>No leave applications found</h3>
                        <p>
                            {isEmployee
                                ? "Your submitted leave applications will appear here."
                                : "No requests match your current filters."}
                        </p>
                    </div>
                ) : (
                    <div className="ws-leaves-table-wrapper">
                        <table className="ws-leaves-table">
                            <thead>
                                <tr>
                                    <th>Request</th>

                                    {isHROrAdmin && <th>Employee ID</th>}

                                    <th>Leave Type</th>
                                    <th>Leave Period</th>
                                    <th>Applied On</th>
                                    <th>Status</th>
                                    <th>Review Details</th>

                                    {isHROrAdmin && <th>Actions</th>}
                                </tr>
                            </thead>

                            <tbody>
                                {leaves.map((leave) => (
                                    <tr key={leave.id}>
                                        <td>
                                            <strong>#{leave.id}</strong>
                                            <span className="ws-leaves-reason">
                                                {leave.reason}
                                            </span>
                                        </td>

                                        {isHROrAdmin && (
                                            <td>{leave.employee_id}</td>
                                        )}

                                        <td>
                                            <span className="ws-leaves-type">
                                                {leave.leave_type}
                                            </span>
                                        </td>

                                        <td>
                                            <div className="ws-leaves-period">
                                                <span>
                                                    {formatDate(leave.start_date)}
                                                </span>
                                                <span className="ws-leaves-period-separator">
                                                    to
                                                </span>
                                                <span>
                                                    {formatDate(leave.end_date)}
                                                </span>
                                            </div>
                                        </td>

                                        <td>{formatDateTime(leave.applied_at)}</td>

                                        <td>
                                            <span
                                                className={`ws-leaves-status ${leave.status.toLowerCase()}`}
                                            >
                                                {leave.status}
                                            </span>
                                        </td>

                                        <td>
                                            <div className="ws-leaves-review-details">
                                                <span>
                                                    {leave.review_comment || "No comments"}
                                                </span>

                                                {leave.reviewed_at && (
                                                    <small>
                                                        {formatDateTime(leave.reviewed_at)}
                                                    </small>
                                                )}
                                            </div>
                                        </td>

                                        {isHROrAdmin && (
                                            <td className="ws-leaves-actions-cell">
                                                {leave.status === "PENDING" ? (
                                                    <div className="ws-leaves-review-actions">
                                                        <textarea
                                                            rows="2"
                                                            maxLength="500"
                                                            placeholder="Optional review comment"
                                                            aria-label={`Review comment for request ${leave.id}`}
                                                            value={
                                                                reviewComments[leave.id] || ""
                                                            }
                                                            onChange={(event) =>
                                                                setReviewComments(
                                                                    (previous) => ({
                                                                        ...previous,
                                                                        [leave.id]: event.target.value,
                                                                    })
                                                                )
                                                            }
                                                        />

                                                        <div className="ws-leaves-action-buttons">
                                                            <button
                                                                type="button"
                                                                className="ws-leaves-approve-button"
                                                                disabled={reviewingId !== null}
                                                                onClick={() =>
                                                                    handleReview(
                                                                        leave.id,
                                                                        "APPROVED"
                                                                    )
                                                                }
                                                            >
                                                                {reviewingId === leave.id
                                                                    ? "Processing..."
                                                                    : "Approve"}
                                                            </button>

                                                            <button
                                                                type="button"
                                                                className="ws-leaves-reject-button"
                                                                disabled={reviewingId !== null}
                                                                onClick={() =>
                                                                    handleReview(
                                                                        leave.id,
                                                                        "REJECTED"
                                                                    )
                                                                }
                                                            >
                                                                Reject
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span className="ws-leaves-completed-action">
                                                        Reviewed
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
        </div>
    );
}

function getTodayDate() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

export default Leaves;
