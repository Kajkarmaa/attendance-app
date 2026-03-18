import apiClient from "./api";

export interface GenerateBonusPayload {
    employeeId?: string;
    amount: number;
    type: string;
    notes?: string;
    month?: number;
    year?: number;
}

interface ApiResponse<T = any> {
    success: boolean;
    message?: string;
    data?: T;
}

export async function generateBonus(payload: GenerateBonusPayload) {
    const response = await apiClient.post<ApiResponse>(
        `/bonus/admin/award`,
        payload,
    );
    return response.data;
}
