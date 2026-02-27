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
    profilePicture?: string;
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

export async function updateProfileImage(file: { uri: string; name?: string; type?: string }) { 
    const form = new FormData();
    // React Native FormData file object
    const filename = file.name || `photo_${Date.now()}.jpg`;
    form.append("image", {
        uri: file.uri,
        name: filename,
        type: file.type || "image/jpeg",
    } as any);

    const response = await apiClient.post("/users/update-profile", form, {
        headers: {
            "Content-Type": "multipart/form-data",
        },
    });

    return response.data;
}

// Added changePassword function
export async function changePassword(payload: { email: string; oldPassword: string; newPassword: string }) {
    const response = await apiClient.post("/users/reset-password", {
        email: payload.email,
        oldPassword: payload.oldPassword,
        newPassword: payload.newPassword,
    });
    return response.data;
}
