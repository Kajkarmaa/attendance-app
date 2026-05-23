import {
    fetchMonthlyAttendanceGrid,
    fetchMyAttendanceGrid,
    updateAttendanceDay,
    type AttendanceDayStatus,
    type MonthlyAttendanceGridData,
    type MonthlyGridDay,
} from "@/services/attendance";
import { logger } from "@/utils/logger";
import { Feather } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

const STATUS_OPTIONS: { label: string; value: AttendanceDayStatus }[] = [
    { label: "Present", value: "present" },
    { label: "Absent", value: "absent" },
];

const statusColor = (status: AttendanceDayStatus): string => {
    switch (status) {
        case "present":
            return "#22C55E";
        case "absent":
            return "#EF4444";
        default:
            return "#E5E7EB";
    }
};

const cellColors = (day: MonthlyGridDay): { bg: string; text: string } => {
    if (day.isFuture) return { bg: "#F3F4F6", text: "#D1D5DB" };
    switch (day.status) {
        case "present":
            return { bg: "#22C55E", text: "#FFFFFF" };
        case "absent":
            return { bg: "#EF4444", text: "#FFFFFF" };
        default:
            return { bg: "#E5E7EB", text: "#6B7280" };
    }
};

const cellLabel = (day: MonthlyGridDay): string => {
    if (day.isFuture) return "";
    switch (day.status) {
        case "present":
            return "Present";
        case "absent":
            return "Absent";
        default:
            return "—";
    }
};

interface Props {
    employeeId?: string;
    /** Read-only self view for employees — no editing, fetches the caller's own grid. */
    readOnly?: boolean;
    /** Called after a successful edit so parents can refresh dependent data. */
    onChange?: () => void;
}

