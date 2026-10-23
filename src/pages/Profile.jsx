import { useEffect, useState } from "react";
import api from "../services/api";
import "../style/Profile.css";

function Profile({ user, onProfileUpdated }) {
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        username: user.username,
        email: user.email,
    });

    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    useEffect(() => {
        setFormData({
            username: user.username,
            email: user.email,
        });
    }, [user.username, user.email]);

    const handleChange = (event) => {
        setFormData({
            ...formData,
            [event.target.name]: event.target.value,
        });
    };

    const handleEdit = () => {
        setFormData({
            username: user.username,
            email: user.email,
        });

        setIsEditing(true);
        setMessage("");
        setError("");
    };

    const handleCancel = () => {
        setFormData({
            username: user.username,
            email: user.email,
        });

        setIsEditing(false);
        setMessage("");
        setError("");
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        setLoading(true);
        setMessage("");
        setError("");

        try {
            const response = await api.put("/auth/me", {
                username: formData.username.trim(),
                email: formData.email.trim(),
            });

            const updatedUser = response.data;

            localStorage.setItem(
                "worksphere_user",
                JSON.stringify(updatedUser)
            );

            onProfileUpdated(updatedUser);
            setIsEditing(false);
            setMessage("Your profile was updated successfully.");
        } catch (err) {
            const detail = err.response?.data?.detail;

            if (err.response?.status === 401) {
                setError(
                    "Your session has expired. Please log in again."
                );
            } else {
                setError(
                    typeof detail === "string"
                        ? detail
                        : "Unable to update your profile. Please try again."
                );
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <section className="profile-card">
            <div className="profile-heading">
                <div>
                    <span className="profile-eyebrow">
                        ACCOUNT SETTINGS
                    </span>

                    <h2>My Profile</h2>

                    <p>
                        View and manage your personal account information.
                    </p>
                </div>

                <div className="profile-avatar">
                    {user.username.charAt(0).toUpperCase()}
                </div>
            </div>

            {message && (
                <div className="profile-success" role="status">
                    {message}
                </div>
            )}

            {error && (
                <div className="profile-error" role="alert">
                    {error}
                </div>
            )}

            {isEditing ? (
                <form onSubmit={handleSubmit}>
                    <div className="profile-field">
                        <label htmlFor="profile-username">
                            Username
                        </label>

                        <input
                            id="profile-username"
                            name="username"
                            type="text"
                            value={formData.username}
                            onChange={handleChange}
                            minLength={3}
                            maxLength={50}
                            autoComplete="username"
                            required
                        />
                    </div>

                    <div className="profile-field">
                        <label htmlFor="profile-email">
                            Email address
                        </label>

                        <input
                            id="profile-email"
                            name="email"
                            type="email"
                            value={formData.email}
                            onChange={handleChange}
                            autoComplete="email"
                            required
                        />
                    </div>

                    <div className="profile-actions">
                        <button
                            className="profile-save-button"
                            type="submit"
                            disabled={loading}
                        >
                            {loading ? "Saving..." : "Save Changes"}
                        </button>

                        <button
                            className="profile-cancel-button"
                            type="button"
                            onClick={handleCancel}
                            disabled={loading}
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            ) : (
                <>
                    <div className="profile-information">
                        <div className="profile-information-row">
                            <span>Username</span>
                            <strong>{user.username}</strong>
                        </div>

                        <div className="profile-information-row">
                            <span>Email address</span>
                            <strong>{user.email}</strong>
                        </div>

                        <div className="profile-information-row">
                            <span>Account role</span>
                            <strong>{user.role}</strong>
                        </div>

                        <div className="profile-information-row">
                            <span>Account ID</span>
                            <strong>{user.id}</strong>
                        </div>
                    </div>

                    <button
                        className="profile-edit-button"
                        type="button"
                        onClick={handleEdit}
                    >
                        Edit Profile
                    </button>
                </>
            )}
        </section>
    );
}

export default Profile;