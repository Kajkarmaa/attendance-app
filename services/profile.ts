import apiClient from "./api";

export interface EmployeeProfile {
    id: string;
    email: string;
    role: string;
    employeeId: string;
    designation?: string;
    name?: string;
    salary?: number;
    department?: string;
    joinDate?: string;
    status?: string;
    Payslips?: Array<{
        month?: number;
        year?: number;
        payrollId?: string;
        netSalary?: number;
        payslipGenerated?: boolean;
        payslipSent?: boolean;
    }>;
    attendance?: {
        thisMonth?: {
            present?: number;
            absent?: number;
            late?: number;
            halfDay?: number;
            totalDays?: number;
            averageWorkHours?: string;
        };
    };
    leaveBalance?: {
        total?: number;
        used?: number;
        remaining?: number;
    };
}

interface ProfileEnvelope {
    success: boolean;
    message?: string;
    data: EmployeeProfile;
}

export async function fetchEmployeeProfile(): Promise<EmployeeProfile> {
    const response = await apiClient.get<ProfileEnvelope>("/employees/profile");
    return response.data.data;
}
