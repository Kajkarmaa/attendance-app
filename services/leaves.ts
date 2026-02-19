import apiClient from "./api";

export interface LeaveBalanceByTypeItem {
    total: number;
    used: number;
    remaining: number;
}

export type LeaveBalanceByType = Record<string, LeaveBalanceByTypeItem>;

export interface LeaveBalanceData {
    total: number;
    used: number;
    remaining: number;
    byType?: LeaveBalanceByType;
}

export interface LeaveBalanceResponse {
    success: boolean;
    message?: string;
    data: LeaveBalanceData;
}

export interface LeaveRequestPayload {
    type: string;
    startDate: string; // ISO date string
    endDate: string;   // ISO date string
    reason: string;
    attachment?: {
        uri: string;
        name: string;
        type: string;
    };
}

export interface LeaveRequestResponse {
    success: boolean;
    message: string;
    data?: Record<string, unknown>;
}

export type LeaveRequestStatus = "pending" | "approved" | "rejected" | string;

export interface MyLeaveRequest {
    id: string;
    type: string;
    startDate: string;
    endDate: string;
    days: number;
    reason?: string;
    status: LeaveRequestStatus;
    year?: number;
}

export interface MyLeavesResponse {
    success: boolean;
    message?: string;
    data: MyLeaveRequest[];
}

export async function requestLeave(
    payload: LeaveRequestPayload,
): Promise<LeaveRequestResponse> {
    const formData = new FormData();
    formData.append("type", payload.type);
    formData.append("startDate", payload.startDate);
    formData.append("endDate", payload.endDate);
    formData.append("reason", payload.reason);

    if (payload.attachment) {
        formData.append("attachments", {
            uri: payload.attachment.uri,
            name: payload.attachment.name,
            type: payload.attachment.type,
        } as unknown as Blob);
    }

    const response = await apiClient.post<LeaveRequestResponse>(
        "/leaves/request",
        formData,
        {
            headers: {
                "Content-Type": "multipart/form-data",
            },
        },
    );
    return response.data;
}

export async function fetchLeaveBalance(): Promise<LeaveBalanceData> {
    const response = await apiClient.get<LeaveBalanceResponse>("/leaves/balance");
    return response.data.data;
}

export async function fetchMyLeaves(): Promise<MyLeaveRequest[]> {
    const response = await apiClient.get<MyLeavesResponse>("/leaves/my");
    return response.data.data;
}

// Admin leave management types
export interface AdminLeaveEmployee {
    id: string;
    employeeId: string;
    name: string;
    email: string;
    phone?: string;
    designation?: string;
    department?: string;
}

export interface AdminLeaveItem {
    id: string;
    employee: AdminLeaveEmployee;
    type: string;
    startDate: string;
    endDate: string;
    days: number;
    reason?: string;
    status: LeaveRequestStatus;
    year?: number;
    appliedAt?: string;
    attachmentCount?: number;
}

export interface AdminLeavesResponse {
    success: boolean;
    data: AdminLeaveItem[];
}

export interface LeaveDecisionResponse {
    success: boolean;
    message?: string;
}

export async function fetchAdminLeaves(
    scope: "all" | "pending" = "all",
): Promise<AdminLeaveItem[]> {
    const path = scope === "pending" ? "/leaves/admin/pending" : "/leaves/admin/all";
    const response = await apiClient.get<AdminLeavesResponse>(path);
    return response.data.data ?? [];
}

export async function approveAdminLeave(
    leaveId: string,
    comments?: string,
): Promise<LeaveDecisionResponse> {
    const response = await apiClient.patch<LeaveDecisionResponse>(
        `/leaves/admin/${leaveId}/approve`,
        { comments },
    );
    return response.data;
}

export async function rejectAdminLeave(
    leaveId: string,
    rejectionReason?: string,
): Promise<LeaveDecisionResponse> {
    const response = await apiClient.patch<LeaveDecisionResponse>(
        `/leaves/admin/${leaveId}/reject`,
        { rejectionReason },
    );
    return response.data;
}
