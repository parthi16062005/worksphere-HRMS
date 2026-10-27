import { useCallback, useEffect, useState } from "react";
import {
    getNotifications,
    getUnreadNotificationCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
} from "../services/notificationService";
import "../style/Notifications.css";

function Notifications() {
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [updatingId, setUpdatingId] = useState(null);
    const [markingAll, setMarkingAll] = useState(false);

    const loadNotifications = useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            const [notificationData, countData] = await Promise.all([
                getNotifications(),
                getUnreadNotificationCount(),
            ]);

            setNotifications(notificationData);
            setUnreadCount(countData.unread_count);
        } catch (err) {
            setError(
                err.response?.data?.detail ||
                    "Unable to load notifications. Please try again."
            );
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadNotifications();
    }, [loadNotifications]);

    const handleMarkAsRead = async (notificationId) => {
        setUpdatingId(notificationId);
        setError("");

        try {
            const updatedNotification =
                await markNotificationAsRead(notificationId);

            setNotifications((previous) =>
                previous.map((notification) =>
                    notification.id === notificationId
                        ? updatedNotification
                        : notification
                )
            );

            setUnreadCount((previous) =>
                Math.max(
                    0,
                    previous -
                        (notifications.find(
                            (notification) =>
                                notification.id === notificationId
                        )?.is_read === 0
                            ? 1
                            : 0)
                )
            );
        } catch (err) {
            setError(
                err.response?.data?.detail ||
                    "Unable to mark the notification as read."
            );
        } finally {
            setUpdatingId(null);
        }
    };

    const handleMarkAllAsRead = async () => {
        if (unreadCount === 0) {
            return;
        }

        setMarkingAll(true);
        setError("");

        try {
            await markAllNotificationsAsRead();

            setNotifications((previous) =>
                previous.map((notification) => ({
                    ...notification,
                    is_read: 1,
                }))
            );

            setUnreadCount(0);
        } catch (err) {
            setError(
                err.response?.data?.detail ||
                    "Unable to mark all notifications as read."
            );
        } finally {
            setMarkingAll(false);
        }
    };

    const formatDate = (dateValue) => {
        if (!dateValue) {
            return "Date unavailable";
        }

        const date = new Date(dateValue);

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

    const getNotificationType = (title = "") => {
        const value = title.toLowerCase();

        if (value.includes("leave")) {
            return "leave";
        }

        if (value.includes("attendance")) {
            return "attendance";
        }

        if (value.includes("salary") || value.includes("payroll")) {
            return "payroll";
        }

        return "general";
    };

    return (
        <div className="notifications-page">
            <div className="notifications-header">
                <div>
                    <span className="notifications-eyebrow">
                        WORKSPHERE
                    </span>

                    <h1>Notifications</h1>

                    <p>
                        Stay updated with your attendance, leave requests,
                        and payroll activities.
                    </p>
                </div>

                <div className="notification-count-card">
                    <span className="notification-count-number">
                        {unreadCount}
                    </span>

                    <span className="notification-count-label">
                        Unread notifications
                    </span>
                </div>
            </div>

            <div className="notifications-toolbar">
                <div>
                    <h2>Recent Updates</h2>

                    <p>
                        {notifications.length} notification
                        {notifications.length !== 1 ? "s" : ""}
                    </p>
                </div>

                <button
                    type="button"
                    className="mark-all-read-button"
                    onClick={handleMarkAllAsRead}
                    disabled={markingAll || unreadCount === 0}
                >
                    {markingAll ? "Updating..." : "Mark all as read"}
                </button>
            </div>

            {error && (
                <div className="notifications-error" role="alert">
                    {error}

                    <button
                        type="button"
                        onClick={loadNotifications}
                    >
                        Try again
                    </button>
                </div>
            )}

            {loading ? (
                <div className="notifications-state">
                    <div className="notifications-spinner"></div>
                    <p>Loading notifications...</p>
                </div>
            ) : notifications.length === 0 ? (
                <div className="notifications-empty">
                    <div className="notifications-empty-icon">
                        N
                    </div>

                    <h3>You're all caught up!</h3>

                    <p>
                        You don't have any notifications yet. New updates
                        will appear here.
                    </p>
                </div>
            ) : (
                <div className="notifications-list">
                    {notifications.map((notification) => {
                        const isUnread = notification.is_read === 0;
                        const type = getNotificationType(
                            notification.title
                        );

                        return (
                            <article
                                key={notification.id}
                                className={`notification-card ${
                                    isUnread ? "unread" : "read"
                                }`}
                            >
                                <div
                                    className={`notification-type-icon ${type}`}
                                >
                                    {type === "leave"
                                        ? "L"
                                        : type === "attendance"
                                          ? "A"
                                          : type === "payroll"
                                            ? "P"
                                            : "N"}
                                </div>

                                <div className="notification-content">
                                    <div className="notification-title-row">
                                        <h3>{notification.title}</h3>

                                        {isUnread && (
                                            <span className="unread-badge">
                                                New
                                            </span>
                                        )}
                                    </div>

                                    <p className="notification-message">
                                        {notification.message}
                                    </p>

                                    <span className="notification-date">
                                        {formatDate(
                                            notification.created_at
                                        )}
                                    </span>
                                </div>

                                <div className="notification-actions">
                                    {isUnread ? (
                                        <button
                                            type="button"
                                            className="mark-read-button"
                                            onClick={() =>
                                                handleMarkAsRead(
                                                    notification.id
                                                )
                                            }
                                            disabled={
                                                updatingId ===
                                                notification.id
                                            }
                                        >
                                            {updatingId === notification.id
                                                ? "Updating..."
                                                : "Mark as read"}
                                        </button>
                                    ) : (
                                        <span className="read-status">
                                            Read
                                        </span>
                                    )}
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default Notifications;