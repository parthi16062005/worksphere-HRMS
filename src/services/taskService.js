
import api from "./api";

// Employee: Get my assigned tasks.
export const getMyTasks = async (status = "") => {
    const response = await api.get("/tasks/my", {
        params: status ? { status } : {},
    });

    return response.data;
};

// HR/Admin: Get all tasks with optional filters.
export const getAllTasks = async (filters = {}) => {
    const response = await api.get("/tasks", {
        params: filters,
    });

    return response.data;
};

// HR/Admin: Assign a task to an employee.
export const createTask = async (data) => {
    const response = await api.post("/tasks", data);

    return response.data;
};

// HR/Admin: Update task details.
export const updateTask = async (taskId, data) => {
    const response = await api.put(`/tasks/${taskId}`, data);

    return response.data;
};

// Employee: Update the status of their own task.
export const updateMyTaskStatus = async (taskId, status) => {
    const response = await api.patch(`/tasks/${taskId}/status`, {
        status,
    });

    return response.data;
};

// HR/Admin: Delete a task.
export const deleteTask = async (taskId) => {
    const response = await api.delete(`/tasks/${taskId}`);

    return response.data;
};

// Get one task.
export const getTask = async (taskId) => {
    const response = await api.get(`/tasks/${taskId}`);

    return response.data;
};
