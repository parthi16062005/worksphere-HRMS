import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import "../style/Feedback.css";

const API_URL = "http://127.0.0.1:8000";

const CATEGORIES = [
    "GENERAL",
    "WORKPLACE",
    "MANAGEMENT",
    "TEAMWORK",
    "SUGGESTION",
];

function Feedback({ user }) {
    const role = String(user?.role || "").toUpperCase();
    const isHROrAdmin = ["HR", "ADMIN"].includes(role);

    const [feedbackList, setFeedbackList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [reviewingId, setReviewingId] = useState(null);

    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const [filters, setFilters] = useState({
        status: "",
        category: "",
        rating: "",
    });

    const [form, setForm] = useState({
        category: "GENERAL",
        rating: 5,
        message: "",
    });

    const [reviewForms, setReviewForms] = useState({});

    const getHeaders = () => {
        const token = localStorage.getItem("worksphere_token");

        return {
            Authorization: `Bearer ${token}`,
        };
    };

    const fetchFeedback = useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            let response;

            if (isHROrAdmin) {
                const params = {};

                if (filters.status) {
                    params.status = filters.status;
                }

                if (filters.category) {
                    params.category = filters.category;
                }

                if (filters.rating) {
                    params.rating = Number(filters.rating);
                }

                response = await axios.get(`${API_URL}/feedback`, {
                    headers: getHeaders(),
                    params,
                });
            } else {
                response = await axios.get(`${API_URL}/feedback/my`, {
                    headers: getHeaders(),
                });
            }

            setFeedbackList(
                Array.isArray(response.data) ? response.data : []
            );
        } catch (err) {
            setError(
                err.response?.data?.detail ||
                    "Unable to load feedback. Please try again."
            );
        } finally {
            setLoading(false);
        }
    }, [
        isHROrAdmin,
        filters.status,
        filters.category,
        filters.rating,
    ]);

    useEffect(() => {
        fetchFeedback();
    }, [fetchFeedback]);

    const handleFormChange = (event) => {
        const { name, value } = event.target;

        setForm((previous) => ({
            ...previous,
            [name]: name === "rating" ? Number(value) : value,
        }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        setError("");
        setSuccess("");

        const message = form.message.trim();

        if (message.length < 5) {
            setError("Please enter at least 5 characters.");
            return;
        }

        if (message.length > 2000) {
            setError("Feedback cannot exceed 2000 characters.");
            return;
        }

        setSubmitting(true);

        try {
            await axios.post(
                `${API_URL}/feedback`,
                {
                    category: form.category,
                    rating: form.rating,
                    message,
                },
                {
                    headers: getHeaders(),
                }
            );

            setForm({
                category: "GENERAL",
                rating: 5,
                message: "",
            });

            setSuccess("Your feedback was submitted successfully.");

            await fetchFeedback();
        } catch (err) {
            setError(
                err.response?.data?.detail ||
                    "Unable to submit feedback."
            );
        } finally {
            setSubmitting(false);
        }
    };

    const handleReviewChange = (feedbackId, field, value) => {
        setReviewForms((previous) => ({
            ...previous,
            [feedbackId]: {
                status: "REVIEWED",
                review_comment: "",
                ...previous[feedbackId],
                [field]: value,
            },
        }));
    };

    const handleReview = async (feedbackId) => {
        const review = reviewForms[feedbackId] || {
            status: "REVIEWED",
            review_comment: "",
        };

        setError("");
        setSuccess("");
        setReviewingId(feedbackId);

        try {
            await axios.patch(
                `${API_URL}/feedback/${feedbackId}/review`,
                {
                    status: review.status,
                    review_comment:
                        review.review_comment.trim() || null,
                },
                {
                    headers: getHeaders(),
                }
            );

            setSuccess(`Feedback #${feedbackId} updated successfully.`);

            setReviewForms((previous) => ({
                ...previous,
                [feedbackId]: {
                    status: "REVIEWED",
                    review_comment: "",
                },
            }));

            await fetchFeedback();
        } catch (err) {
            setError(
                err.response?.data?.detail ||
                    "Unable to update this feedback."
            );
        } finally {
            setReviewingId(null);
        }
    };

    const getStatusClass = (status) => {
        switch (status) {
            case "SUBMITTED":
                return "feedback-status-submitted";

            case "REVIEWED":
                return "feedback-status-reviewed";

            case "RESOLVED":
                return "feedback-status-resolved";

            default:
                return "";
        }
    };

    const formatDate = (value) => {
        if (!value) {
            return "—";
        }

        const date = new Date(value);

        return Number.isNaN(date.getTime())
            ? "—"
            : date.toLocaleString();
    };

    const averageRating =
        feedbackList.length > 0
            ? (
                  feedbackList.reduce(
                      (total, item) => total + item.rating,
                      0
                  ) / feedbackList.length
              ).toFixed(1)
            : "0.0";

    const submittedCount = feedbackList.filter(
        (item) => item.status === "SUBMITTED"
    ).length;

    const resolvedCount = feedbackList.filter(
        (item) => item.status === "RESOLVED"
    ).length;

    return (
        <div className="feedback-page">
            <section className="feedback-hero">
                <div>
                    <span className="feedback-eyebrow">
                        MODULE 26 · EMPLOYEE EXPERIENCE
                    </span>

                    <h2>
                        {isHROrAdmin
                            ? "Employee Feedback"
                            : "Share Your Feedback"}
                    </h2>

                    <p>
                        {isHROrAdmin
                            ? "Review employee feedback, understand workplace concerns, and track resolutions."
                            : "Your feedback helps us improve the workplace, teamwork, and employee experience."}
                    </p>
                </div>

                <button
                    type="button"
                    className="feedback-refresh-button"
                    onClick={fetchFeedback}
                    disabled={loading}
                >
                    {loading ? "Refreshing..." : "Refresh"}
                </button>
            </section>

            {error && (
                <div className="feedback-alert feedback-alert-error">
                    {error}
                </div>
            )}

            {success && (
                <div className="feedback-alert feedback-alert-success">
                    {success}
                </div>
            )}

            <section className="feedback-stats">
                <article className="feedback-stat-card">
                    <span>Total Feedback</span>
                    <strong>{feedbackList.length}</strong>
                    <small>Records in this view</small>
                </article>

                <article className="feedback-stat-card">
                    <span>Average Rating</span>
                    <strong>{averageRating} / 5</strong>
                    <small>Based on visible feedback</small>
                </article>

                <article className="feedback-stat-card">
                    <span>Awaiting Review</span>
                    <strong>{submittedCount}</strong>
                    <small>Submitted feedback</small>
                </article>

                <article className="feedback-stat-card">
                    <span>Resolved</span>
                    <strong>{resolvedCount}</strong>
                    <small>Resolved feedback</small>
                </article>
            </section>

            {!isHROrAdmin && (
                <section className="feedback-panel">
                    <div className="feedback-section-heading">
                        <div>
                            <h3>Submit Feedback</h3>
                            <p>
                                Share a suggestion, concern, or positive
                                experience.
                            </p>
                        </div>
                    </div>

                    <form
                        className="feedback-form"
                        onSubmit={handleSubmit}
                    >
                        <div className="feedback-form-grid">
                            <div className="feedback-field">
                                <label htmlFor="feedback-category">
                                    Feedback Category
                                </label>

                                <select
                                    id="feedback-category"
                                    name="category"
                                    value={form.category}
                                    onChange={handleFormChange}
                                >
                                    {CATEGORIES.map((category) => (
                                        <option
                                            key={category}
                                            value={category}
                                        >
                                            {category
                                                .replaceAll("_", " ")
                                                .toLowerCase()
                                                .replace(/\b\w/g, (char) =>
                                                    char.toUpperCase()
                                                )}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="feedback-field">
                                <label htmlFor="feedback-rating">
                                    Your Rating
                                </label>

                                <select
                                    id="feedback-rating"
                                    name="rating"
                                    value={form.rating}
                                    onChange={handleFormChange}
                                >
                                    <option value={5}>5 — Excellent</option>
                                    <option value={4}>4 — Very Good</option>
                                    <option value={3}>3 — Good</option>
                                    <option value={2}>2 — Fair</option>
                                    <option value={1}>1 — Needs Improvement</option>
                                </select>
                            </div>
                        </div>

                        <div className="feedback-field">
                            <label htmlFor="feedback-message">
                                Your Feedback
                            </label>

                            <textarea
                                id="feedback-message"
                                name="message"
                                value={form.message}
                                onChange={handleFormChange}
                                placeholder="Tell us about your experience or suggestion..."
                                rows={5}
                                minLength={5}
                                maxLength={2000}
                                required
                            />

                            <small className="feedback-character-count">
                                {form.message.length}/2000 characters
                            </small>
                        </div>

                        <button
                            type="submit"
                            className="feedback-primary-button"
                            disabled={submitting}
                        >
                            {submitting
                                ? "Submitting..."
                                : "Submit Feedback"}
                        </button>
                    </form>
                </section>
            )}

            <section className="feedback-panel">
                <div className="feedback-section-heading">
                    <div>
                        <h3>
                            {isHROrAdmin
                                ? "Feedback Inbox"
                                : "My Feedback History"}
                        </h3>

                        <p>
                            {isHROrAdmin
                                ? "Filter submissions and record review decisions."
                                : "Track the status of your previous submissions."}
                        </p>
                    </div>
                </div>

                {isHROrAdmin && (
                    <div className="feedback-filters">
                        <div className="feedback-field">
                            <label htmlFor="filter-status">Status</label>

                            <select
                                id="filter-status"
                                value={filters.status}
                                onChange={(event) =>
                                    setFilters((previous) => ({
                                        ...previous,
                                        status: event.target.value,
                                    }))
                                }
                            >
                                <option value="">All statuses</option>
                                <option value="SUBMITTED">Submitted</option>
                                <option value="REVIEWED">Reviewed</option>
                                <option value="RESOLVED">Resolved</option>
                            </select>
                        </div>

                        <div className="feedback-field">
                            <label htmlFor="filter-category">Category</label>

                            <select
                                id="filter-category"
                                value={filters.category}
                                onChange={(event) =>
                                    setFilters((previous) => ({
                                        ...previous,
                                        category: event.target.value,
                                    }))
                                }
                            >
                                <option value="">All categories</option>

                                {CATEGORIES.map((category) => (
                                    <option
                                        key={category}
                                        value={category}
                                    >
                                        {category.replaceAll("_", " ")}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="feedback-field">
                            <label htmlFor="filter-rating">Rating</label>

                            <select
                                id="filter-rating"
                                value={filters.rating}
                                onChange={(event) =>
                                    setFilters((previous) => ({
                                        ...previous,
                                        rating: event.target.value,
                                    }))
                                }
                            >
                                <option value="">All ratings</option>
                                {[5, 4, 3, 2, 1].map((rating) => (
                                    <option key={rating} value={rating}>
                                        {rating} / 5
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                )}

                {loading ? (
                    <div className="feedback-empty-state">
                        Loading feedback...
                    </div>
                ) : feedbackList.length === 0 ? (
                    <div className="feedback-empty-state">
                        <h4>No feedback found</h4>
                        <p>
                            {isHROrAdmin
                                ? "Try changing the filters or check again later."
                                : "Your submitted feedback will appear here."}
                        </p>
                    </div>
                ) : (
                    <div className="feedback-list">
                        {feedbackList.map((item) => {
                            const review = reviewForms[item.id] || {
                                status: "REVIEWED",
                                review_comment: "",
                            };

                            return (
                                <article
                                    className="feedback-card"
                                    key={item.id}
                                >
                                    <div className="feedback-card-header">
                                        <div>
                                            <span className="feedback-card-id">
                                                Feedback #{item.id}
                                            </span>

                                            <h4>
                                                {item.category.replaceAll(
                                                    "_",
                                                    " "
                                                )}
                                            </h4>
                                        </div>

                                        <span
                                            className={`feedback-status ${getStatusClass(
                                                item.status
                                            )}`}
                                        >
                                            {item.status}
                                        </span>
                                    </div>

                                    <div
                                        className="feedback-rating"
                                        aria-label={`Rating ${item.rating} out of 5`}
                                    >
                                        <span>
                                            {"★".repeat(item.rating)}
                                            {"☆".repeat(5 - item.rating)}
                                        </span>

                                        <strong>
                                            {item.rating}/5
                                        </strong>
                                    </div>

                                    <p className="feedback-message">
                                        {item.message}
                                    </p>

                                    <div className="feedback-meta">
                                        <span>
                                            Submitted:{" "}
                                            {formatDate(item.created_at)}
                                        </span>

                                        {isHROrAdmin && (
                                            <span>
                                                Employee ID: {item.employee_id}
                                            </span>
                                        )}

                                        {item.reviewed_at && (
                                            <span>
                                                Reviewed:{" "}
                                                {formatDate(item.reviewed_at)}
                                            </span>
                                        )}
                                    </div>

                                    {item.review_comment && (
                                        <div className="feedback-review-note">
                                            <strong>Review Comment</strong>
                                            <p>{item.review_comment}</p>
                                        </div>
                                    )}

                                    {isHROrAdmin &&
                                        item.status !== "RESOLVED" && (
                                            <div className="feedback-review-form">
                                                <div className="feedback-field">
                                                    <label
                                                        htmlFor={`review-status-${item.id}`}
                                                    >
                                                        Update Status
                                                    </label>

                                                    <select
                                                        id={`review-status-${item.id}`}
                                                        value={review.status}
                                                        onChange={(event) =>
                                                            handleReviewChange(
                                                                item.id,
                                                                "status",
                                                                event.target.value
                                                            )
                                                        }
                                                    >
                                                        <option value="REVIEWED">
                                                            Reviewed
                                                        </option>

                                                        <option value="RESOLVED">
                                                            Resolved
                                                        </option>
                                                    </select>
                                                </div>

                                                <div className="feedback-field">
                                                    <label
                                                        htmlFor={`review-comment-${item.id}`}
                                                    >
                                                        Review Comment
                                                    </label>

                                                    <textarea
                                                        id={`review-comment-${item.id}`}
                                                        value={
                                                            review.review_comment
                                                        }
                                                        onChange={(event) =>
                                                            handleReviewChange(
                                                                item.id,
                                                                "review_comment",
                                                                event.target.value
                                                            )
                                                        }
                                                        placeholder="Add a response or resolution note..."
                                                        rows={2}
                                                        maxLength={2000}
                                                    />
                                                </div>

                                                <button
                                                    type="button"
                                                    className="feedback-primary-button"
                                                    onClick={() =>
                                                        handleReview(item.id)
                                                    }
                                                    disabled={
                                                        reviewingId === item.id
                                                    }
                                                >
                                                    {reviewingId === item.id
                                                        ? "Saving..."
                                                        : "Save Review"}
                                                </button>
                                            </div>
                                        )}
                                </article>
                            );
                        })}
                    </div>
                )}
            </section>
        </div>
    );
}

export default Feedback;