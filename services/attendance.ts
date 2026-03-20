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
    totalWorkingDays?: number;
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
    totalWorkingDays?: number;
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
    totalWorkingDays: payload.totalWorkingDays,
});

export async function checkIn(image?: { uri: string; name?: string; type?: string } | null): Promise<AttendanceRecord> {
    if (image) {
        const form = new FormData();
        form.append(
            "image",
            // React Native / Expo expects an object with uri, name and type
            {
                uri: image.uri,
                name: image.name ?? "photo.jpg",
                type: image.type ?? "image/jpeg",
            } as any,
        );

        const response = await apiClient.post<ApiEnvelope<CheckInApiData>>("/employees/check-in", form, {
            headers: { "Content-Type": "multipart/form-data" },
        });

        return normalizeFromCheck(response.data.data);
    }

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

export interface TodayAttendanceItem {
    employeeId: string;
    name: string;
    email?: string;
    department?: string;
    checkInTime?: string;
    hasCheckInImage?: boolean;
    status?: string;
}

export async function fetchTodayAttendance(status?: string): Promise<TodayAttendanceItem[]> {
    const url = status ? `/attendance/today?status=${encodeURIComponent(status)}` : "/attendance/today";
    const response = await apiClient.get<ApiEnvelope<TodayAttendanceItem[]>>(url);
    return response.data.data || [];
}

export async function fetchCheckinImageUrl(employeeId: string): Promise<string | null> {
    try {
        const url = `/attendance/checkin-image?employeeId=${encodeURIComponent(employeeId)}`;
        const response = await apiClient.get<ApiEnvelope<{ url?: string }>>(url);
        return response.data?.data?.url ?? null;
    } catch (err) {
        console.log("fetchCheckinImageUrl failed", err);
        return null;
    }
}

export interface EmployeeAttendanceImageResponse {
    employeeId: string;
    attendanceId?: string;
    imageUrl?: string;
    checkInTime?: string;
}

export async function fetchEmployeeAttendanceImage(employeeId: string): Promise<EmployeeAttendanceImageResponse | null> {
    try {
        const url = `/attendance/employee/${encodeURIComponent(employeeId)}/image`;
        const response = await apiClient.get<ApiEnvelope<EmployeeAttendanceImageResponse>>(url);
        return response.data?.data ?? null;
    } catch (err) {
        console.log("fetchEmployeeAttendanceImage failed", err);
        return null;
    }
}

export interface DailyAttendanceSummary {
    date: string;
    totalEmployees: number;
    totalCheckedIn: number;
    totalCheckedOut: number;
    staffPresent: number;
    staffAbsent: number;
    staffOnLeave: number;
    attendanceRate: number;
    averageWorkHours: number;
}

export async function fetchDailySummary(): Promise<DailyAttendanceSummary> {
    const response = await apiClient.get<ApiEnvelope<DailyAttendanceSummary>>("/attendance/daily-summary");
    return response.data.data;
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
