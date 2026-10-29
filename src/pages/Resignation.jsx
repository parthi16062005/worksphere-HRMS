
import { useEffect, useState } from "react";

import {
    submitResignation,
    getMyResignations,
    getAllResignations,
    reviewResignation,
} from "../services/resignationService";

import "../style/Resignation.css";


function Resignation({ user }) {
    const role = String(user?.role || "").toUpperCase();

    const isEmployee = role === "EMPLOYEE";
    const isHROrAdmin = role === "HR" || role === "ADMIN";

    const [resignations, setResignations] = useState([]);

    const [reason, setReason] = useState("");
    const [noticePeriod, setNoticePeriod] = useState(30);

    const [statusFilter, setStatusFilter] = useState("");

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [reviewingId, setReviewingId] = useState(null);

    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");


    // =====================================================
    // LOAD RESIGNATIONS
    // =====================================================

    const loadResignations = async () => {
        try {
            setLoading(true);
            setError("");

            let data;

            if (isHROrAdmin) {
                data = await getAllResignations(
                    statusFilter
                        ? { status: statusFilter }
                        : {}
                );
            } else {
                data = await getMyResignations();
            }

            setResignations(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error("Failed to load resignations:", err);

            setError(
                err?.response?.data?.detail ||
                "Failed to load resignation requests."
            );
        } finally {
            setLoading(false);
        }
    };


    useEffect(() => {
        loadResignations();
    }, [statusFilter]);


    // =====================================================
    // SUBMIT RESIGNATION
    // =====================================================

    const handleSubmit = async (event) => {
        event.preventDefault();

        setError("");
        setSuccess("");

        const trimmedReason = reason.trim();

        if (trimmedReason.length < 5) {
            setError(
                "Please provide a resignation reason of at least 5 characters."
            );
            return;
        }

        if (
            !Number.isInteger(Number(noticePeriod)) ||
            Number(noticePeriod) < 1 ||
            Number(noticePeriod) > 365
        ) {
            setError(
                "Notice period must be between 1 and 365 days."
            );
            return;
        }

        try {
            setSubmitting(true);

            await submitResignation({
                reason: trimmedReason,
                notice_period: Number(noticePeriod),
            });

            setReason("");
            setNoticePeriod(30);

            setSuccess(
                "Your resignation request has been submitted successfully."
            );

            await loadResignations();
        } catch (err) {
            console.error("Failed to submit resignation:", err);

            setError(
                err?.response?.data?.detail ||
                "Failed to submit resignation."
            );
        } finally {
            setSubmitting(false);
        }
    };


    // =====================================================
    // REVIEW RESIGNATION
    // =====================================================

    const handleReview = async (id, decision) => {
        const actionText =
            decision === "APPROVED"
                ? "approve"
                : "reject";

        const confirmed = window.confirm(
            `Are you sure you want to ${actionText} this resignation request?`
        );

        if (!confirmed) {
            return;
        }

        try {
            setReviewingId(id);
            setError("");
            setSuccess("");

            await reviewResignation(id, decision);

            setSuccess(
                `Resignation request ${decision.toLowerCase()} successfully.`
            );

            await loadResignations();
        } catch (err) {
            console.error("Failed to review resignation:", err);

            setError(
                err?.response?.data?.detail ||
                "Failed to review resignation."
            );
        } finally {
            setReviewingId(null);
        }
    };


    // =====================================================
    // STATUS CLASS
    // =====================================================

    const getStatusClass = (status) => {
        return String(status || "")
            .toLowerCase();
    };


    // =====================================================
    // FORMAT DATE
    // =====================================================

    const formatDate = (value) => {
        if (!value) {
            return "-";
        }

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return value;
        }

        return date.toLocaleDateString(
            "en-IN",
            {
                day: "2-digit",
                month: "short",
                year: "numeric",
            }
        );
    };


    return (
        <div className="resignation-page">

            {/* =================================================
                PAGE HEADER
            ================================================= */}

            <div className="resignation-header">

                <div>
                    <h1>Resignation & Exit Management</h1>

                    <p>
                        Submit, track, and manage employee resignation
                        requests.
                    </p>
                </div>

                <button
                    type="button"
                    className="resignation-refresh-btn"
                    onClick={loadResignations}
                >
                    Refresh
                </button>

            </div>


            {/* =================================================
                ALERTS
            ================================================= */}

            {error && (
                <div className="resignation-alert error">
                    {error}
                </div>
            )}

            {success && (
                <div className="resignation-alert success">
                    {success}
                </div>
            )}


            {/* =================================================
                EMPLOYEE SUBMISSION FORM
            ================================================= */}

            {isEmployee && (
                <div className="resignation-card">

                    <div className="resignation-card-header">
                        <div>
                            <h2>Submit Resignation</h2>

                            <p>
                                Provide your resignation reason and
                                required notice period.
                            </p>
                        </div>
                    </div>


                    <form
                        className="resignation-form"
                        onSubmit={handleSubmit}
                    >

                        <div className="resignation-form-group">

                            <label htmlFor="resignation-reason">
                                Reason
                            </label>

                            <textarea
                                id="resignation-reason"
                                value={reason}
                                onChange={(event) =>
                                    setReason(event.target.value)
                                }
                                placeholder="Enter your resignation reason"
                                rows="5"
                                maxLength="1000"
                                required
                            />

                            <small>
                                {reason.length}/1000 characters
                            </small>

                        </div>


                        <div className="resignation-form-group">

                            <label htmlFor="notice-period">
                                Notice Period (Days)
                            </label>

                            <input
                                id="notice-period"
                                type="number"
                                min="1"
                                max="365"
                                value={noticePeriod}
                                onChange={(event) =>
                                    setNoticePeriod(event.target.value)
                                }
                                required
                            />

                        </div>


                        <button
                            type="submit"
                            className="resignation-submit-btn"
                            disabled={submitting}
                        >
                            {submitting
                                ? "Submitting..."
                                : "Submit Resignation"}
                        </button>

                    </form>

                </div>
            )}


            {/* =================================================
                HR / ADMIN FILTER
            ================================================= */}

            {isHROrAdmin && (
                <div className="resignation-filter-card">

                    <div>
                        <h2>Resignation Requests</h2>

                        <p>
                            Review and manage employee exit requests.
                        </p>
                    </div>

                    <div className="resignation-filter">

                        <label htmlFor="status-filter">
                            Status
                        </label>

                        <select
                            id="status-filter"
                            value={statusFilter}
                            onChange={(event) =>
                                setStatusFilter(event.target.value)
                            }
                        >
                            <option value="">
                                All Statuses
                            </option>

                            <option value="PENDING">
                                Pending
                            </option>

                            <option value="APPROVED">
                                Approved
                            </option>

                            <option value="REJECTED">
                                Rejected
                            </option>
                        </select>

                    </div>

                </div>
            )}


            {/* =================================================
                RESIGNATION LIST
            ================================================= */}

            <div className="resignation-list-card">

                <div className="resignation-list-header">

                    <div>
                        <h2>
                            {isEmployee
                                ? "My Resignation Requests"
                                : "All Resignation Requests"}
                        </h2>

                        <p>
                            Track resignation status and exit requests.
                        </p>
                    </div>

                    <div className="resignation-count">
                        {resignations.length}
                    </div>

                </div>


                {loading ? (
                    <div className="resignation-empty">
                        Loading resignation requests...
                    </div>
                ) : resignations.length === 0 ? (
                    <div className="resignation-empty">
                        No resignation requests found.
                    </div>
                ) : (
                    <div className="resignation-table-wrapper">

                        <table className="resignation-table">

                            <thead>
                                <tr>

                                    {isHROrAdmin && (
                                        <th>Employee ID</th>
                                    )}

                                    <th>Reason</th>
                                    <th>Notice Period</th>
                                    <th>Status</th>
                                    <th>Submitted</th>

                                    {isHROrAdmin && (
                                        <th>Action</th>
                                    )}

                                </tr>
                            </thead>


                            <tbody>

                                {resignations.map((resignation) => {

                                    const currentStatus =
                                        String(
                                            resignation.status || ""
                                        ).toUpperCase();

                                    const isPending =
                                        currentStatus === "PENDING";

                                    const isReviewing =
                                        reviewingId === resignation.id;

                                    return (
                                        <tr key={resignation.id}>

                                            {isHROrAdmin && (
                                                <td>
                                                    <strong>
                                                        #{resignation.employee_id}
                                                    </strong>
                                                </td>
                                            )}

                                            <td>
                                                <div className="resignation-reason">
                                                    {resignation.reason}
                                                </div>
                                            </td>

                                            <td>
                                                {resignation.notice_period} days
                                            </td>

                                            <td>
                                                <span
                                                    className={`resignation-status ${getStatusClass(
                                                        currentStatus
                                                    )}`}
                                                >
                                                    {currentStatus}
                                                </span>
                                            </td>

                                            <td>
                                                {formatDate(
                                                    resignation.created_at
                                                )}
                                            </td>

                                            {isHROrAdmin && (
                                                <td>

                                                    {isPending ? (
                                                        <div className="resignation-actions">

                                                            <button
                                                                type="button"
                                                                className="approve-btn"
                                                                disabled={isReviewing}
                                                                onClick={() =>
                                                                    handleReview(
                                                                        resignation.id,
                                                                        "APPROVED"
                                                                    )
                                                                }
                                                            >
                                                                {isReviewing
                                                                    ? "Processing..."
                                                                    : "Approve"}
                                                            </button>

                                                            <button
                                                                type="button"
                                                                className="reject-btn"
                                                                disabled={isReviewing}
                                                                onClick={() =>
                                                                    handleReview(
                                                                        resignation.id,
                                                                        "REJECTED"
                                                                    )
                                                                }
                                                            >
                                                                Reject
                                                            </button>

                                                        </div>
                                                    ) : (
                                                        <span className="reviewed-text">
                                                            Reviewed
                                                        </span>
                                                    )}

                                                </td>
                                            )}

                                        </tr>
                                    );
                                })}

                            </tbody>

                        </table>

                    </div>
                )}

            </div>

        </div>
    );
}

export default Resignation;
