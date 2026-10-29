
import api from "./api";

// Get all notifications for the logged-in user
export const getNotifications = async (unreadOnly = false) => {
    const response = await api.get("/notifications", {
        params: {
            unread_only: unreadOnly,
        },
    });

    return response.data;
};

// Get unread notification count
export const getUnreadNotificationCount = async () => {
    const response = await api.get("/notifications/unread-count");

    return response.data;
};

// Mark an individual notification as read
export const markNotificationAsRead = async (notificationId) => {
    const response = await api.patch(
        `/notifications/${notificationId}/read`
    );

    return response.data;
};

// Mark all notifications as read
export const markAllNotificationsAsRead = async () => {
    const response = await api.patch("/notifications/read-all");

    return response.data;
};
