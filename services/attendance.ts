import { logger } from "@/utils/logger";
import apiClient from "./api";

export interface CheckInLocationPayload {
    locationLat: number;
    locationLng: number;
    locationCity: string;
    locationState: string;
}

type AttendanceLocationInput =
    | string
    | {
          lat?: number | string;
          lng?: number | string;
          city?: string;
          state?: string;
          locationLat?: number | string;
          locationLng?: number | string;
          locationCity?: string;
          locationState?: string;
          latitude?: number | string;
          longitude?: number | string;
      }
    | null
    | undefined;

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
    breakInfo?: {
        isOnBreak: boolean;
        currentBreakStartedAt?: string | null;
        totalBreakMinutes?: number;
        breaks: Array<{
            pausedAt?: string | null;
            resumedAt?: string | null;
        }>;
    };
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
        location?: AttendanceLocationInput;
    };
    employee?: { employeeId?: string };
}

interface CheckOutApiData {
    attendance: {
        type: "check_out";
        checkOutTime: string;
        timezone?: string;
        location?: AttendanceLocationInput;
        workHours?: number;
    };
    employee?: { employeeId?: string };
}

interface AttendanceApiData {
    id?: string;
    date?: string;
    checkIn?: {
        time: string;
        location?: AttendanceLocationInput;
    };
    checkOut?: {
        time: string;
        location?: AttendanceLocationInput;
    };
    workHours?: number;
    status?: string;
    timezone?: string;
    totalWorkingDays?: number;
    breakInfo?: {
        isOnBreak?: boolean;
        currentBreakStartedAt?: string | null;
        totalBreakMinutes?: number;
        breaks?: Array<{
            pausedAt?: string | null;
            resumedAt?: string | null;
        }>;
    };
}

interface BreakActionApiData {
    attendance?: AttendanceApiData;
    id?: string;
    date?: string;
    checkIn?: {
        time: string;
        location?: AttendanceLocationInput;
    };
    checkOut?: {
        time: string;
        location?: AttendanceLocationInput;
    };
    workHours?: number;
    status?: string;
    timezone?: string;
    totalWorkingDays?: number;
    breakInfo?: AttendanceApiData["breakInfo"];
}

const normalizeLocation = (
    location?: AttendanceLocationInput,
): string | undefined => {
    if (!location) {
        return undefined;
    }

    if (typeof location === "string") {
        const trimmed = location.trim();
        return trimmed || undefined;
    }

    const city =
        typeof location.city === "string"
            ? location.city.trim()
            : typeof location.locationCity === "string"
              ? location.locationCity.trim()
              : "";
    const state =
        typeof location.state === "string"
            ? location.state.trim()
            : typeof location.locationState === "string"
              ? location.locationState.trim()
              : "";

    const label = [city, state].filter(Boolean).join(", ");
    if (label) {
        return label;
    }

    const lat =
        location.lat ?? location.locationLat ?? location.latitude ?? undefined;
    const lng =
        location.lng ?? location.locationLng ?? location.longitude ?? undefined;

    if (lat !== undefined && lng !== undefined) {
        return `${lat}, ${lng}`;
    }

    return undefined;
};

const normalizeCheckpoint = <T extends { time: string; location?: AttendanceLocationInput }>(
    checkpoint?: T | null,
): { time: string; location?: string } | null => {
    if (!checkpoint) {
        return null;
    }

    return {
        time: checkpoint.time,
        location: normalizeLocation(checkpoint.location),
    };
};

export const sanitizeAttendanceRecord = (
    record?: AttendanceRecord | null,
): AttendanceRecord | null => {
    if (!record) {
        return null;
    }

    return {
        ...record,
        checkIn: normalizeCheckpoint(record.checkIn),
        checkOut: normalizeCheckpoint(record.checkOut),
    };
};

const normalizeFromCheck = (payload: CheckInApiData | CheckOutApiData): AttendanceRecord => {
    const entry = payload.attendance;
    if (!entry) return {};

    if (entry.type === "check_in") {
        return {
            checkIn: {
                time: entry.checkInTime,
                location: normalizeLocation((entry as any).location),
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
            location: normalizeLocation(outEntry.location),
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
    checkIn: normalizeCheckpoint(payload.checkIn),
    checkOut: normalizeCheckpoint(payload.checkOut),
    workHours: payload.workHours,
    status: payload.status,
    timezone: payload.timezone,
    totalWorkingDays: payload.totalWorkingDays,
    breakInfo: {
        isOnBreak: Boolean(payload.breakInfo?.isOnBreak),
        currentBreakStartedAt: payload.breakInfo?.currentBreakStartedAt ?? null,
        totalBreakMinutes: payload.breakInfo?.totalBreakMinutes ?? 0,
        breaks: payload.breakInfo?.breaks ?? [],
    },
});

const normalizeBreakAction = (payload: BreakActionApiData): AttendanceRecord => {
    const source = payload.attendance ?? payload;
    return {
        id: source.id,
        date: source.date,
        checkIn: normalizeCheckpoint(source.checkIn),
        checkOut: normalizeCheckpoint(source.checkOut),
        workHours: source.workHours,
        status: source.status,
        timezone: source.timezone,
        totalWorkingDays: source.totalWorkingDays,
        breakInfo: source.breakInfo
            ? {
                  isOnBreak: Boolean(source.breakInfo.isOnBreak),
                  currentBreakStartedAt:
                      source.breakInfo.currentBreakStartedAt ?? null,
                  totalBreakMinutes: source.breakInfo.totalBreakMinutes ?? 0,
                  breaks: source.breakInfo.breaks ?? [],
              }
            : undefined,
    };
};

export async function checkIn(
    image?: { uri: string; name?: string; type?: string } | null,
    location?: CheckInLocationPayload | null,
): Promise<AttendanceRecord> {
    if (image || location) {
        const form = new FormData();

        if (image) {
            form.append(
                "image",
                // React Native / Expo expects an object with uri, name and type
                {
                    uri: image.uri,
                    name: image.name ?? "photo.jpg",
                    type: image.type ?? "image/jpeg",
                } as any,
            );
        }

        if (location) {
            form.append("locationLat", String(location.locationLat));
            form.append("locationLng", String(location.locationLng));
            form.append("locationCity", location.locationCity);
            form.append("locationState", location.locationState);
        }

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

export async function pauseAttendance(): Promise<AttendanceRecord> {
    const response = await apiClient.post<ApiEnvelope<BreakActionApiData>>("/employees/pause");
    return normalizeBreakAction(response.data.data);
}

export async function resumeAttendance(): Promise<AttendanceRecord> {
    const response = await apiClient.post<ApiEnvelope<BreakActionApiData>>("/employees/resume");
    return normalizeBreakAction(response.data.data);
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
        logger.warn("fetchCheckinImageUrl failed", err);
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
        logger.warn("fetchEmployeeAttendanceImage failed", err);
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
