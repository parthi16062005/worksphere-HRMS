import api from "./api";

export const getEmployees = async (filters = {}) => {
    const params = {};

    if (filters.search?.trim()) {
        params.search = filters.search.trim();
    }

    if (filters.department) {
        params.department = filters.department;
    }

    if (filters.employment_status) {
        params.employment_status = filters.employment_status;
    }

    const response = await api.get("/employees", { params });

    return response.data;
};

export const getEmployeeById = async (employeeId) => {
    const response = await api.get(`/employees/${employeeId}`);
    return response.data;
};

export const createEmployee = async (employeeData) => {
    const response = await api.post("/employees", employeeData);
    return response.data;
};

export const updateEmployee = async (employeeId, employeeData) => {
    const response = await api.put(
        `/employees/${employeeId}`,
        employeeData
    );

    return response.data;
};

export const deleteEmployee = async (employeeId) => {
    const response = await api.delete(`/employees/${employeeId}`);
    return response.data;
};