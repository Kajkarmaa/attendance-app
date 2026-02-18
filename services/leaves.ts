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
    attachmentUrl?: string;
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
    const response = await apiClient.post<LeaveRequestResponse>(
        "/leaves/request",
        payload,
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
