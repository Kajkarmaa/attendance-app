import apiClient from "./api";

export interface PendingUser {
    id: string;
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
    id?: string;
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

export interface EmployeeAttendanceBreakdown {
    present: number;
    absent: number;
    late: number;
    halfDay: number;
    totalDays: number;
    averageWorkHours: string;
}

export interface EmployeeLeaveBalance {
    total: number;
    used: number;
    remaining: number;
}

export interface EmployeePayslip {
    id?: string;
    month?: number | string;
    year?: number | string;
    payrollId?: string;
    netSalary?: number;
    payslipGenerated?: boolean;
    payslipSent?: boolean;
    amount?: number;
    issuedOn?: string;
    status?: string;
    downloadUrl?: string;
}

export interface EmployeeDetail {
    id: string;
    name: string;
    email: string;
    role: string;
    employeeId: string;
    designation?: string;
    department?: string;
    salary?: number;
    joinDate?: string;
    status?: string;
    phone?: string;
    Payslips: EmployeePayslip[];
    attendance?: {
        thisMonth?: EmployeeAttendanceBreakdown;
    };
    leaveBalance?: EmployeeLeaveBalance;
}

interface EmployeeDetailResponse {
    success: boolean;
    data: EmployeeDetail;
    message?: string;
}

export interface DepartmentsResponse {
    success: boolean;
    data: string[];
    message?: string;
}

export async function fetchPendingUsers() {
    const res = await apiClient.get<PendingUsersResponse>("/users/pending");
    return res.data.data;
}

export async function fetchEmployees(searchTerm?: string) {
    const trimmed = (searchTerm || "").trim();
    const url = trimmed
        ? `/employees/search?query=${encodeURIComponent(trimmed)}`
        : "/users/employees";
    const res = await apiClient.get<EmployeesResponse>(url);
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

export async function fetchEmployeeDetail(employeeId: string) {
    const res = await apiClient.get<EmployeeDetailResponse>(`/employees/${employeeId}`);
    return res.data.data;
}

export async function fetchDepartments() {
    const res = await apiClient.get<DepartmentsResponse>("/employees/departments");
    return res.data.data;
}
