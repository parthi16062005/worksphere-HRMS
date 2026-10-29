
import api from "./api";

// Get employees with search and advanced filters
export const getEmployees = async (filters = {}) => {
    const params = {};

    // Search by employee name or other supported fields
    if (filters.search?.trim()) {
        params.search = filters.search.trim();
    }

    // Filter by department
    if (filters.department) {
        params.department = filters.department;
    }

    // Filter by employment status
    if (filters.employment_status) {
        params.employment_status = filters.employment_status;
    }

    // Filter by user role: EMPLOYEE, HR, ADMIN
    if (filters.role) {
        params.role = filters.role;
    }

    // Filter by attendance: PRESENT or ABSENT
    if (filters.attendance_status) {
        params.attendance_status = filters.attendance_status;
    }

    // Filter by performance rating: 1 to 5
    if (
        filters.performance_rating !== undefined &&
        filters.performance_rating !== null &&
        filters.performance_rating !== ""
    ) {
        params.performance_rating = Number(filters.performance_rating);
    }

    const response = await api.get("/employees", { params });

    return response.data;
};

// Get one employee by ID
export const getEmployeeById = async (employeeId) => {
    const response = await api.get(`/employees/${employeeId}`);
    return response.data;
};

// Create employee
export const createEmployee = async (employeeData) => {
    const response = await api.post("/employees", employeeData);
    return response.data;
};

// Update employee
export const updateEmployee = async (employeeId, employeeData) => {
    const response = await api.put(
        `/employees/${employeeId}`,
        employeeData
    );

    return response.data;
};

// Delete employee
export const deleteEmployee = async (employeeId) => {
    const response = await api.delete(`/employees/${employeeId}`);
    return response.data;
};
