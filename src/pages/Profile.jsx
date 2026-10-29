
import { useCallback, useEffect, useState } from "react";
import api from "../services/api";
import "../style/Profile.css";

const DEFAULT_PREFERENCES = {
    attendance_notifications: true,
    leave_notifications: true,
    payroll_notifications: true,
    task_notifications: true,
    announcement_notifications: true,
    email_notifications: false,
};

function Profile({ user, onProfileUpdated }) {
    const [activeTab, setActiveTab] = useState("profile");

    const [isEditing, setIsEditing] = useState(false);
    const [profileLoading, setProfileLoading] = useState(false);
    const [passwordLoading, setPasswordLoading] = useState(false);
    const [preferencesLoading, setPreferencesLoading] = useState(false);
    const [preferencesSaving, setPreferencesSaving] = useState(false);

    const [formData, setFormData] = useState({
        username: user?.username || "",
        email: user?.email || "",
    });

    const [passwordData, setPasswordData] = useState({
        current_password: "",
        new_password: "",
        confirm_password: "",
    });

    const [preferences, setPreferences] = useState(
        DEFAULT_PREFERENCES
    );

    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    const displayName = user?.username || "User";
    const role = user?.role || "EMPLOYEE";

    const clearMessages = () => {
        setMessage("");
        setError("");
    };

    const showError = (err, fallback) => {
        const detail = err.response?.data?.detail;

        if (err.response?.status === 401) {
            setError(
                "Your session has expired. Please log in again."
            );
        } else if (typeof detail === "string") {
            setError(detail);
        } else {
            setError(fallback);
        }
    };

    // ==========================================
    // KEEP PROFILE FORM IN SYNC
    // ==========================================

    useEffect(() => {
        setFormData({
            username: user?.username || "",
            email: user?.email || "",
        });
    }, [user?.username, user?.email]);

    // ==========================================
    // LOAD NOTIFICATION PREFERENCES
    // ==========================================

    const loadPreferences = useCallback(async () => {
        setPreferencesLoading(true);

        try {
            const response = await api.get(
                "/settings/notifications"
            );

            setPreferences({
                ...DEFAULT_PREFERENCES,
                ...response.data,
            });
        } catch (err) {
            showError(
                err,
                "Unable to load notification preferences."
            );
        } finally {
            setPreferencesLoading(false);
        }
    }, []);

    useEffect(() => {
        loadPreferences();
    }, [loadPreferences]);

    // ==========================================
    // PROFILE FORM
    // ==========================================

    const handleProfileChange = (event) => {
        const { name, value } = event.target;

        setFormData((previous) => ({
            ...previous,
            [name]: value,
        }));
    };

    const handleEdit = () => {
        setFormData({
            username: user?.username || "",
            email: user?.email || "",
        });

        setIsEditing(true);
        clearMessages();
    };

    const handleCancel = () => {
        setFormData({
            username: user?.username || "",
            email: user?.email || "",
        });

        setIsEditing(false);
        clearMessages();
    };

    const handleProfileSubmit = async (event) => {
        event.preventDefault();

        clearMessages();
        setProfileLoading(true);

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

            if (typeof onProfileUpdated === "function") {
                onProfileUpdated(updatedUser);
            }

            setFormData({
                username: updatedUser.username,
                email: updatedUser.email,
            });

            setIsEditing(false);
            setMessage("Profile updated successfully.");
        } catch (err) {
            showError(
                err,
                "Unable to update your profile. Please try again."
            );
        } finally {
            setProfileLoading(false);
        }
    };

    // ==========================================
    // CHANGE PASSWORD
    // ==========================================

    const handlePasswordChange = (event) => {
        const { name, value } = event.target;

        setPasswordData((previous) => ({
            ...previous,
            [name]: value,
        }));
    };

    const handlePasswordSubmit = async (event) => {
        event.preventDefault();

        clearMessages();

        if (
            passwordData.new_password !==
            passwordData.confirm_password
        ) {
            setError("The new password and confirmation do not match.");
            return;
        }

        if (passwordData.new_password.length < 8) {
            setError("The new password must contain at least 8 characters.");
            return;
        }

        if (
            passwordData.new_password ===
            passwordData.current_password
        ) {
            setError(
                "Your new password must differ from your current password."
            );
            return;
        }

        setPasswordLoading(true);

        try {
            const response = await api.put(
                "/auth/change-password",
                {
                    current_password: passwordData.current_password,
                    new_password: passwordData.new_password,
                }
            );

            setPasswordData({
                current_password: "",
                new_password: "",
                confirm_password: "",
            });

            setMessage(
                response.data?.message ||
                "Password changed successfully."
            );
        } catch (err) {
            showError(
                err,
                "Unable to change your password. Please try again."
            );
        } finally {
            setPasswordLoading(false);
        }
    };

    // ==========================================
    // NOTIFICATION PREFERENCES
    // ==========================================

    const notificationOptions = [
        {
            key: "attendance_notifications",
            title: "Attendance",
            description: "Check-in, check-out and attendance updates.",
        },
        {
            key: "leave_notifications",
            title: "Leave Management",
            description: "Leave applications, approvals and rejections.",
        },
        {
            key: "payroll_notifications",
            title: "Payroll",
            description: "Payroll processing and payslip updates.",
        },
        {
            key: "task_notifications",
            title: "Tasks",
            description: "Task assignments and task updates.",
        },
        {
            key: "announcement_notifications",
            title: "Announcements",
            description: "Company news and internal announcements.",
        },
        {
            key: "email_notifications",
            title: "Email Notifications",
            description: "Receive supported notifications through email.",
        },
    ];

    const handlePreferenceToggle = (key) => {
        setPreferences((previous) => ({
            ...previous,
            [key]: !previous[key],
        }));

        clearMessages();
    };

    const handlePreferencesSubmit = async (event) => {
        event.preventDefault();

        clearMessages();
        setPreferencesSaving(true);

        try {
            const response = await api.put(
                "/settings/notifications",
                {
                    attendance_notifications:
                        preferences.attendance_notifications,
                    leave_notifications:
                        preferences.leave_notifications,
                    payroll_notifications:
                        preferences.payroll_notifications,
                    task_notifications:
                        preferences.task_notifications,
                    announcement_notifications:
                        preferences.announcement_notifications,
                    email_notifications:
                        preferences.email_notifications,
                }
            );

            setPreferences({
                ...DEFAULT_PREFERENCES,
                ...response.data,
            });

            setMessage(
                "Notification preferences saved successfully."
            );
        } catch (err) {
            showError(
                err,
                "Unable to save notification preferences."
            );
        } finally {
            setPreferencesSaving(false);
        }
    };

    // ==========================================
    // PAGE UI
    // ==========================================

    return (
        <section className="profile-settings-page">
            <header className="profile-card profile-main-card">
                <div className="profile-heading">
                    <div>
                        <span className="profile-eyebrow">
                            ACCOUNT SETTINGS
                        </span>

                        <h2>My Profile & Settings</h2>

                        <p>
                            Manage your personal information,
                            password and notification preferences.
                        </p>
                    </div>

                    <div className="profile-avatar">
                        {displayName.charAt(0).toUpperCase()}
                    </div>
                </div>

                <div className="profile-account-summary">
                    <div>
                        <span className="profile-summary-label">
                            ACCOUNT
                        </span>

                        <strong>{displayName}</strong>

                        <span className="profile-summary-email">
                            {user?.email || "No email available"}
                        </span>
                    </div>

                    <span className="profile-role-badge">
                        {role}
                    </span>
                </div>
            </header>

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

            <div
                className="profile-settings-tabs"
                role="tablist"
                aria-label="Profile settings sections"
            >
                <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === "profile"}
                    className={
                        activeTab === "profile" ? "active" : ""
                    }
                    onClick={() => {
                        setActiveTab("profile");
                        clearMessages();
                    }}
                >
                    Profile Details
                </button>

                <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === "password"}
                    className={
                        activeTab === "password" ? "active" : ""
                    }
                    onClick={() => {
                        setActiveTab("password");
                        clearMessages();
                    }}
                >
                    Change Password
                </button>

                <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === "notifications"}
                    className={
                        activeTab === "notifications" ? "active" : ""
                    }
                    onClick={() => {
                        setActiveTab("notifications");
                        clearMessages();
                    }}
                >
                    Notification Preferences
                </button>
            </div>

            {/* PROFILE DETAILS */}

            {activeTab === "profile" && (
                <section
                    className="profile-card profile-settings-card"
                    role="tabpanel"
                >
                    <div className="profile-section-heading">
                        <div>
                            <h3>Personal Information</h3>

                            <p>
                                Update the account details associated
                                with your WorkSphere login.
                            </p>
                        </div>
                    </div>

                    {isEditing ? (
                        <form onSubmit={handleProfileSubmit}>
                            <div className="profile-field">
                                <label htmlFor="profile-username">
                                    Username
                                </label>

                                <input
                                    id="profile-username"
                                    name="username"
                                    type="text"
                                    value={formData.username}
                                    onChange={handleProfileChange}
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
                                    onChange={handleProfileChange}
                                    autoComplete="email"
                                    required
                                />
                            </div>

                            <div className="profile-actions">
                                <button
                                    className="profile-save-button"
                                    type="submit"
                                    disabled={profileLoading}
                                >
                                    {profileLoading
                                        ? "Saving..."
                                        : "Save Changes"}
                                </button>

                                <button
                                    className="profile-cancel-button"
                                    type="button"
                                    onClick={handleCancel}
                                    disabled={profileLoading}
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
                                    <strong>{displayName}</strong>
                                </div>

                                <div className="profile-information-row">
                                    <span>Email address</span>
                                    <strong>
                                        {user?.email || "Not provided"}
                                    </strong>
                                </div>

                                <div className="profile-information-row">
                                    <span>Account role</span>
                                    <strong>{role}</strong>
                                </div>

                                <div className="profile-information-row">
                                    <span>Account ID</span>
                                    <strong>{user?.id ?? "—"}</strong>
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
            )}

            {/* CHANGE PASSWORD */}

            {activeTab === "password" && (
                <section
                    className="profile-card profile-settings-card"
                    role="tabpanel"
                >
                    <div className="profile-section-heading">
                        <div>
                            <h3>Change Password</h3>

                            <p>
                                Verify your current password before
                                setting a new one.
                            </p>
                        </div>
                    </div>

                    <form onSubmit={handlePasswordSubmit}>
                        <div className="profile-field">
                            <label htmlFor="current-password">
                                Current password
                            </label>

                            <input
                                id="current-password"
                                name="current_password"
                                type="password"
                                value={passwordData.current_password}
                                onChange={handlePasswordChange}
                                autoComplete="current-password"
                                maxLength={128}
                                required
                            />
                        </div>

                        <div className="profile-field">
                            <label htmlFor="new-password">
                                New password
                            </label>

                            <input
                                id="new-password"
                                name="new_password"
                                type="password"
                                value={passwordData.new_password}
                                onChange={handlePasswordChange}
                                autoComplete="new-password"
                                minLength={8}
                                maxLength={128}
                                required
                            />

                            <span className="profile-field-help">
                                Use at least 8 characters.
                            </span>
                        </div>

                        <div className="profile-field">
                            <label htmlFor="confirm-password">
                                Confirm new password
                            </label>

                            <input
                                id="confirm-password"
                                name="confirm_password"
                                type="password"
                                value={passwordData.confirm_password}
                                onChange={handlePasswordChange}
                                autoComplete="new-password"
                                minLength={8}
                                maxLength={128}
                                required
                            />
                        </div>

                        <div className="profile-actions">
                            <button
                                className="profile-save-button"
                                type="submit"
                                disabled={passwordLoading}
                            >
                                {passwordLoading
                                    ? "Updating..."
                                    : "Update Password"}
                            </button>
                        </div>
                    </form>
                </section>
            )}

            {/* NOTIFICATION PREFERENCES */}

            {activeTab === "notifications" && (
                <section
                    className="profile-card profile-settings-card"
                    role="tabpanel"
                >
                    <div className="profile-section-heading">
                        <div>
                            <h3>Notification Preferences</h3>

                            <p>
                                Choose the notification categories
                                you want to enable for your account.
                            </p>
                        </div>

                        <button
                            className="profile-refresh-button"
                            type="button"
                            onClick={loadPreferences}
                            disabled={
                                preferencesLoading ||
                                preferencesSaving
                            }
                        >
                            {preferencesLoading
                                ? "Loading..."
                                : "Refresh"}
                        </button>
                    </div>

                    {preferencesLoading ? (
                        <div className="profile-loading">
                            Loading your preferences...
                        </div>
                    ) : (
                        <form onSubmit={handlePreferencesSubmit}>
                            <div className="profile-preference-list">
                                {notificationOptions.map((option) => (
                                    <div
                                        className="profile-preference-row"
                                        key={option.key}
                                    >
                                        <div className="profile-preference-copy">
                                            <strong>
                                                {option.title}
                                            </strong>

                                            <p>
                                                {option.description}
                                            </p>
                                        </div>

                                        <label
                                            className="profile-toggle"
                                            htmlFor={option.key}
                                        >
                                            <input
                                                id={option.key}
                                                type="checkbox"
                                                checked={Boolean(
                                                    preferences[option.key]
                                                )}
                                                onChange={() =>
                                                    handlePreferenceToggle(
                                                        option.key
                                                    )
                                                }
                                                aria-label={`${option.title} notifications`}
                                            />

                                            <span className="profile-toggle-slider" />
                                        </label>
                                    </div>
                                ))}
                            </div>

                            <div className="profile-actions">
                                <button
                                    className="profile-save-button"
                                    type="submit"
                                    disabled={preferencesSaving}
                                >
                                    {preferencesSaving
                                        ? "Saving..."
                                        : "Save Preferences"}
                                </button>
                            </div>

                            <p className="profile-preference-note">
                                Preferences are saved to your account.
                                Email delivery depends on the email
                                notification service being configured.
                            </p>
                        </form>
                    )}
                </section>
            )}
        </section>
    );
}

export default Profile;
