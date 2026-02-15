import apiClient from "./api";

export interface EmployeeProfile {
    id: string;
    email: string;
    role: string;
    employeeId: string;
    designation?: string;
    department?: string;
    joinDate?: string;
    status?: string;
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
