import api from "./api";

// Get the logged-in employee's payroll history.
export const getMyPayroll = async () => {
const response = await api.get("/payroll/my");
return response.data;
};

// Get all payroll records for HR/Admin.
export const getAllPayroll = async (filters = {}) => {
const params = {};


if (filters.employee_id) {
    params.employee_id = filters.employee_id;
}

if (filters.payroll_month) {
    params.payroll_month = filters.payroll_month;
}

if (filters.payroll_year) {
    params.payroll_year = filters.payroll_year;
}

if (filters.payroll_status) {
    params.payroll_status = filters.payroll_status;
}

const response = await api.get("/payroll", { params });
return response.data;

};
