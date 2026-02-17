import apiClient from "./api";

export interface GeneratePayrollPayload {
    month: number;
    year: number;
    employeeId: string;
}

interface ApiResponse<T = any> {
    success: boolean;
    message?: string;
    data?: T;
}

export async function generatePayroll(payload: GeneratePayrollPayload) {
    const response = await apiClient.post<ApiResponse>(
        "/payroll/admin/generate",
        payload
    );
    return response.data;
}

export interface PayslipDownloadPayload {
    month: number;
    year: number;
    employeeId: string;
}

export interface PayslipDownloadData {
    employeeId: string;
    payrollId: string;
    downloadUrl: string;
    expiresIn: number;
    payslipUrl: string;
    employeeName: string;
    month: number;
    year: number;
}

export async function getPayslipDownloadUrl(payload: PayslipDownloadPayload) {
    const response = await apiClient.post<ApiResponse<PayslipDownloadData>>(
        "/payroll/payslip-url",
        payload
    );
    return response.data;
}
