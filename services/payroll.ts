import apiClient from "./api";

export interface GeneratePayrollPayload {
    month: number;
    year: number;
    employeeId: string;
}

interface GeneratePayrollResponse<T = any> {
    success: boolean;
    message?: string;
    data?: T;
}

export async function generatePayroll(payload: GeneratePayrollPayload) {
    const response = await apiClient.post<GeneratePayrollResponse>(
        "/payroll/admin/generate",
        payload
    );
    return response.data;
}
