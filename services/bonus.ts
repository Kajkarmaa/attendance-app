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

export interface YearlyBonusAccumulator {
    accumulated: number;
    attendanceAccrued: number;
    manualBonusTotal: number;
    nominalYearlyPool: number;
    percent: number;
    presentDays: number;
    dailyRate: number;
    year: number;
}

export async function fetchYearlyBonusAccumulator(year?: number): Promise<YearlyBonusAccumulator> {
    const params: Record<string, number> = {};
    if (year !== undefined) params.year = year;
    const response = await apiClient.get<ApiResponse<YearlyBonusAccumulator>>(
        "/bonus/accumulator",
        Object.keys(params).length ? { params } : undefined,
    );
    return response.data.data as YearlyBonusAccumulator;
}

export async function fetchYearlyBonusAccumulatorForUser(
    userId: string,
    year?: number,
): Promise<YearlyBonusAccumulator> {
    const params: Record<string, number> = {};
    if (year !== undefined) params.year = year;
    const response = await apiClient.get<ApiResponse<YearlyBonusAccumulator>>(
        `/bonus/accumulator/${encodeURIComponent(userId)}`,
        Object.keys(params).length ? { params } : undefined,
    );
    return response.data.data as YearlyBonusAccumulator;
}
