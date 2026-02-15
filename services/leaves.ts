import apiClient from "./api";

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

export async function requestLeave(
    payload: LeaveRequestPayload,
): Promise<LeaveRequestResponse> {
    const response = await apiClient.post<LeaveRequestResponse>(
        "/leaves/request",
        payload,
    );
    return response.data;
}
