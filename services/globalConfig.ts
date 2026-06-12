import apiClient from "./api";

interface ApiEnvelope<T> {
    success: boolean;
    message?: string;
    data: T;
}

export interface GlobalConfig {
    minCheckoutDuration: number;
    amountDeductionAfter10am: number;
    amountDeductionAfter12pm: number;
}

export async function fetchGlobalConfig() {
    const response = await apiClient.get<ApiEnvelope<GlobalConfig>>(
        "/global-config",
    );
    return response.data;
}

export async function updateGlobalConfig(payload: Partial<GlobalConfig>) {
    const response = await apiClient.put<ApiEnvelope<GlobalConfig>>(
        "/global-config",
        payload,
    );
    return response.data;
}
