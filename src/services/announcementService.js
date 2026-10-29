
import api from "./api";

// Get all announcements, with optional search.
export const getAnnouncements = async (search = "") => {
    const response = await api.get("/announcements", {
        params: search.trim() ? { search: search.trim() } : {},
    });

    return response.data;
};

// Get one announcement by ID.
export const getAnnouncement = async (announcementId) => {
    const response = await api.get(`/announcements/${announcementId}`);

    return response.data;
};

// Create an announcement (HR/Admin).
export const createAnnouncement = async (data) => {
    const response = await api.post("/announcements", data);

    return response.data;
};

// Update an announcement (HR/Admin).
export const updateAnnouncement = async (announcementId, data) => {
    const response = await api.put(
        `/announcements/${announcementId}`,
        data
    );

    return response.data;
};

// Delete an announcement (HR/Admin).
export const deleteAnnouncement = async (announcementId) => {
    const response = await api.delete(`/announcements/${announcementId}`);

    return response.data;
};
