
import api from "./api";

// Get onboarding tasks for the logged-in employee
export const getMyOnboardingTasks = async () => {
    const response = await api.get("/onboarding/my");
    return response.data;
};

// Get all onboarding tasks (HR/Admin)
export const getAllOnboardingTasks = async (filters = {}) => {
    const params = {};

    if (filters.employee_id) {
        params.employee_id = filters.employee_id;
    }

    if (filters.task_status) {
        params.task_status = filters.task_status;
    }

    const response = await api.get("/onboarding", { params });
    return response.data;
};

// Assign an onboarding task (HR/Admin)
export const createOnboardingTask = async (taskData) => {
    const response = await api.post("/onboarding", taskData);
    return response.data;
};

// Update an onboarding task (HR/Admin)
export const updateOnboardingTask = async (taskId, taskData) => {
    const response = await api.put(`/onboarding/${taskId}`, taskData);
    return response.data;
};

// Mark an employee's own task as completed
export const completeMyOnboardingTask = async (taskId) => {
    const response = await api.patch(
        `/onboarding/${taskId}/complete`
    );

    return response.data;
};

// Delete an onboarding task (HR/Admin)
export const deleteOnboardingTask = async (taskId) => {
    const response = await api.delete(`/onboarding/${taskId}`);
    return response.data;
};

// Get a single onboarding task
export const getOnboardingTask = async (taskId) => {
    const response = await api.get(`/onboarding/${taskId}`);
    return response.data;
};
