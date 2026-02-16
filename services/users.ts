import apiClient from "./api";

export interface PendingUser {
    _id: string;
    name: string;
    email: string;
    phone: string;
    role: string | null;
    status: string;
    otp?: string | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface PendingUsersResponse {
    success: boolean;
    data: PendingUser[];
    message?: string;
}

export interface EmployeeUser {
    _id?: string;
    userId: {
        _id: string;
        name: string;
        email: string;
        phone: string;
        role: string;
        status: string;
        designation?: string;
        employeeId?: string;
    } | null;
    name?: string;
    employeeId: string;
    designation?: string;
    department?: string;
    isActive: boolean;
    joinDate?: string;
}

export interface EmployeesResponse {
    success: boolean;
    data: EmployeeUser[];
    message?: string;
}

export interface ConvertToEmployeePayload {
    designation: string;
    department: string;
    salary: number;
}

interface ConvertToEmployeeResponse {
    success: boolean;
    message?: string;
    data?: EmployeeUser;
}

export async function fetchPendingUsers() {
    const res = await apiClient.get<PendingUsersResponse>("/users/pending");
    return res.data.data;
}

export async function fetchEmployees() {
    const res = await apiClient.get<EmployeesResponse>("/users/employees");
    return res.data.data;
}

export async function convertPendingUserToEmployee(
    pendingUserId: string,
    payload: ConvertToEmployeePayload
) {
    const res = await apiClient.post<ConvertToEmployeeResponse>(
        `/users/${pendingUserId}/convert-to-employee`,
        payload
    );
    return res.data;
}
