import api from "./api";

// Get the logged-in employee's attendance history.
export const getMyAttendance = async () => {
const response = await api.get("/attendance/my");
return response.data;
};

// Get attendance records for HR/Admin.
export const getAllAttendance = async (filters = {}) => {
const params = {};


if (filters.attendance_date) {
    params.attendance_date = filters.attendance_date;
}

if (filters.employee_id) {
    params.employee_id = filters.employee_id;
}

if (filters.attendance_status) {
    params.attendance_status = filters.attendance_status;
}

const response = await api.get("/attendance", { params });
return response.data;


};
