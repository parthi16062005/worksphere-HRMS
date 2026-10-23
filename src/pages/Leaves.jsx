
import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../services/api";
import "../style/Leaves.css";

const initialForm = {
    leave_type: "SICK",
    start_date: "",
    end_date: "",
    reason: "",
};

const initialPolicyForm = {
    leave_type: "CASUAL",
    total_days_allowed: 12,
};

const VALID_LEAVE_STATUSES = [
    "PENDING",
    "APPROVED",
    "REJECTED",
];

const VALID_LEAVE_TYPES = [
    "SICK",
    "CASUAL",
    "PAID",
];

function formatDate(value) {
    if (!value) return "-";

    const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}

function formatDateTime(value) {
    if (!value) return "-";

    const normalizedValue =
        typeof value === "string" && !value.endsWith("Z")
            ? `${value}Z`
            : value;

    const date = new Date(normalizedValue);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function getErrorMessage(error) {
    const detail = error?.response?.data?.detail;

    if (typeof detail === "string") {
        return detail;
    }

    if (Array.isArray(detail)) {
        return detail
            .map((item) => item.msg || String(item))
            .join(", ");
    }

    return (
        error?.response?.data?.message ||
        error?.message ||
        "Something went wrong. Please try again."
    );
}

function getTodayDate() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function calculateLeaveDays(startDate, endDate) {
    if (!startDate || !endDate) {
        return 0;
    }

    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T00:00:00`);

    if (
        Number.isNaN(start.getTime()) ||
        Number.isNaN(end.getTime()) ||
        end < start
    ) {
        return 0;
    }

    return Math.floor((end - start) / 86400000) + 1;
}

function formatLeaveType(value) {
    if (!value) return "-";

    return String(value)
        .toLowerCase()
        .replace(/_/g, " ")
        .replace(/\b\w/g, (character) => character.toUpperCase());
}

function getStatusClass(status) {
    return String(status || "PENDING").toLowerCase();
}

function getStatusLabel(status) {
    return formatLeaveType(status || "PENDING");
}

function getAvailableDays(balance) {
    if (!balance || balance.remaining_days === undefined) {
        return null;
    }

    const value = Number(balance.remaining_days);

    return Number.isFinite(value) ? value : null;
}

function Leaves({ user }) {
    const isEmployee = user?.role === "EMPLOYEE";

    const isHROrAdmin =
        user?.role === "HR" || user?.role === "ADMIN";

    const [leaves, setLeaves] = useState([]);
    const [policies, setPolicies] = useState([]);
    const [balances, setBalances] = useState([]);

    const [loading, setLoading] = useState(true);
    const [balanceLoading, setBalanceLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [reviewingId, setReviewingId] = useState(null);

    const [form, setForm] = useState(initialForm);
    const [reviewComments, setReviewComments] = useState({});

    const [filterStatus, setFilterStatus] = useState("");
    const [filterEmployeeId, setFilterEmployeeId] = useState("");

    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [balanceError, setBalanceError] = useState("");

    const [policyForm, setPolicyForm] = useState(initialPolicyForm);
    const [policySubmitting, setPolicySubmitting] = useState(false);

    // -----------------------------------------------------
    // LOAD LEAVE REQUESTS
    // -----------------------------------------------------

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
                    params.employee_id = filterEmployeeId.trim();
                }

                response = await api.get("/leaves", { params });
            } else {
                setLeaves([]);
                setError(
                    "You do not have permission to view leave requests."
                );
                return;
            }

            setLeaves(
                Array.isArray(response.data)
                    ? response.data
                    : []
            );
        } catch (requestError) {
            setError(getErrorMessage(requestError));
        } finally {
            setLoading(false);
        }
    }, [
        isEmployee,
        isHROrAdmin,
        filterStatus,
        filterEmployeeId,
    ]);

    // -----------------------------------------------------
    // LOAD LEAVE POLICIES
    // -----------------------------------------------------

    const loadPolicies = useCallback(async () => {
        try {
            const response = await api.get("/leave-policies");

            const policyList = Array.isArray(response.data)
                ? response.data
                : [];

            setPolicies(policyList);

            setForm((currentForm) => {
                const currentTypeExists = policyList.some(
                    (policy) =>
                        policy.leave_type === currentForm.leave_type
                );

                if (currentTypeExists) {
                    return currentForm;
                }

                return {
                    ...currentForm,
                    leave_type: policyList[0]?.leave_type || "",
                };
            });

            setPolicyForm((currentForm) => {
                const configuredTypes = policyList.map(
                    (policy) => policy.leave_type
                );

                if (
                    !configuredTypes.includes(currentForm.leave_type)
                ) {
                    const nextType = VALID_LEAVE_TYPES.find(
                        (type) => !configuredTypes.includes(type)
                    );

                    return {
                        ...currentForm,
                        leave_type: nextType || "",
                    };
                }

                return currentForm;
            });
        } catch (requestError) {
            setError(getErrorMessage(requestError));
        }
    }, []);

    // -----------------------------------------------------
    // LOAD EMPLOYEE LEAVE BALANCES
    // -----------------------------------------------------

    const loadBalances = useCallback(async () => {
        if (!isEmployee) {
            setBalances([]);
            setBalanceError("");
            return;
        }

        setBalanceLoading(true);
        setBalanceError("");

        try {
            const response = await api.get("/leaves/my/balances");

            setBalances(
                Array.isArray(response.data)
                    ? response.data
                    : []
            );
        } catch (requestError) {
            setBalances([]);
            setBalanceError(getErrorMessage(requestError));
        } finally {
            setBalanceLoading(false);
        }
    }, [isEmployee]);

    // -----------------------------------------------------
    // REFRESH ALL PAGE DATA
    // -----------------------------------------------------

    const refreshPageData = useCallback(async () => {
        await Promise.all([
            loadLeaves(),
            loadPolicies(),
            loadBalances(),
        ]);
    }, [loadLeaves, loadPolicies, loadBalances]);

    useEffect(() => {
        refreshPageData();
    }, [refreshPageData]);

    // -----------------------------------------------------
    // PREPARE BALANCE AND POLICY LOOKUPS
    // -----------------------------------------------------

    const balanceByType = useMemo(() => {
        const lookup = {};

        balances.forEach((balance) => {
            lookup[balance.leave_type] = balance;
        });

        return lookup;
    }, [balances]);

    const policyByType = useMemo(() => {
        const lookup = {};

        policies.forEach((policy) => {
            lookup[policy.leave_type] = policy;
        });

        return lookup;
    }, [policies]);

    const configuredPolicyTypes = useMemo(
        () => policies.map((policy) => policy.leave_type),
        [policies]
    );

    const availablePolicyTypes = useMemo(
        () =>
            VALID_LEAVE_TYPES.filter(
                (type) => !configuredPolicyTypes.includes(type)
            ),
        [configuredPolicyTypes]
    );

    const selectedPolicy = policyByType[form.leave_type];
    const selectedBalance = balanceByType[form.leave_type];

    const availableDays = getAvailableDays(selectedBalance);

    const requestedDays = calculateLeaveDays(
        form.start_date,
        form.end_date
    );

    const isDateRangeValid =
        Boolean(form.start_date) &&
        Boolean(form.end_date) &&
        form.end_date >= form.start_date &&
        form.start_date >= getTodayDate();

    const hasSelectedPolicy = Boolean(selectedPolicy);
    const hasKnownBalance = availableDays !== null;

    const hasEnoughBalance =
        hasKnownBalance &&
        requestedDays > 0 &&
        requestedDays <= availableDays;

    // -----------------------------------------------------
    // LEAVE STATISTICS
    // -----------------------------------------------------

    const stats = useMemo(() => {
        const total = leaves.length;

        const pending = leaves.filter(
            (leave) => leave.status === "PENDING"
        ).length;

        const approved = leaves.filter(
            (leave) => leave.status === "APPROVED"
        ).length;

        const rejected = leaves.filter(
            (leave) => leave.status === "REJECTED"
        ).length;

        return {
            total,
            pending,
            approved,
            rejected,
        };
    }, [leaves]);

    // -----------------------------------------------------
    // HANDLE LEAVE APPLICATION FORM CHANGES
    // -----------------------------------------------------

    const handleFormChange = (event) => {
        const { name, value } = event.target;

        setForm((currentForm) => ({
            ...currentForm,
            [name]: value,
        }));

        setError("");
        setMessage("");
    };

    // -----------------------------------------------------
    // APPLY FOR LEAVE
    // -----------------------------------------------------

    const handleApplyLeave = async (event) => {
        event.preventDefault();

        setError("");
        setMessage("");

        if (!form.leave_type || !selectedPolicy) {
            setError(
                "This leave type has no configured policy. Please contact HR."
            );
            return;
        }

        if (!form.start_date || !form.end_date) {
            setError("Please select both start and end dates.");
            return;
        }

        if (form.start_date < getTodayDate()) {
            setError("You cannot apply for leave on a past date.");
            return;
        }

        if (form.end_date < form.start_date) {
            setError(
                "The end date must be on or after the start date."
            );
            return;
        }

        if (!form.reason.trim() || form.reason.trim().length < 5) {
            setError(
                "Please enter a reason containing at least 5 characters."
            );
            return;
        }

        if (availableDays === null) {
            setError(
                `Your ${formatLeaveType(form.leave_type)} balance is not initialized. Please contact HR before applying.`
            );
            return;
        }

        if (requestedDays > availableDays) {
            setError(
                `You requested ${requestedDays} days, but only ${availableDays} days are available for ${formatLeaveType(form.leave_type)} leave.`
            );
            return;
        }

        if (requestedDays < 1) {
            setError("Please select a valid leave date range.");
            return;
        }

        setSubmitting(true);

        try {
            await api.post("/leaves", {
                leave_type: form.leave_type,
                start_date: form.start_date,
                end_date: form.end_date,
                reason: form.reason.trim(),
            });

            setMessage(
                "Leave application submitted successfully. It is awaiting review."
            );

            setForm({
                ...initialForm,
                leave_type: policies.some(
                    (policy) => policy.leave_type === form.leave_type
                )
                    ? form.leave_type
                    : policies[0]?.leave_type || "",
            });

            await Promise.all([
                loadLeaves(),
                loadBalances(),
            ]);
        } catch (requestError) {
            setError(getErrorMessage(requestError));
        } finally {
            setSubmitting(false);
        }
    };

    // -----------------------------------------------------
    // CREATE LEAVE POLICY - HR / ADMIN
    // -----------------------------------------------------

    const handleCreatePolicy = async (event) => {
        event.preventDefault();

        setError("");
        setMessage("");

        if (!isHROrAdmin) {
            setError(
                "Only HR and Admin users can create leave policies."
            );
            return;
        }

        if (
            !VALID_LEAVE_TYPES.includes(policyForm.leave_type) ||
            configuredPolicyTypes.includes(policyForm.leave_type)
        ) {
            setError(
                "Please select a leave type that has not already been configured."
            );
            return;
        }

        const totalDays = Number(policyForm.total_days_allowed);

        if (
            !Number.isInteger(totalDays) ||
            totalDays < 0 ||
            totalDays > 365
        ) {
            setError(
                "Allowed days must be a whole number between 0 and 365."
            );
            return;
        }

        setPolicySubmitting(true);

        try {
            const response = await api.post("/leave-policies", {
                leave_type: policyForm.leave_type,
                total_days_allowed: totalDays,
            });

            const createdType =
                response.data?.leave_type || policyForm.leave_type;

            setMessage(
                `${formatLeaveType(createdType)} leave policy created successfully. Employee balances have been initialized where needed.`
            );

            const nextType = VALID_LEAVE_TYPES.find(
                (type) =>
                    type !== createdType &&
                    !configuredPolicyTypes.includes(type)
            );

            setPolicyForm({
                leave_type: nextType || "",
                total_days_allowed: 12,
            });

            await Promise.all([
                loadPolicies(),
                loadLeaves(),
            ]);
        } catch (requestError) {
            setError(getErrorMessage(requestError));
        } finally {
            setPolicySubmitting(false);
        }
    };

    // -----------------------------------------------------
    // HANDLE POLICY FORM CHANGES
    // -----------------------------------------------------

    const handlePolicyFormChange = (event) => {
        const { name, value } = event.target;

        setPolicyForm((currentForm) => ({
            ...currentForm,
            [name]: value,
        }));

        setError("");
        setMessage("");
    };

    // -----------------------------------------------------
    // APPROVE OR REJECT LEAVE
    // -----------------------------------------------------

    const handleReview = async (leaveId, status) => {
        const comment = reviewComments[leaveId] || "";

        const actionLabel =
            status === "APPROVED" ? "approve" : "reject";

        const confirmed = window.confirm(
            `Are you sure you want to ${actionLabel} this leave request?`
        );

        if (!confirmed) {
            return;
        }

        setError("");
        setMessage("");
        setReviewingId(leaveId);

        try {
            await api.patch(`/leaves/${leaveId}/review`, {
                status,
                review_comment: comment.trim() || null,
            });

            setMessage(
                `Leave request #${leaveId} ${status.toLowerCase()} successfully.`
            );

            setReviewComments((currentComments) => {
                const updatedComments = { ...currentComments };
                delete updatedComments[leaveId];
                return updatedComments;
            });

            await loadLeaves();

            if (isEmployee) {
                await loadBalances();
            }
        } catch (requestError) {
            setError(getErrorMessage(requestError));
        } finally {
            setReviewingId(null);
        }
    };

    // -----------------------------------------------------
    // REFRESH BUTTON
    // -----------------------------------------------------

    const handleRefresh = async () => {
        setMessage("");
        setError("");

        await refreshPageData();
    };

    // -----------------------------------------------------
    // PAGE UI
    // -----------------------------------------------------

    return (
        <div className="ws-leaves-page">
            <div className="ws-leaves-header">
                <div>
                    <h1>Leave Management</h1>
                    <p>
                        {isEmployee
                            ? "Apply for leave and keep track of your leave balance."
                            : "Review employee leave requests and manage leave policies."}
                    </p>
                </div>

                <button
                    type="button"
                    className="ws-leaves-primary-button"
                    onClick={handleRefresh}
                    disabled={loading || balanceLoading}
                >
                    Refresh
                </button>
            </div>

            {error && (
                <div
                    className="ws-leaves-alert ws-leaves-alert-error"
                    role="alert"
                >
                    {error}
                </div>
            )}

            {message && (
                <div
                    className="ws-leaves-alert ws-leaves-alert-success"
                    role="status"
                >
                    {message}
                </div>
            )}

            {/* EMPLOYEE LEAVE BALANCES */}

            {isEmployee && (
                <section className="ws-leaves-panel">
                    <div className="ws-leaves-section-heading">
                        <div>
                            <h2>My Leave Balances</h2>
                            <p>
                                Your balance is deducted when a leave request is approved.
                            </p>
                        </div>
                    </div>

                    {balanceError && (
                        <div
                            className="ws-leaves-alert ws-leaves-alert-error"
                            role="alert"
                        >
                            {balanceError}
                        </div>
                    )}

                    {balanceLoading ? (
                        <p className="ws-leaves-empty">
                            Loading leave balances...
                        </p>
                    ) : policies.length === 0 ? (
                        <p className="ws-leaves-empty">
                            No leave policies have been configured yet. Please contact HR.
                        </p>
                    ) : (
                        <div className="ws-leaves-balance-grid">
                            {policies.map((policy) => {
                                const balance =
                                    balanceByType[policy.leave_type];

                                const remaining =
                                    getAvailableDays(balance);

                                const total = Number(
                                    policy.total_days_allowed
                                );

                                const used =
                                    remaining === null
                                        ? null
                                        : Math.max(0, total - remaining);

                                return (
                                    <article
                                        className="ws-leaves-balance-card"
                                        key={policy.id || policy.leave_type}
                                    >
                                        <div className="ws-leaves-balance-card-top">
                                            <span className="ws-leaves-balance-label">
                                                {formatLeaveType(
                                                    policy.leave_type
                                                )}
                                            </span>

                                            <span className="ws-leaves-balance-icon">
                                                {policy.leave_type === "SICK"
                                                    ? "S"
                                                    : policy.leave_type === "CASUAL"
                                                      ? "C"
                                                      : "P"}
                                            </span>
                                        </div>

                                        <div className="ws-leaves-balance-total">
                                            {Number.isFinite(total)
                                                ? total
                                                : "-"}
                                            <span> total days</span>
                                        </div>

                                        <div className="ws-leaves-balance-details">
                                            <div>
                                                <span>Used</span>
                                                <strong>
                                                    {used === null ? "-" : used}
                                                </strong>
                                            </div>

                                            <div>
                                                <span>Remaining</span>
                                                <strong>
                                                    {remaining === null
                                                        ? "Not initialized"
                                                        : remaining}
                                                </strong>
                                            </div>
                                        </div>

                                        {remaining === null && (
                                            <p className="ws-leaves-balance-note">
                                                Your balance has not been initialized. Contact HR.
                                            </p>
                                        )}
                                    </article>
                                );
                            })}
                        </div>
                    )}
                </section>
            )}

            {/* LEAVE STATISTICS */}

            <section className="ws-leaves-stats">
                <div className="ws-leaves-stat-card">
                    <span>Total Requests</span>
                    <strong>{stats.total}</strong>
                </div>

                <div className="ws-leaves-stat-card">
                    <span>Pending</span>
                    <strong>{stats.pending}</strong>
                </div>

                <div className="ws-leaves-stat-card">
                    <span>Approved</span>
                    <strong>{stats.approved}</strong>
                </div>

                <div className="ws-leaves-stat-card">
                    <span>Rejected</span>
                    <strong>{stats.rejected}</strong>
                </div>
            </section>

            {/* HR / ADMIN POLICY MANAGEMENT */}

            {isHROrAdmin && (
                <section className="ws-leaves-panel">
                    <div className="ws-leaves-section-heading">
                        <div>
                            <h2>Leave Policy Management</h2>
                            <p>
                                Configure leave allowances for employees.
                                New policies initialize balances for employees who do not already have one.
                            </p>
                        </div>
                    </div>

                    <div className="ws-leaves-policy-list">
                        <h3>Configured Policies</h3>

                        {policies.length === 0 ? (
                            <p className="ws-leaves-empty">
                                No leave policies have been configured yet.
                            </p>
                        ) : (
                            <div className="ws-leaves-table-wrapper">
                                <table className="ws-leaves-table">
                                    <thead>
                                        <tr>
                                            <th>Policy ID</th>
                                            <th>Leave Type</th>
                                            <th>Allowed Days</th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {policies.map((policy) => (
                                            <tr
                                                key={
                                                    policy.id ||
                                                    policy.leave_type
                                                }
                                            >
                                                <td>
                                                    {policy.id ?? "-"}
                                                </td>
                                                <td>
                                                    {formatLeaveType(
                                                        policy.leave_type
                                                    )}
                                                </td>
                                                <td>
                                                    {policy.total_days_allowed}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    <div className="ws-leaves-policy-create">
                        <h3>Create Leave Policy</h3>

                        {availablePolicyTypes.length === 0 ? (
                            <p className="ws-leaves-empty">
                                All supported leave policies (SICK, CASUAL, and PAID) have already been configured.
                            </p>
                        ) : (
                            <form onSubmit={handleCreatePolicy}>
                                <div className="ws-leaves-form-grid">
                                    <div className="ws-leaves-field">
                                        <label htmlFor="policy_leave_type">
                                            Leave Type
                                        </label>

                                        <select
                                            id="policy_leave_type"
                                            name="leave_type"
                                            value={policyForm.leave_type}
                                            onChange={handlePolicyFormChange}
                                            required
                                            disabled={policySubmitting}
                                        >
                                            {availablePolicyTypes.map(
                                                (type) => (
                                                    <option
                                                        key={type}
                                                        value={type}
                                                    >
                                                        {formatLeaveType(type)}
                                                    </option>
                                                )
                                            )}
                                        </select>
                                    </div>

                                    <div className="ws-leaves-field">
                                        <label htmlFor="total_days_allowed">
                                            Total Days Allowed
                                        </label>

                                        <input
                                            id="total_days_allowed"
                                            name="total_days_allowed"
                                            type="number"
                                            min="0"
                                            max="365"
                                            step="1"
                                            value={
                                                policyForm.total_days_allowed
                                            }
                                            onChange={handlePolicyFormChange}
                                            required
                                            disabled={policySubmitting}
                                        />

                                        <small>
                                            Enter a whole number from 0 to 365.
                                        </small>
                                    </div>
                                </div>

                                <div className="ws-leaves-form-footer">
                                    <button
                                        type="submit"
                                        className="ws-leaves-primary-button"
                                        disabled={
                                            policySubmitting ||
                                            availablePolicyTypes.length === 0 ||
                                            !policyForm.leave_type
                                        }
                                    >
                                        {policySubmitting
                                            ? "Creating Policy..."
                                            : "Create Leave Policy"}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </section>
            )}

            {/* EMPLOYEE APPLY FOR LEAVE */}

            {isEmployee && (
                <section className="ws-leaves-panel">
                    <div className="ws-leaves-section-heading">
                        <div>
                            <h2>Apply for Leave</h2>
                            <p>
                                Complete the form to submit a leave request.
                            </p>
                        </div>
                    </div>

                    <form onSubmit={handleApplyLeave}>
                        <div className="ws-leaves-form-grid">
                            <div className="ws-leaves-field">
                                <label htmlFor="leave_type">
                                    Leave Type
                                </label>

                                <select
                                    id="leave_type"
                                    name="leave_type"
                                    value={form.leave_type}
                                    onChange={handleFormChange}
                                    required
                                    disabled={
                                        submitting || policies.length === 0
                                    }
                                >
                                    {policies.length === 0 && (
                                        <option value="">
                                            No policies configured
                                        </option>
                                    )}

                                    {policies.map((policy) => (
                                        <option
                                            key={
                                                policy.id ||
                                                policy.leave_type
                                            }
                                            value={policy.leave_type}
                                        >
                                            {formatLeaveType(
                                                policy.leave_type
                                            )}
                                        </option>
                                    ))}
                                </select>

                                {selectedPolicy && (
                                    <small>
                                        Policy allowance:{" "}
                                        {selectedPolicy.total_days_allowed} days
                                    </small>
                                )}
                            </div>

                            <div className="ws-leaves-field">
                                <label htmlFor="start_date">
                                    Start Date
                                </label>

                                <input
                                    id="start_date"
                                    type="date"
                                    name="start_date"
                                    value={form.start_date}
                                    onChange={handleFormChange}
                                    min={getTodayDate()}
                                    required
                                    disabled={submitting}
                                />
                            </div>

                            <div className="ws-leaves-field">
                                <label htmlFor="end_date">
                                    End Date
                                </label>

                                <input
                                    id="end_date"
                                    type="date"
                                    name="end_date"
                                    value={form.end_date}
                                    onChange={handleFormChange}
                                    min={
                                        form.start_date || getTodayDate()
                                    }
                                    required
                                    disabled={submitting}
                                />
                            </div>

                            <div className="ws-leaves-field ws-leaves-reason-field">
                                <label htmlFor="reason">
                                    Reason
                                </label>

                                <textarea
                                    id="reason"
                                    name="reason"
                                    value={form.reason}
                                    onChange={handleFormChange}
                                    placeholder="Explain why you need leave..."
                                    minLength={5}
                                    rows={4}
                                    required
                                    disabled={submitting}
                                />
                            </div>
                        </div>

                        {form.start_date && form.end_date && (
                            <div className="ws-leaves-balance-hint">
                                <strong>Requested duration:</strong>{" "}
                                {requestedDays}{" "}
                                {requestedDays === 1 ? "day" : "days"}

                                {availableDays !== null && (
                                    <>
                                        {" "}
                                        | <strong>Available:</strong>{" "}
                                        {availableDays}{" "}
                                        {availableDays === 1 ? "day" : "days"}
                                    </>
                                )}
                            </div>
                        )}

                        {isDateRangeValid &&
                            requestedDays > 0 &&
                            availableDays !== null &&
                            !hasEnoughBalance && (
                                <div
                                    className="ws-leaves-alert ws-leaves-alert-error"
                                    role="alert"
                                >
                                    Your selected dates exceed the available{" "}
                                    {formatLeaveType(form.leave_type)} leave balance.
                                </div>
                            )}

                        {!hasKnownBalance &&
                            hasSelectedPolicy &&
                            !balanceLoading && (
                                <div className="ws-leaves-balance-hint">
                                    Your balance for this leave type is not initialized.
                                    You cannot apply until HR initializes it.
                                </div>
                            )}

                        <div className="ws-leaves-form-footer">
                            <button
                                type="submit"
                                className="ws-leaves-primary-button"
                                disabled={
                                    submitting ||
                                    policies.length === 0 ||
                                    balanceLoading ||
                                    !hasKnownBalance ||
                                    !hasEnoughBalance ||
                                    !isDateRangeValid ||
                                    form.reason.trim().length < 5
                                }
                            >
                                {submitting
                                    ? "Submitting..."
                                    : "Submit Leave Request"}
                            </button>
                        </div>
                    </form>
                </section>
            )}

            {/* LEAVE REQUESTS TABLE */}

            <section className="ws-leaves-panel">
                <div className="ws-leaves-section-heading">
                    <div>
                        <h2>
                            {isEmployee
                                ? "My Leave Requests"
                                : "Employee Leave Requests"}
                        </h2>

                        <p>
                            Review leave request details and their current status.
                        </p>
                    </div>
                </div>

                {isHROrAdmin && (
                    <div className="ws-leaves-filters">
                        <div className="ws-leaves-field">
                            <label htmlFor="filterStatus">
                                Filter by Status
                            </label>

                            <select
                                id="filterStatus"
                                value={filterStatus}
                                onChange={(event) =>
                                    setFilterStatus(event.target.value)
                                }
                            >
                                <option value="">All Statuses</option>

                                {VALID_LEAVE_STATUSES.map((status) => (
                                    <option key={status} value={status}>
                                        {getStatusLabel(status)}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="ws-leaves-field">
                            <label htmlFor="filterEmployeeId">
                                Employee ID
                            </label>

                            <input
                                id="filterEmployeeId"
                                type="number"
                                min="1"
                                value={filterEmployeeId}
                                onChange={(event) =>
                                    setFilterEmployeeId(event.target.value)
                                }
                                placeholder="Enter employee ID"
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

                        <button
                            type="button"
                            className="ws-leaves-secondary-button"
                            onClick={() => {
                                setFilterStatus("");
                                setFilterEmployeeId("");
                            }}
                        >
                            Clear Filters
                        </button>
                    </div>
                )}

                {loading ? (
                    <p className="ws-leaves-empty">
                        Loading leave requests...
                    </p>
                ) : leaves.length === 0 ? (
                    <p className="ws-leaves-empty">
                        No leave requests found.
                    </p>
                ) : (
                    <div className="ws-leaves-table-wrapper">
                        <table className="ws-leaves-table">
                            <thead>
                                <tr>
                                    <th>ID</th>

                                    {isHROrAdmin && (
                                        <th>Employee ID</th>
                                    )}

                                    <th>Leave Type</th>
                                    <th>Start Date</th>
                                    <th>End Date</th>
                                    <th>Days</th>
                                    <th>Reason</th>
                                    <th>Applied On</th>
                                    <th>Status</th>
                                    <th>Review Details</th>

                                    {isHROrAdmin && (
                                        <th>Actions</th>
                                    )}
                                </tr>
                            </thead>

                            <tbody>
                                {leaves.map((leave) => {
                                    const days = calculateLeaveDays(
                                        leave.start_date,
                                        leave.end_date
                                    );

                                    const isPending =
                                        leave.status === "PENDING";

                                    return (
                                        <tr key={leave.id}>
                                            <td>#{leave.id}</td>

                                            {isHROrAdmin && (
                                                <td>
                                                    {leave.employee_id ?? "-"}
                                                </td>
                                            )}

                                            <td>
                                                {formatLeaveType(
                                                    leave.leave_type
                                                )}
                                            </td>

                                            <td>
                                                {formatDate(leave.start_date)}
                                            </td>

                                            <td>
                                                {formatDate(leave.end_date)}
                                            </td>

                                            <td>{days || "-"}</td>

                                            <td className="ws-leaves-reason-cell">
                                                {leave.reason || "-"}
                                            </td>

                                            <td>
                                                {formatDateTime(
                                                    leave.applied_at
                                                )}
                                            </td>

                                            <td>
                                                <span
                                                    className={`ws-leaves-status ${getStatusClass(
                                                        leave.status
                                                    )}`}
                                                >
                                                    {getStatusLabel(
                                                        leave.status
                                                    )}
                                                </span>
                                            </td>

                                            <td>
                                                {leave.review_comment && (
                                                    <div>
                                                        <strong>Comment:</strong>{" "}
                                                        {leave.review_comment}
                                                    </div>
                                                )}

                                                {leave.reviewed_at && (
                                                    <div>
                                                        <strong>Reviewed:</strong>{" "}
                                                        {formatDateTime(
                                                            leave.reviewed_at
                                                        )}
                                                    </div>
                                                )}

                                                {!leave.review_comment &&
                                                    !leave.reviewed_at &&
                                                    "-"}
                                            </td>

                                            {isHROrAdmin && (
                                                <td>
                                                    {isPending ? (
                                                        <div className="ws-leaves-review-actions">
                                                            <textarea
                                                                aria-label={`Review comment for leave ${leave.id}`}
                                                                placeholder="Optional review comment"
                                                                rows={2}
                                                                value={
                                                                    reviewComments[
                                                                        leave.id
                                                                    ] || ""
                                                                }
                                                                onChange={(
                                                                    event
                                                                ) =>
                                                                    setReviewComments(
                                                                        (
                                                                            currentComments
                                                                        ) => ({
                                                                            ...currentComments,
                                                                            [leave.id]:
                                                                                event
                                                                                    .target
                                                                                    .value,
                                                                        })
                                                                    )
                                                                }
                                                                disabled={
                                                                    reviewingId ===
                                                                    leave.id
                                                                }
                                                            />

                                                            <button
                                                                type="button"
                                                                className="ws-leaves-approve-button"
                                                                onClick={() =>
                                                                    handleReview(
                                                                        leave.id,
                                                                        "APPROVED"
                                                                    )
                                                                }
                                                                disabled={
                                                                    reviewingId ===
                                                                    leave.id
                                                                }
                                                            >
                                                                {reviewingId ===
                                                                leave.id
                                                                    ? "Processing..."
                                                                    : "Approve"}
                                                            </button>

                                                            <button
                                                                type="button"
                                                                className="ws-leaves-reject-button"
                                                                onClick={() =>
                                                                    handleReview(
                                                                        leave.id,
                                                                        "REJECTED"
                                                                    )
                                                                }
                                                                disabled={
                                                                    reviewingId ===
                                                                    leave.id
                                                                }
                                                            >
                                                                Reject
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        "-"
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
            </section>
        </div>
    );
}

export default Leaves;
