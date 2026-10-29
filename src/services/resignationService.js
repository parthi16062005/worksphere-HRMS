
import api from "./api";

// =====================================================
// MODULE 22: RESIGNATION & EXIT MANAGEMENT
// =====================================================

// Employee: submit resignation
export const submitResignation = async (data) => {
    const response = await api.post("/resignations", data);
    return response.data;
};

// Employee: get my resignations
export const getMyResignations = async () => {
    const response = await api.get("/resignations/my");
    return response.data;
};

// HR/Admin: get all resignations
export const getAllResignations = async (params = {}) => {
    const response = await api.get("/resignations", {
        params,
    });
    return response.data;
};

// View single resignation
export const getResignation = async (id) => {
    const response = await api.get(`/resignations/${id}`);
    return response.data;
};

// HR/Admin: approve or reject resignation
export const reviewResignation = async (id, status) => {
    const response = await api.patch(
        `/resignations/${id}/review`,
        {
            status,
        }
    );

    return response.data;
};