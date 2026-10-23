import api from "./api";

// Get the logged-in employee's leave requests.
export const getMyLeaves = async () => {
const response = await api.get("/leaves/my");
return response.data;
};

// Get all leave requests for HR/Admin.
export const getAllLeaves = async (filters = {}) => {
const params = {};


if (filters.leave_status) {
    params.leave_status = filters.leave_status;
}

if (filters.employee_id) {
    params.employee_id = filters.employee_id;
}

const response = await api.get("/leaves", { params });
return response.data;

};