export default function MonthlyAttendanceGrid({
    employeeId,
    readOnly,
    onChange,
}: Props) {
    const now = new Date();
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [year, setYear] = useState(now.getFullYear());
    const [grid, setGrid] = useState<MonthlyAttendanceGridData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedDay, setSelectedDay] = useState<MonthlyGridDay | null>(null);
    const [saving, setSaving] = useState(false);

    const validEmployeeId =
        employeeId && employeeId !== "--" ? employeeId : null;

    const load = useCallback(async () => {
        if (!readOnly && !validEmployeeId) return;
        setLoading(true);
        setError(null);
        try {
            const data = readOnly
                ? await fetchMyAttendanceGrid(month, year)
                : await fetchMonthlyAttendanceGrid(
                      validEmployeeId!,
                      month,
                      year,
                  );
            setGrid(data);
        } catch (err: any) {
            setError(
                err?.response?.data?.message ||
                    err?.message ||
                    "Unable to load attendance.",
            );
        } finally {
            setLoading(false);
        }
    }, [readOnly, validEmployeeId, month, year]);

    useEffect(() => {
        load();
    }, [load]);

    const isCurrentMonth =
        year === now.getFullYear() && month === now.getMonth() + 1;

    const goPrevMonth = () => {
        if (month === 1) {
            setMonth(12);
            setYear((y) => y - 1);
        } else {
            setMonth((m) => m - 1);
        }
    };

    const goNextMonth = () => {
        if (isCurrentMonth) return; // can't view the future
        if (month === 12) {
            setMonth(1);
            setYear((y) => y + 1);
        } else {
            setMonth((m) => m + 1);
        }
    };

    const handlePickStatus = async (status: AttendanceDayStatus) => {
        if (!selectedDay || !validEmployeeId) return;
        setSaving(true);
        try {
            await updateAttendanceDay(validEmployeeId, selectedDay.date, status);
            setSelectedDay(null);
            await load();
            onChange?.();
        } catch (err: any) {
            logger.warn("update attendance day failed", err?.message || err);
            setError(
                err?.response?.data?.message ||
                    err?.message ||
                    "Unable to update attendance.",
            );
        } finally {
            setSaving(false);
        }
    };

    const days = grid?.days ?? [];
    const leadingBlanks = days.length > 0 ? days[0].weekday : 0;

    return (
        <View style={styles.card}>
            <View style={styles.headerRow}>
                <Pressable onPress={goPrevMonth} style={styles.navBtn} hitSlop={8}>
                    <Feather name="chevron-left" size={18} color="#111827" />
                </Pressable>
                <Text style={styles.monthLabel}>
                    {MONTHS[month - 1]} {year}
                </Text>
                <Pressable
                    onPress={goNextMonth}
                    style={[styles.navBtn, isCurrentMonth && styles.navBtnDisabled]}
                    disabled={isCurrentMonth}
                    hitSlop={8}
                >
                    <Feather
                        name="chevron-right"
                        size={18}
                        color={isCurrentMonth ? "#D1D5DB" : "#111827"}
                    />
                </Pressable>
            </View>

            <View style={styles.weekRow}>
                {WEEKDAYS.map((w) => (
                    <Text key={w} style={styles.weekday}>
                        {w}
                    </Text>
                ))}
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator color="#D4A537" />
                </View>
            ) : error ? (
                <View style={styles.center}>
                    <Text style={styles.errorText}>{error}</Text>
                    <Pressable onPress={load}>
                        <Text style={styles.retry}>Retry</Text>
                    </Pressable>
                </View>
            ) : (
                <View style={styles.grid}>
                    {Array.from({ length: leadingBlanks }).map((_, i) => (
                        <View key={`blank-${i}`} style={styles.cellWrap} />
                    ))}
                    {days.map((day) => {
                        const colors = cellColors(day);
                        const editable =
                            !readOnly && !day.isFuture && !day.isToday;
                        return (
                            <View key={day.date} style={styles.cellWrap}>
                                <Pressable
                                    style={[
                                        styles.cell,
                                        { backgroundColor: colors.bg },
                                        day.isToday && styles.cellToday,
                                    ]}
                                    disabled={!editable}
                                    onPress={() => setSelectedDay(day)}
                                >
                                    <Text
                                        style={[
                                            styles.cellDay,
                                            { color: colors.text },
                                        ]}
                                    >
                                        {String(day.day).padStart(2, "0")}
                                    </Text>
                                    <Text
                                        style={[
                                            styles.cellStatus,
                                            { color: colors.text },
                                        ]}
                                        numberOfLines={1}
                                    >
                                        {cellLabel(day)}
                                    </Text>
                                </Pressable>
                            </View>
                        );
                    })}
                </View>
            )}

            <View style={styles.legendRow}>
                {[
                    { c: "#22C55E", t: "Present" },
                    { c: "#EF4444", t: "Absent" },
                    { c: "#E5E7EB", t: "No record" },
                ].map((l) => (
                    <View key={l.t} style={styles.legendItem}>
                        <View
                            style={[styles.legendDot, { backgroundColor: l.c }]}
                        />
                        <Text style={styles.legendText}>{l.t}</Text>
                    </View>
                ))}
            </View>

            <Modal
                visible={!!selectedDay}
                transparent
                animationType="fade"
                onRequestClose={() => !saving && setSelectedDay(null)}
            >
                <View style={styles.modalRoot}>
                    <Pressable
                        style={styles.backdrop}
                        onPress={() => !saving && setSelectedDay(null)}
                    />
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>Mark attendance</Text>
                        <Text style={styles.modalSub}>
                            {selectedDay
                                ? `${MONTHS[month - 1]} ${selectedDay.day}, ${year}`
                                : ""}
                        </Text>
                        {STATUS_OPTIONS.map((opt) => {
                            const isActive = selectedDay?.status === opt.value;
                            return (
                                <Pressable
                                    key={opt.value}
                                    style={[
                                        styles.optionRow,
                                        isActive && styles.optionRowActive,
                                    ]}
                                    disabled={saving}
                                    onPress={() => handlePickStatus(opt.value)}
                                >
                                    <View
                                        style={[
                                            styles.optionDot,
                                            {
                                                backgroundColor: statusColor(
                                                    opt.value,
                                                ),
                                            },
                                        ]}
                                    />
                                    <Text style={styles.optionText}>
                                        {opt.label}
                                    </Text>
                                    {isActive && (
                                        <Feather
                                            name="check"
                                            size={16}
                                            color="#22C55E"
                                        />
                                    )}
                                </Pressable>
                            );
                        })}
                        {saving && (
                            <ActivityIndicator
                                style={{ marginTop: 8 }}
                                color="#D4A537"
                            />
                        )}
                        <Pressable
                            style={styles.cancelBtn}
                            disabled={saving}
                            onPress={() => setSelectedDay(null)}
                        >
                            <Text style={styles.cancelText}>Cancel</Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        width: "100%",
        backgroundColor: "#FFFFFF",
        borderRadius: 18,
        padding: 14,
        borderWidth: 1,
        borderColor: "#F2E7C2",
    },
    headerRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 12,
    },
    navBtn: {
        height: 32,
        width: 32,
        borderRadius: 16,
        backgroundColor: "#F8F6F2",
        alignItems: "center",
        justifyContent: "center",
    },
    navBtnDisabled: { backgroundColor: "#F3F4F6" },
    monthLabel: { fontSize: 14, fontWeight: "700", color: "#111827" },
    weekRow: { flexDirection: "row" },
    weekday: {
        width: `${100 / 7}%`,
        textAlign: "center",
        fontSize: 10,
        color: "#9CA3AF",
        fontWeight: "600",
        marginBottom: 6,
    },
    grid: { flexDirection: "row", flexWrap: "wrap" },
    cellWrap: { width: `${100 / 7}%`, padding: 3 },
    cell: {
        aspectRatio: 1,
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center",
    },
    cellToday: { borderWidth: 2, borderColor: "#111827" },
    cellDay: { fontSize: 13, fontWeight: "700" },
    cellStatus: { fontSize: 8, fontWeight: "600", marginTop: 1 },
    center: { paddingVertical: 28, alignItems: "center" },
    errorText: { color: "#B91C1C", fontSize: 12, marginBottom: 6 },
    retry: { color: "#D4A537", fontWeight: "700" },
    legendRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: 14,
        marginTop: 14,
    },
    legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
    legendDot: { width: 10, height: 10, borderRadius: 3 },
    legendText: { fontSize: 11, color: "#6B7280" },
    modalRoot: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 32,
    },
    backdrop: {
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,0.35)",
    },
    modalCard: {
        width: "100%",
        maxWidth: 360,
        backgroundColor: "#FFFFFF",
        borderRadius: 18,
        padding: 18,
    },
    modalTitle: { fontSize: 16, fontWeight: "800", color: "#111827" },
    modalSub: {
        fontSize: 12,
        color: "#6B7280",
        marginTop: 2,
        marginBottom: 12,
    },
    optionRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#F1F5F9",
        marginBottom: 8,
    },
    optionRowActive: { borderColor: "#D4A537", backgroundColor: "#FFFBEF" },
    optionDot: { width: 14, height: 14, borderRadius: 4 },
    optionText: { flex: 1, fontSize: 14, fontWeight: "600", color: "#111827" },
    cancelBtn: { paddingVertical: 12, alignItems: "center", marginTop: 4 },
    cancelText: { color: "#6B7280", fontWeight: "700" },
});
