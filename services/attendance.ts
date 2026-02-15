import apiClient from "./api";

export interface AttendanceRecord {
    id?: string;
    date?: string;
    checkIn?: {
        time: string;
        location?: string;
    } | null;
    checkOut?: {
        time: string;
        location?: string;
    } | null;
    workHours?: number;
    status?: string;
    timezone?: string;
    type?: "check_in" | "check_out";
}

interface ApiEnvelope<T> {
    success: boolean;
    message?: string;
    data: T;
    statusCode?: number;
    timestamp?: string;
}

interface CheckInApiData {
    attendance: {
        type: "check_in";
        checkInTime: string;
        timezone?: string;
        location?: string;
    };
    employee?: { employeeId?: string };
}

interface CheckOutApiData {
    attendance: {
        type: "check_out";
        checkOutTime: string;
        timezone?: string;
        location?: string;
        workHours?: number;
    };
    employee?: { employeeId?: string };
}

interface AttendanceApiData {
    id?: string;
    date?: string;
    checkIn?: {
        time: string;
        location?: string;
    };
    checkOut?: {
        time: string;
        location?: string;
    };
    workHours?: number;
    status?: string;
    timezone?: string;
}

const normalizeFromCheck = (payload: CheckInApiData | CheckOutApiData): AttendanceRecord => {
    const entry = payload.attendance;
    if (!entry) return {};

    if (entry.type === "check_in") {
        return {
            checkIn: {
                time: entry.checkInTime,
                location: (entry as any).location,
            },
            checkOut: null,
            timezone: entry.timezone,
            status: "checked_in",
            type: "check_in",
        };
    }

    const outEntry = entry;
    return {
        checkIn: null,
        checkOut: {
            time: outEntry.checkOutTime,
            location: outEntry.location,
        },
        timezone: outEntry.timezone,
        workHours: outEntry.workHours,
        status: "checked_out",
        type: "check_out",
    };
};

const normalizeFromAttendance = (payload: AttendanceApiData): AttendanceRecord => ({
    id: payload.id,
    date: payload.date,
    checkIn: payload.checkIn ?? null,
    checkOut: payload.checkOut ?? null,
    workHours: payload.workHours,
    status: payload.status,
    timezone: payload.timezone,
});

export async function checkIn(): Promise<AttendanceRecord> {
    const response = await apiClient.post<ApiEnvelope<CheckInApiData>>("/employees/check-in");
    return normalizeFromCheck(response.data.data);
}

export async function checkOut(): Promise<AttendanceRecord> {
    const response = await apiClient.post<ApiEnvelope<CheckOutApiData>>("/employees/check-out");
    return normalizeFromCheck(response.data.data);
}

export async function fetchAttendance(): Promise<AttendanceRecord> {
    const response = await apiClient.get<ApiEnvelope<AttendanceApiData>>("/employees/attendance");
    return normalizeFromAttendance(response.data.data);
}

export interface AttendanceHistoryResponse {
    records: AttendanceApiData[];
    summary?: {
        totalDays?: number;
        present?: number;
        absent?: number;
        late?: number;
        halfDay?: number;
        averageWorkHours?: string;
    };
    pagination?: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

export async function fetchAttendanceHistory(): Promise<AttendanceHistoryResponse> {
    const response = await apiClient.get<ApiEnvelope<AttendanceHistoryResponse>>(
        "/employees/attendance/history",
    );
    return response.data.data;
}
