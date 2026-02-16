import apiClient from "./api";

export interface EmployeeActivity {
    type: string;
    date: string;
    description: string;
    value?: string;
}

export interface RecentActivityData {
    employeeId: string;
    activities: EmployeeActivity[];
    totalActivities: number;
}

interface RecentActivityEnvelope {
    success: boolean;
    message?: string;
    data: RecentActivityData;
}

export async function fetchRecentActivity() {
    const response = await apiClient.get<RecentActivityEnvelope>("/employees/recent-activity");
    return response.data.data;
}
