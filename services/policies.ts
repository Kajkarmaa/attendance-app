import apiClient from "./api";

interface ApiEnvelope<T> {
    success: boolean;
    message?: string;
    data: T;
}

export interface LeaveRuleItem {
    requireDocuments: boolean;
    minAdvanceNoticeDays: number;
    maxConsecutiveDays: number;
}

export interface LeaveTypeConfig {
    type: string;
    totalDays: number;
    probationDays: number;
    rules?: LeaveRuleItem;
}

export interface LeavePolicyPayload {
    name: string;
    year: number;
    description: string;
    leaves: LeaveTypeConfig[];
    isActive: boolean;
}

export interface LeavePolicy {
    _id: string;
    name: string;
    year: number;
    description?: string;
    isActive: boolean;
    leaves: LeaveTypeConfig[];
}

export interface AttendancePolicyPayload {
    name: string;
    year: number;
    description: string;
    checkInRules: {
        startTime: string;
        gracePeriod: number;
        locationRequired: boolean;
    };
    checkOutRules: {
        endTime: string;
        gracePeriod: number;
    };
    workHours: {
        fullDayHours: number;
        halfDayHours: number;
    };
    latePolicy: {
        maxLateMinutes: number;
    };
    weekSettings: {
        workingDays: number[];
    };
    isActive: boolean;
}

export interface AttendancePolicy {
    _id: string;
    name: string;
    year: number;
    description?: string;
    isActive: boolean;
    checkInRules?: {
        startTime?: string;
        gracePeriod?: number;
        locationRequired?: boolean;
    };
    checkOutRules?: {
        endTime?: string;
        gracePeriod?: number;
    };
    workHours?: {
        fullDayHours?: number;
        halfDayHours?: number;
    };
    latePolicy?: {
        maxLateMinutes?: number;
    };
    weekSettings?: {
        workingDays?: number[];
    };
}

export async function upsertLeavePolicy(payload: LeavePolicyPayload) {
    const response = await apiClient.put<ApiEnvelope<LeavePolicy>>(
        "/policies/leave",
        payload,
    );
    return response.data;
}

export async function fetchLeavePolicies() {
    const response = await apiClient.get<ApiEnvelope<LeavePolicy[]>>(
        "/policies/leave",
    );
    return response.data;
}

export async function upsertAttendancePolicy(payload: AttendancePolicyPayload) {
    const response = await apiClient.put<ApiEnvelope<AttendancePolicy>>(
        "/attendance-policy",
        payload,
    );
    return response.data;
}

export async function fetchAttendancePolicies() {
    const response = await apiClient.get<ApiEnvelope<AttendancePolicy[]>>(
        "/attendance-policy",
    );
    return response.data;
}
