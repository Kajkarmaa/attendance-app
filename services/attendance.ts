import apiClient from "./api";

export interface CheckInLocationPayload {
    locationLat: number;
    locationLng: number;
    locationCity: string;
    locationState: string;
}

export interface AttendanceLocation {
    latitude?: number;
    longitude?: number;
    city?: string;
    state?: string;
    label?: string;
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
    return parseAttendanceLocation(location)?.label;
};

const toCoordinate = (value?: number | string): number | undefined => {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }

    if (typeof value === "string") {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }

    return undefined;
};

export const parseAttendanceLocation = (
    location?: AttendanceLocationInput,
): AttendanceLocation | null => {
    if (!location) {
        return null;
    }

    if (typeof location === "string") {
        const trimmed = location.trim();
        return trimmed ? { label: trimmed } : null;
    }

    const city =
        typeof location.city === "string"
            ? location.city.trim()
            : typeof location.locationCity === "string"
              ? location.locationCity.trim()
              : undefined;
    const state =
        typeof location.state === "string"
            ? location.state.trim()
            : typeof location.locationState === "string"
              ? location.locationState.trim()
              : undefined;
    const latitude =
        toCoordinate(location.lat) ??
        toCoordinate(location.locationLat) ??
        toCoordinate(location.latitude);
    const longitude =
        toCoordinate(location.lng) ??
        toCoordinate(location.locationLng) ??
        toCoordinate(location.longitude);

    const label = [city, state].filter(Boolean).join(", ");
    if (!label && latitude === undefined && longitude === undefined) {
        return null;
    }

    return {
        latitude,
        longitude,
        city,
        state,
        label:
            label ||
            (latitude !== undefined && longitude !== undefined
                ? `${latitude}, ${longitude}`
                : undefined),
    };
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
    location: CheckInLocationPayload,
): Promise<AttendanceRecord> {
    const response = await apiClient.post<ApiEnvelope<CheckInApiData>>(
        "/employees/check-in",
        {
            locationLat: location.locationLat,
            locationLng: location.locationLng,
            locationCity: location.locationCity,
            locationState: location.locationState,
        },
    );
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
    checkOutTime?: string | null;
    status?: string;
    location?: AttendanceLocation | null;
}

interface TodayAttendanceApiItem {
    employeeId: string;
    name: string;
    email?: string;
    department?: string;
    checkInTime?: string;
    checkOutTime?: string | null;
    status?: string;
    location?: AttendanceLocationInput;
}

export async function fetchTodayAttendance(status?: string): Promise<TodayAttendanceItem[]> {
    const url = status ? `/attendance/today?status=${encodeURIComponent(status)}` : "/attendance/today";
    const response = await apiClient.get<ApiEnvelope<TodayAttendanceApiItem[]>>(url);
    return (response.data.data || []).map((item) => ({
        ...item,
        location: parseAttendanceLocation(item.location),
    }));
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

export interface DailySummaryFilters {
    /** Department name. Omit or pass "All" to skip filtering. */
    department?: string;
    /** ISO date string (YYYY-MM-DD). Defaults to today on the server. */
    date?: string;
}

export async function fetchDailySummary(
    filters: DailySummaryFilters = {},
): Promise<DailyAttendanceSummary> {
    const params: Record<string, string> = {};
    if (filters.date) params.date = filters.date;
    if (filters.department && filters.department !== "All") {
        params.department = filters.department;
    }
    const response = await apiClient.get<ApiEnvelope<DailyAttendanceSummary>>(
        "/attendance/daily-summary",
        { params },
    );
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

export type AttendanceDayStatus = "present" | "half_day" | "absent";

export interface MonthlyGridDay {
    /** ISO calendar date, YYYY-MM-DD. */
    date: string;
    day: number;
    /** 0 = Sunday … 6 = Saturday. */
    weekday: number;
    isWorkingDay: boolean;
    isToday: boolean;
    isFuture: boolean;
    status: AttendanceDayStatus | null;
    checkIn: string | null;
    checkOut: string | null;
    workHours: number | null;
}

export interface MonthlyAttendanceGridData {
    employeeId?: string;
    month: number;
    year: number;
    days: MonthlyGridDay[];
    summary: {
        present: number;
        halfDay: number;
        absent: number;
        workingDays: number;
    };
}

/** Admin: monthly grid for a specific employee. */
export async function fetchMonthlyAttendanceGrid(
    employeeId: string,
    month: number,
    year: number,
): Promise<MonthlyAttendanceGridData> {
    const response = await apiClient.get<ApiEnvelope<MonthlyAttendanceGridData>>(
        `/attendance/monthly-grid/${encodeURIComponent(employeeId)}`,
        { params: { month, year } },
    );
    return response.data.data;
}

/** Employee: monthly grid for the logged-in user (read-only self view). */
export async function fetchMyAttendanceGrid(
    month: number,
    year: number,
): Promise<MonthlyAttendanceGridData> {
    const response = await apiClient.get<ApiEnvelope<MonthlyAttendanceGridData>>(
        "/employees/attendance/monthly-grid",
        { params: { month, year } },
    );
    return response.data.data;
}

export async function updateAttendanceDay(
    employeeId: string,
    date: string,
    status: AttendanceDayStatus,
): Promise<{ employeeId: string; date: string; status: AttendanceDayStatus }> {
    const response = await apiClient.put<
        ApiEnvelope<{ employeeId: string; date: string; status: AttendanceDayStatus }>
    >(`/attendance/${encodeURIComponent(employeeId)}/day`, { date, status });
    return response.data.data;
}
