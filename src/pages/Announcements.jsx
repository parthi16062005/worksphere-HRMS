
import { useCallback, useEffect, useState } from "react";
import {
    getAnnouncements,
    createAnnouncement,
    updateAnnouncement,
    deleteAnnouncement,
} from "../services/announcementService";
import "../style/Announcements.css";

function Announcements({ user }) {
    const role = String(user?.role || "").toUpperCase();
    const canManage = role === "HR" || role === "ADMIN";

    const [announcements, setAnnouncements] = useState([]);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);

    const [form, setForm] = useState({
        title: "",
        message: "",
    });

    const loadAnnouncements = useCallback(async () => {
        try {
            setLoading(true);
            setError("");

            const data = await getAnnouncements(search);
            setAnnouncements(Array.isArray(data) ? data : []);
        } catch (err) {
            setError(
                err.response?.data?.detail ||
                "Unable to load announcements. Please try again."
            );
        } finally {
            setLoading(false);
        }
    }, [search]);

    useEffect(() => {
        const timer = setTimeout(() => {
            loadAnnouncements();
        }, 250);

        return () => clearTimeout(timer);
    }, [loadAnnouncements]);

    const openCreateForm = () => {
        setEditingId(null);
        setForm({ title: "", message: "" });
        setError("");
        setSuccess("");
        setShowForm(true);
    };

    const openEditForm = (announcement) => {
        setEditingId(announcement.id);
        setForm({
            title: announcement.title,
            message: announcement.message,
        });
        setError("");
        setSuccess("");
        setSelectedAnnouncement(null);
        setShowForm(true);
    };

    const closeForm = () => {
        setShowForm(false);
        setEditingId(null);
        setForm({ title: "", message: "" });
        setError("");
    };

    const handleFormChange = (event) => {
        const { name, value } = event.target;

        setForm((previous) => ({
            ...previous,
            [name]: value,
        }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        const title = form.title.trim();
        const message = form.message.trim();

        if (title.length < 3) {
            setError("Title must contain at least 3 characters.");
            return;
        }

        if (message.length < 5) {
            setError("Message must contain at least 5 characters.");
            return;
        }

        try {
            setSaving(true);
            setError("");
            setSuccess("");

            if (editingId !== null) {
                await updateAnnouncement(editingId, {
                    title,
                    message,
                });

                setSuccess("Announcement updated successfully.");
            } else {
                await createAnnouncement({
                    title,
                    message,
                });

                setSuccess("Announcement published successfully.");
            }

            closeForm();
            await loadAnnouncements();
        } catch (err) {
            setError(
                err.response?.data?.detail ||
                "Unable to save the announcement."
            );
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (announcement) => {
        const confirmed = window.confirm(
            `Are you sure you want to delete "${announcement.title}"?`
        );

        if (!confirmed) return;

        try {
            setError("");
            setSuccess("");

            await deleteAnnouncement(announcement.id);

            setSelectedAnnouncement(null);
            setSuccess("Announcement deleted successfully.");

            await loadAnnouncements();
        } catch (err) {
            setError(
                err.response?.data?.detail ||
                "Unable to delete the announcement."
            );
        }
    };

    const formatDate = (value) => {
        if (!value) return "Date unavailable";

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return "Date unavailable";
        }

        return date.toLocaleString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    return (
        <div className="announcements-page">
            <div className="announcements-header">
                <div>
                    <span className="announcements-eyebrow">
                        MODULE 23 · EMPLOYEE EXPERIENCE
                    </span>

                    <h1>Internal Announcements</h1>

                    <p>
                        Stay informed about company news, important updates,
                        and workplace announcements.
                    </p>
                </div>

                <div className="announcements-header-actions">
                    <button
                        type="button"
                        className="announcement-secondary-btn"
                        onClick={loadAnnouncements}
                        disabled={loading}
                    >
                        {loading ? "Refreshing..." : "Refresh"}
                    </button>

                    {canManage && (
                        <button
                            type="button"
                            className="announcement-primary-btn"
                            onClick={openCreateForm}
                        >
                            + New Announcement
                        </button>
                    )}
                </div>
            </div>

            <div className="announcements-summary">
                <div className="announcement-summary-card">
                    <span className="announcement-summary-label">
                        Total Announcements
                    </span>

                    <strong>{announcements.length}</strong>

                    <small>Announcements in this view</small>
                </div>

                <div className="announcement-summary-card">
                    <span className="announcement-summary-label">
                        Your Access
                    </span>

                    <strong>{canManage ? "Manager" : "Employee"}</strong>

                    <small>
                        {canManage
                            ? "Create and manage announcements"
                            : "Read company announcements"}
                    </small>
                </div>
            </div>

            <div className="announcements-toolbar">
                <div>
                    <h2>Company Bulletin Board</h2>
                    <p>Browse the latest company updates.</p>
                </div>

                <input
                    type="search"
                    className="announcement-search"
                    placeholder="Search announcements..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    aria-label="Search announcements"
                />
            </div>

            {error && (
                <div className="announcement-alert announcement-alert-error">
                    {error}
                </div>
            )}

            {success && (
                <div className="announcement-alert announcement-alert-success">
                    {success}
                </div>
            )}

            {loading ? (
                <div className="announcement-state">
                    <div className="announcement-spinner" />
                    <p>Loading announcements...</p>
                </div>
            ) : announcements.length === 0 ? (
                <div className="announcement-empty">
                    <div className="announcement-empty-icon">A</div>

                    <h3>
                        {search.trim()
                            ? "No matching announcements"
                            : "No announcements yet"}
                    </h3>

                    <p>
                        {search.trim()
                            ? "Try another search term."
                            : canManage
                              ? "Publish your first announcement to keep employees informed."
                              : "Company announcements will appear here when they are published."}
                    </p>

                    {canManage && !search.trim() && (
                        <button
                            type="button"
                            className="announcement-primary-btn"
                            onClick={openCreateForm}
                        >
                            Create Announcement
                        </button>
                    )}
                </div>
            ) : (
                <div className="announcements-grid">
                    {announcements.map((announcement) => (
                        <article
                            className="announcement-card"
                            key={announcement.id}
                        >
                            <div className="announcement-card-top">
                                <span className="announcement-category">
                                    COMPANY UPDATE
                                </span>

                                <span className="announcement-date">
                                    {formatDate(announcement.created_at)}
                                </span>
                            </div>

                            <h3>{announcement.title}</h3>

                            <p className="announcement-message-preview">
                                {announcement.message.length > 180
                                    ? `${announcement.message.slice(0, 180)}...`
                                    : announcement.message}
                            </p>

                            <div className="announcement-card-footer">
                                <button
                                    type="button"
                                    className="announcement-read-btn"
                                    onClick={() =>
                                        setSelectedAnnouncement(announcement)
                                    }
                                >
                                    Read announcement
                                </button>

                                {canManage && (
                                    <div className="announcement-manage-actions">
                                        <button
                                            type="button"
                                            className="announcement-edit-btn"
                                            onClick={() =>
                                                openEditForm(announcement)
                                            }
                                        >
                                            Edit
                                        </button>

                                        <button
                                            type="button"
                                            className="announcement-delete-btn"
                                            onClick={() =>
                                                handleDelete(announcement)
                                            }
                                        >
                                            Delete
                                        </button>
                                    </div>
                                )}
                            </div>
                        </article>
                    ))}
                </div>
            )}

            {showForm && canManage && (
                <div
                    className="announcement-modal-backdrop"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) {
                            closeForm();
                        }
                    }}
                >
                    <section
                        className="announcement-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="announcement-form-title"
                    >
                        <div className="announcement-modal-header">
                            <div>
                                <span className="announcements-eyebrow">
                                    ANNOUNCEMENT MANAGEMENT
                                </span>

                                <h2 id="announcement-form-title">
                                    {editingId !== null
                                        ? "Edit Announcement"
                                        : "Create Announcement"}
                                </h2>
                            </div>

                            <button
                                type="button"
                                className="announcement-close-btn"
                                onClick={closeForm}
                                aria-label="Close form"
                                disabled={saving}
                            >
                                ×
                            </button>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <label htmlFor="announcement-title">
                                Announcement Title
                            </label>

                            <input
                                id="announcement-title"
                                name="title"
                                type="text"
                                value={form.title}
                                onChange={handleFormChange}
                                placeholder="Enter announcement title"
                                minLength={3}
                                maxLength={200}
                                required
                            />

                            <label htmlFor="announcement-message">
                                Announcement Message
                            </label>

                            <textarea
                                id="announcement-message"
                                name="message"
                                value={form.message}
                                onChange={handleFormChange}
                                placeholder="Write the announcement details..."
                                minLength={5}
                                maxLength={5000}
                                rows={7}
                                required
                            />

                            <div className="announcement-character-count">
                                {form.message.length}/5000 characters
                            </div>

                            {error && (
                                <div className="announcement-alert announcement-alert-error">
                                    {error}
                                </div>
                            )}

                            <div className="announcement-form-actions">
                                <button
                                    type="button"
                                    className="announcement-secondary-btn"
                                    onClick={closeForm}
                                    disabled={saving}
                                >
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    className="announcement-primary-btn"
                                    disabled={saving}
                                >
                                    {saving
                                        ? "Saving..."
                                        : editingId !== null
                                          ? "Save Changes"
                                          : "Publish Announcement"}
                                </button>
                            </div>
                        </form>
                    </section>
                </div>
            )}

            {selectedAnnouncement && (
                <div
                    className="announcement-modal-backdrop"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) {
                            setSelectedAnnouncement(null);
                        }
                    }}
                >
                    <section
                        className="announcement-modal announcement-detail-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="announcement-detail-title"
                    >
                        <div className="announcement-modal-header">
                            <span className="announcement-category">
                                COMPANY UPDATE
                            </span>

                            <button
                                type="button"
                                className="announcement-close-btn"
                                onClick={() => setSelectedAnnouncement(null)}
                                aria-label="Close announcement"
                            >
                                ×
                            </button>
                        </div>

                        <span className="announcement-detail-date">
                            Published {formatDate(
                                selectedAnnouncement.created_at
                            )}
                        </span>

                        <h2 id="announcement-detail-title">
                            {selectedAnnouncement.title}
                        </h2>

                        <div className="announcement-detail-message">
                            {selectedAnnouncement.message}
                        </div>

                        <div className="announcement-form-actions">
                            {canManage && (
                                <>
                                    <button
                                        type="button"
                                        className="announcement-secondary-btn"
                                        onClick={() =>
                                            openEditForm(selectedAnnouncement)
                                        }
                                    >
                                        Edit
                                    </button>

                                    <button
                                        type="button"
                                        className="announcement-delete-btn"
                                        onClick={() =>
                                            handleDelete(selectedAnnouncement)
                                        }
                                    >
                                        Delete
                                    </button>
                                </>
                            )}

                            <button
                                type="button"
                                className="announcement-primary-btn"
                                onClick={() => setSelectedAnnouncement(null)}
                            >
                                Close
                            </button>
                        </div>
                    </section>
                </div>
            )}
        </div>
    );
}

export default Announcements;

