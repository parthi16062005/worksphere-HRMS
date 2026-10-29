
import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import "../style/Performance.css";

const API_BASE_URL = "http://127.0.0.1:8000";

function Performance({ user }) {
    const [reviews, setReviews] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [search, setSearch] = useState("");
    const [periodFilter, setPeriodFilter] = useState("");
    const [ratingFilter, setRatingFilter] = useState("ALL");
    const [showForm, setShowForm] = useState(false);

    const role = String(user?.role || "").toUpperCase();
    const isAdminOrHR = role === "ADMIN" || role === "HR";

    const [form, setForm] = useState({
        employee_id: "",
        review_period: new Date().toLocaleString("en-US", {
            month: "long",
            year: "numeric",
        }),
        rating: "5",
        feedback: "",
    });

    const api = axios.create({
        baseURL: API_BASE_URL,
        headers: {
            Authorization: `Bearer ${localStorage.getItem("worksphere_token")}`,
        },
    });

    const loadReviews = useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            const response = await api.get("/performance");
            const data = response.data;

            setReviews(Array.isArray(data) ? data : []);
        } catch (err) {
            setError(
                err.response?.data?.detail ||
                "Unable to load performance reviews."
            );
        } finally {
            setLoading(false);
        }
    }, [user?.id]);

    const loadEmployees = useCallback(async () => {
        if (!isAdminOrHR) return;

        try {
            const response = await api.get("/employees");
            const data = response.data;

            const employeeList = Array.isArray(data)
                ? data
                : Array.isArray(data?.employees)
                    ? data.employees
                    : [];

            setEmployees(employeeList);
        } catch (err) {
            console.error(
                "Unable to load employees:",
                err.response?.data?.detail || err.message
            );
        }
    }, [isAdminOrHR, user?.id]);

    useEffect(() => {
        loadReviews();
        loadEmployees();
    }, [loadReviews, loadEmployees]);

    const handleFormChange = (event) => {
        const { name, value } = event.target;

        setForm((previous) => ({
            ...previous,
            [name]: value,
        }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        setError("");
        setSuccess("");

        if (!form.employee_id) {
            setError("Please select an employee.");
            return;
        }

        if (form.feedback.trim().length < 3) {
            setError("Feedback must contain at least 3 characters.");
            return;
        }

        setSaving(true);

        try {
            await api.post("/performance", {
                employee_id: Number(form.employee_id),
                review_period: form.review_period.trim(),
                rating: Number(form.rating),
                feedback: form.feedback.trim(),
            });

            setSuccess("Performance review created successfully.");

            setForm((previous) => ({
                ...previous,
                feedback: "",
                rating: "5",
            }));

            setShowForm(false);

            await loadReviews();
        } catch (err) {
            setError(
                err.response?.data?.detail ||
                "Unable to create the performance review."
            );
        } finally {
            setSaving(false);
        }
    };

    const getEmployeeName = (employeeId) => {
        const employee = employees.find(
            (item) => item.id === employeeId
        );

        return (
            employee?.full_name ||
            employee?.name ||
            employee?.employee_code ||
            `Employee #${employeeId}`
        );
    };

    const filteredReviews = reviews.filter((review) => {
        const matchesSearch =
            `${getEmployeeName(review.employee_id)} ${review.feedback} ${review.review_period}`
                .toLowerCase()
                .includes(search.toLowerCase());

        const matchesPeriod = periodFilter
            ? review.review_period
                .toLowerCase()
                .includes(periodFilter.toLowerCase())
            : true;

        const matchesRating =
            ratingFilter === "ALL" ||
            String(review.rating) === ratingFilter;

        return matchesSearch && matchesPeriod && matchesRating;
    });

    const averageRating = reviews.length
        ? (
            reviews.reduce(
                (total, review) => total + Number(review.rating || 0),
                0
            ) / reviews.length
        ).toFixed(1)
        : "0.0";

    const highRatings = reviews.filter(
        (review) => Number(review.rating) >= 4
    ).length;

    const renderStars = (rating) => (
        <span
            className="performance-stars"
            aria-label={`${rating} out of 5 stars`}
        >
            {"★".repeat(Number(rating))}
            <span className="performance-empty-stars">
                {"★".repeat(5 - Number(rating))}
            </span>
        </span>
    );

    return (
        <section className="performance-page">
            <div className="performance-heading">
                <div>
                    <p className="performance-eyebrow">
                        WORKFORCE DEVELOPMENT
                    </p>

                    <h2>Performance Management</h2>

                    <p className="performance-subtitle">
                        Review employee progress, ratings, and feedback history.
                    </p>
                </div>

                {isAdminOrHR && (
                    <button
                        type="button"
                        className="performance-primary-button"
                        onClick={() => {
                            setShowForm((previous) => !previous);
                            setError("");
                            setSuccess("");
                        }}
                    >
                        {showForm ? "Cancel Review" : "+ Create Review"}
                    </button>
                )}
            </div>

            {error && (
                <div className="performance-alert performance-alert-error">
                    {String(error)}
                </div>
            )}

            {success && (
                <div className="performance-alert performance-alert-success">
                    {success}
                </div>
            )}

            <div className="performance-stat-grid">
                <article className="performance-stat-card">
                    <span>Total Reviews</span>
                    <strong>{reviews.length}</strong>
                    <small>Available review records</small>
                </article>

                <article className="performance-stat-card">
                    <span>Average Rating</span>
                    <strong>{averageRating}<small> / 5</small></strong>
                    <small>Across visible reviews</small>
                </article>

                <article className="performance-stat-card">
                    <span>High Ratings</span>
                    <strong>{highRatings}</strong>
                    <small>Reviews rated 4 or 5</small>
                </article>
            </div>

            {showForm && isAdminOrHR && (
                <form
                    className="performance-form-card"
                    onSubmit={handleSubmit}
                >
                    <div className="performance-section-heading">
                        <h3>Create Performance Review</h3>
                        <p>Enter the review details below.</p>
                    </div>

                    <div className="performance-form-grid">
                        <label>
                            Employee
                            <select
                                name="employee_id"
                                value={form.employee_id}
                                onChange={handleFormChange}
                                required
                            >
                                <option value="">Select employee</option>

                                {employees.map((employee) => (
                                    <option
                                        key={employee.id}
                                        value={employee.id}
                                    >
                                        {employee.full_name ||
                                            employee.name ||
                                            employee.employee_code ||
                                            `Employee #${employee.id}`}
                                        {employee.employee_code
                                            ? ` (${employee.employee_code})`
                                            : ""}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label>
                            Review Period
                            <input
                                type="text"
                                name="review_period"
                                value={form.review_period}
                                onChange={handleFormChange}
                                placeholder="October 2026"
                                minLength={2}
                                maxLength={100}
                                required
                            />
                        </label>

                        <label>
                            Performance Rating
                            <select
                                name="rating"
                                value={form.rating}
                                onChange={handleFormChange}
                                required
                            >
                                <option value="5">5 - Outstanding</option>
                                <option value="4">4 - Exceeds Expectations</option>
                                <option value="3">3 - Meets Expectations</option>
                                <option value="2">2 - Needs Improvement</option>
                                <option value="1">1 - Unsatisfactory</option>
                            </select>
                        </label>

                        <label className="performance-feedback-field">
                            Feedback
                            <textarea
                                name="feedback"
                                value={form.feedback}
                                onChange={handleFormChange}
                                placeholder="Describe achievements, strengths, and areas for improvement..."
                                minLength={3}
                                maxLength={5000}
                                rows={4}
                                required
                            />
                        </label>
                    </div>

                    <div className="performance-form-actions">
                        <button
                            type="submit"
                            className="performance-primary-button"
                            disabled={saving}
                        >
                            {saving ? "Saving..." : "Save Review"}
                        </button>
                    </div>
                </form>
            )}

            <div className="performance-review-panel">
                <div className="performance-section-heading">
                    <div>
                        <h3>Review History</h3>
                        <p>
                            {isAdminOrHR
                                ? "Performance reviews across your organization."
                                : "Your performance review history."}
                        </p>
                    </div>

                    <button
                        type="button"
                        className="performance-refresh-button"
                        onClick={loadReviews}
                        disabled={loading}
                    >
                        {loading ? "Loading..." : "Refresh"}
                    </button>
                </div>

                <div className="performance-filters">
                    <input
                        type="search"
                        placeholder="Search reviews or feedback..."
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                    />

                    <input
                        type="text"
                        placeholder="Filter by review period"
                        value={periodFilter}
                        onChange={(event) => setPeriodFilter(event.target.value)}
                    />

                    <select
                        value={ratingFilter}
                        onChange={(event) => setRatingFilter(event.target.value)}
                    >
                        <option value="ALL">All ratings</option>
                        <option value="5">5 stars</option>
                        <option value="4">4 stars</option>
                        <option value="3">3 stars</option>
                        <option value="2">2 stars</option>
                        <option value="1">1 star</option>
                    </select>
                </div>

                {loading ? (
                    <div className="performance-empty-state">
                        Loading performance reviews...
                    </div>
                ) : filteredReviews.length === 0 ? (
                    <div className="performance-empty-state">
                        <h4>No performance reviews found</h4>
                        <p>
                            Reviews will appear here once they are available.
                        </p>
                    </div>
                ) : (
                    <div className="performance-review-list">
                        {filteredReviews.map((review) => (
                            <article
                                className="performance-review-card"
                                key={review.id}
                            >
                                <div className="performance-review-top">
                                    <div>
                                        <h4>
                                            {isAdminOrHR
                                                ? getEmployeeName(review.employee_id)
                                                : "Your Performance Review"}
                                        </h4>

                                        <p>{review.review_period}</p>
                                    </div>

                                    <div className="performance-rating">
                                        {renderStars(review.rating)}
                                        <strong>
                                            {review.rating}/5
                                        </strong>
                                    </div>
                                </div>

                                <div className="performance-feedback">
                                    <span>REVIEW FEEDBACK</span>
                                    <p>{review.feedback}</p>
                                </div>

                                <div className="performance-review-footer">
                                    <span>
                                        Review #{review.id}
                                    </span>

                                    <span>
                                        Created{" "}
                                        {review.created_at
                                            ? new Date(
                                                review.created_at
                                            ).toLocaleDateString()
                                            : "—"}
                                    </span>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}

export default Performance;
