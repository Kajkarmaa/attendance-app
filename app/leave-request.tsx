import { useAuth } from "@/contexts/AuthContext";
import { fetchLeaveBalance, requestLeave, type LeaveBalanceData } from "@/services/leaves";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, {
    DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

const formatTypeLabel = (value: string) => {
    if (!value) return "Select";
    const normalized = value.replace(/[_-]+/g, " ").trim();
    if (!normalized) return "Select";
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const defaultStart = "2026-02-18";
const defaultEnd = "2026-02-19";

export default function LeaveRequestScreen() {
    const { user, isLoading } = useAuth();
    const [leaveType, setLeaveType] = useState<string>("");
    const [showCategory, setShowCategory] = useState(false);
    const [leaveBalance, setLeaveBalance] = useState<LeaveBalanceData | null>(null);
    const [leaveBalanceLoading, setLeaveBalanceLoading] = useState(false);
    const [startDate, setStartDate] = useState(defaultStart);
    const [endDate, setEndDate] = useState(defaultEnd);
    const [reason, setReason] = useState("Medical appointment and recovery");
    const [submitting, setSubmitting] = useState(false);
    const [showStartPicker, setShowStartPicker] = useState(false);
    const [showEndPicker, setShowEndPicker] = useState(false);
    const [visibleMonth, setVisibleMonth] = useState(() => {
        const next = new Date(defaultStart);
        next.setDate(1);
        return next;
    });

    useEffect(() => {
        if (isLoading) return;
        if (!user) {
            router.replace("/");
            return;
        }
        if (user.role !== "emp") {
            router.replace("/admin");
            return;
        }

        loadLeaveBalance();
    }, [isLoading, user]);

    const loadLeaveBalance = async () => {
        setLeaveBalanceLoading(true);
        try {
            const data = await fetchLeaveBalance();
            setLeaveBalance(data);
            const keys = Object.keys(data?.byType ?? {});
            if (keys.length > 0 && (!leaveType || !keys.includes(leaveType))) {
                setLeaveType(keys[0]);
            }
        } catch (err: any) {
            console.log("leave balance fetch failed", err?.message);
            setLeaveBalance(null);
        } finally {
            setLeaveBalanceLoading(false);
        }
    };

    const leaveTypeOptions = useMemo(() => {
        const entries = Object.entries(leaveBalance?.byType ?? {});
        // Keep stable order if backend already provides it; otherwise sort with remaining desc.
        return entries.map(([type, values]) => ({
            type,
            remaining: values?.remaining ?? 0,
            total: values?.total ?? 0,
            used: values?.used ?? 0,
        }));
    }, [leaveBalance]);

    const selectedTypeLabel = useMemo(() => formatTypeLabel(leaveType), [leaveType]);

    const durationLabel = useMemo(() => {
        if (!startDate || !endDate) return "";
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diff = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
        return `${diff} Business Days`;
    }, [startDate, endDate]);

    const rangeLabel = useMemo(() => {
        const format = (iso: string) =>
            new Date(iso).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
            });
        return `${format(startDate)} - ${format(endDate)}`;
    }, [startDate, endDate]);

    const monthLabel = useMemo(() => {
        return visibleMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    }, [visibleMonth]);

    const calendarDays = useMemo(() => {
        const firstOfMonth = new Date(visibleMonth);
        firstOfMonth.setDate(1);
        const startOffset = firstOfMonth.getDay();
        const start = new Date(firstOfMonth);
        start.setDate(firstOfMonth.getDate() - startOffset);

        return Array.from({ length: 42 }, (_, idx) => {
            const date = new Date(start);
            date.setDate(start.getDate() + idx);
            return {
                date,
                iso: date.toISOString().slice(0, 10),
                isCurrentMonth: date.getMonth() === visibleMonth.getMonth(),
            };
        });
    }, [visibleMonth]);

    const formatDateValue = (iso: string, includeYear = false) =>
        new Date(iso).toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
            ...(includeYear ? { year: "numeric" } : {}),
        });

    const changeMonth = (delta: number) => {
        const next = new Date(visibleMonth);
        next.setMonth(visibleMonth.getMonth() + delta);
        setVisibleMonth(next);
    };

    const handleDaySelect = (iso: string) => {
        if (!startDate || iso <= startDate) {
            setStartDate(iso);
            if (iso > endDate) {
                setEndDate(iso);
            }
            return;
        }
        setEndDate(iso);
    };

    const handleDateChange = (
        event: DateTimePickerEvent,
        setter: (value: string) => void,
        closePicker: () => void,
    ) => {
        if (event.type === "set" && event.nativeEvent.timestamp) {
            const iso = new Date(event.nativeEvent.timestamp).toISOString().slice(0, 10);
            setter(iso);
        }
        if (Platform.OS !== "ios") {
            closePicker();
        }
    };

    const handleSubmit = async () => {
        if (!leaveType || !startDate || !endDate || !reason.trim()) {
            Alert.alert("Missing info", "Please complete all fields before submitting.");
            return;
        }

        setSubmitting(true);
        try {
            const response = await requestLeave({
                type: leaveType,
                startDate,
                endDate,
                reason: reason.trim(),
            });

            if (response.success) {
                Alert.alert("Submitted", response.message || "Leave request sent.");
                router.replace("/leave");
            } else {
                Alert.alert("Failed", response.message || "Could not submit leave request.");
            }
        } catch (err: any) {
            const msg = err.response?.data?.message || err.message || "Something went wrong";
            Alert.alert("Error", msg);
        } finally {
            setSubmitting(false);
        }
    };

    if (isLoading || !user || user.role !== "emp") {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#D4A537" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.headerRow}>
                    <Pressable
                        style={styles.headerIcon}
                        onPress={() => router.replace("/leave")}
                    >
                        <Ionicons name="chevron-back" size={22} color="#111827" />
                    </Pressable>
                    <Text style={styles.headerTitle}>New Leave Request</Text>
                    <View style={styles.headerDots}>
                        <Ionicons name="ellipsis-horizontal" size={20} color="#111827" />
                    </View>
                </View>

                <Text style={styles.sectionLabel}>Jewelry House Administration</Text>
                <Text style={styles.sectionTitle}>Absence Details</Text>

                <View style={styles.card}>
                    <Text style={styles.cardLabel}>Leave Category</Text>
                    <Pressable
                        style={styles.selector}
                        onPress={() => setShowCategory((v) => !v)}
                    >
                        <Text style={styles.selectorValue}>
                            {leaveBalanceLoading ? "Loading…" : selectedTypeLabel}
                        </Text>
                        <Ionicons name={showCategory ? "chevron-up" : "chevron-down"} size={18} color="#9CA3AF" />
                    </Pressable>
                    {showCategory && (
                        <View style={styles.dropdown}>
                            {leaveBalanceLoading ? (
                                <View style={styles.dropdownItem}>
                                    <Text style={styles.dropdownText}>Loading leave types…</Text>
                                </View>
                            ) : leaveTypeOptions.length === 0 ? (
                                <View style={styles.dropdownItem}>
                                    <Text style={styles.dropdownText}>No leave types available</Text>
                                </View>
                            ) : (
                                leaveTypeOptions.map((item) => (
                                    <Pressable
                                        key={item.type}
                                        style={styles.dropdownItem}
                                        onPress={() => {
                                            setLeaveType(item.type);
                                            setShowCategory(false);
                                        }}
                                    >
                                        <View style={styles.dropdownRow}>
                                            <Text style={styles.dropdownText}>{formatTypeLabel(item.type)}</Text>
                                            <Text style={styles.dropdownMeta}>{item.remaining} left</Text>
                                        </View>
                                    </Pressable>
                                ))
                            )}
                        </View>
                    )}
                </View>

                <View style={styles.card}>
                    <View style={styles.calendarHeader}>
                        <Pressable style={styles.navBtn} onPress={() => changeMonth(-1)}>
                            <Ionicons name="chevron-back" size={18} color="#D4A537" />
                        </Pressable>
                        <Text style={styles.calendarTitle}>{monthLabel}</Text>
                        <Pressable style={styles.navBtn} onPress={() => changeMonth(1)}>
                            <Ionicons name="chevron-forward" size={18} color="#D4A537" />
                        </Pressable>
                    </View>
                    <Text style={styles.calendarHint}>Select start and end dates</Text>

                    <View style={styles.weekdayRow}>
                        {weekdayLabels.map((label) => (
                            <Text key={label} style={styles.weekdayLabel}>
                                {label}
                            </Text>
                        ))}
                    </View>

                    <View style={styles.daysGrid}>
                        {calendarDays.map(({ date, iso, isCurrentMonth }) => {
                            const isStart = iso === startDate;
                            const isEnd = iso === endDate;
                            const inRange = iso > startDate && iso < endDate;

                            return (
                                <View key={`${iso}-${isCurrentMonth ? "m" : "o"}`} style={styles.dayCell}>
                                    {(inRange || (isStart && !isEnd) || (isEnd && !isStart)) && (
                                        <View
                                            style={[
                                                styles.rangeFill,
                                                inRange && styles.rangeFillActive,
                                                isStart && !isEnd && styles.rangeFillStart,
                                                isEnd && !isStart && styles.rangeFillEnd,
                                            ]}
                                        />
                                    )}

                                    <Pressable
                                        style={[styles.dayButton, (isStart || isEnd) && styles.dayButtonSelected]}
                                        onPress={() => handleDaySelect(iso)}
                                    >
                                        <Text
                                            style={[
                                                styles.dayText,
                                                !isCurrentMonth && styles.dayTextMuted,
                                                (isStart || isEnd) && styles.dayTextSelected,
                                            ]}
                                        >
                                            {date.getDate()}
                                        </Text>
                                    </Pressable>
                                </View>
                            );
                        })}
                    </View>

                    <View style={styles.dateRow}>
                        <Pressable
                            style={styles.dateInput}
                            onPress={() => setShowStartPicker(true)}
                        >
                            <Text style={styles.dateLabel}>Start Date</Text>
                            <Text style={styles.dateValue}>{formatDateValue(startDate, true)}</Text>
                        </Pressable>
                        <Pressable
                            style={styles.dateInput}
                            onPress={() => setShowEndPicker(true)}
                        >
                            <Text style={styles.dateLabel}>End Date</Text>
                            <Text style={styles.dateValue}>{formatDateValue(endDate, true)}</Text>
                        </Pressable>
                    </View>

                    <View style={styles.summaryRow}>
                        <View>
                            <Text style={styles.summaryLabel}>Duration</Text>
                            <Text style={styles.summaryValue}>{rangeLabel}</Text>
                        </View>
                        <View>
                            <Text style={styles.summaryLabel}>Total</Text>
                            <Text style={styles.summaryValue}>{durationLabel}</Text>
                        </View>
                    </View>
                </View>

                {showStartPicker && (
                    <DateTimePicker
                        value={new Date(startDate)}
                        mode="date"
                        display="spinner"
                        onChange={(event :any) =>
                            handleDateChange(event, setStartDate, () => setShowStartPicker(false))
                        }
                    />
                )}

                {showEndPicker && (
                    <DateTimePicker
                        value={new Date(endDate)}
                        mode="date"
                        display="spinner"
                        onChange={(event :any) =>
                            handleDateChange(event, setEndDate, () => setShowEndPicker(false))
                        }
                    />
                )}

                <View style={styles.card}>
                    <View style={styles.reasonHeader}>
                        <Text style={styles.cardLabel}>Reason for Request</Text>
                        <Text style={styles.optional}>Optional</Text>
                    </View>
                    <TextInput
                        style={styles.textArea}
                        multiline
                        placeholder="Please describe the nature of your absence..."
                        placeholderTextColor="#9CA3AF"
                        value={reason}
                        onChangeText={setReason}
                    />
                </View>

                <Pressable style={styles.attachmentRow}>
                    <Ionicons name="add-circle-outline" size={18} color="#D4A537" />
                    <Text style={styles.attachmentText}>Add supporting documentation</Text>
                    <Ionicons name="add" size={18} color="#D4A537" />
                </Pressable>

                <Pressable
                    style={styles.submitBtn}
                    onPress={handleSubmit}
                    disabled={submitting}
                >
                    {submitting ? (
                        <ActivityIndicator color="#FFFFFF" />
                    ) : (
                        <Text style={styles.submitText}>Submit Application</Text>
                    )}
                </Pressable>

                <Pressable
                    style={styles.discardBtn}
                    onPress={() => router.replace("/leave")}
                >
                    <Text style={styles.discardText}>Discard Draft</Text>
                </Pressable>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F6F4EF",
    },
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#F6F4EF",
    },
    content: {
        paddingHorizontal: 18,
        paddingTop: 28,
        paddingBottom: 60,
    },
    headerRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 20,
    },
    headerIcon: {
        height: 38,
        width: 38,
        borderRadius: 12,
        backgroundColor: "#FFFFFF",
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#000000",
        shadowOpacity: 0.04,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 2,
    },
    headerTitle: {
        fontSize: 18,
        color: "#1F2937",
        fontWeight: "700",
    },
    headerDots: {
        height: 38,
        width: 38,
        borderRadius: 12,
        backgroundColor: "#FFFFFF",
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#000000",
        shadowOpacity: 0.04,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 2,
    },
    sectionLabel: {
        color: "#A78B5C",
        fontSize: 10,
        letterSpacing: 1.2,
        textTransform: "uppercase",
        marginBottom: 6,
    },
    sectionTitle: {
        color: "#111827",
        fontSize: 20,
        fontWeight: "700",
        marginBottom: 16,
    },
    card: {
        backgroundColor: "#FFFFFF",
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: "#F1F5F9",
        marginBottom: 16,
    },
    cardLabel: {
        color: "#6B7280",
        fontSize: 11,
        letterSpacing: 1,
        textTransform: "uppercase",
        marginBottom: 8,
    },
    selector: {
        height: 48,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#E5E7EB",
        paddingHorizontal: 14,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    selectorValue: {
        color: "#111827",
        fontSize: 14,
    },
    dropdown: {
        marginTop: 8,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#E5E7EB",
        backgroundColor: "#FFFFFF",
        overflow: "hidden",
    },
    dropdownItem: {
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    dropdownText: {
        color: "#111827",
        fontSize: 14,
    },
    dropdownRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
    },
    dropdownMeta: {
        color: "#9CA3AF",
        fontSize: 12,
    },
    calendarHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 10,
    },
    navBtn: {
        height: 32,
        width: 32,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: "#F3E9D4",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#FEF8EF",
    },
    calendarTitle: {
        fontSize: 14,
        fontWeight: "700",
        color: "#111827",
    },
    calendarHint: {
        color: "#9CA3AF",
        fontSize: 12,
        marginBottom: 12,
    },
    weekdayRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 8,
        paddingHorizontal: 4,
    },
    weekdayLabel: {
        width: `${100 / 7}%`,
        textAlign: "center",
        color: "#9CA3AF",
        fontSize: 11,
        letterSpacing: 0.3,
    },
    daysGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        rowGap: 6,
        columnGap: 6,
        marginBottom: 14,
    },
    dayCell: {
        width: `${100 / 7}%`,
        aspectRatio: 1,
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
    },
    rangeFill: {
        position: "absolute",
        top: "28%",
        bottom: "28%",
        left: 0,
        right: 0,
        backgroundColor: "#FEF4D6",
        borderRadius: 10,
        pointerEvents: "none",
    },
    rangeFillActive: {
        backgroundColor: "#FEF4D6",
    },
    rangeFillStart: {
        left: "50%",
        borderTopLeftRadius: 0,
        borderBottomLeftRadius: 0,
    },
    rangeFillEnd: {
        right: "50%",
        borderTopRightRadius: 0,
        borderBottomRightRadius: 0,
    },
    dayButton: {
        height: 36,
        width: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
    },
    dayButtonSelected: {
        backgroundColor: "#D4A537",
        shadowColor: "#D4A537",
        shadowOpacity: 0.15,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 3,
    },
    dayText: {
        color: "#111827",
        fontSize: 13,
        fontWeight: "600",
    },
    dayTextMuted: {
        color: "#D1D5DB",
    },
    dayTextSelected: {
        color: "#FFFFFF",
    },
    dateRow: {
        flexDirection: "row",
        gap: 10,
        marginBottom: 12,
    },
    dateInput: {
        flex: 1,
        borderWidth: 1,
        borderColor: "#E5E7EB",
        borderRadius: 12,
        padding: 12,
        backgroundColor: "#F8FAFC",
    },
    dateLabel: {
        color: "#9CA3AF",
        fontSize: 11,
        textTransform: "uppercase",
        letterSpacing: 1,
        marginBottom: 4,
    },
    dateValue: {
        color: "#111827",
        fontSize: 14,
        fontWeight: "600",
    },
    summaryRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        backgroundColor: "#FDFBF7",
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: "#F3E9D4",
    },
    summaryLabel: {
        color: "#9CA3AF",
        fontSize: 11,
        textTransform: "uppercase",
        letterSpacing: 1,
    },
    summaryValue: {
        color: "#111827",
        fontSize: 14,
        fontWeight: "700",
        marginTop: 4,
    },
    reasonHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 8,
    },
    optional: {
        color: "#9CA3AF",
        fontSize: 11,
    },
    textArea: {
        minHeight: 110,
        borderWidth: 1,
        borderColor: "#E5E7EB",
        borderRadius: 12,
        padding: 12,
        textAlignVertical: "top",
        color: "#111827",
        backgroundColor: "#FDFBF7",
    },
    attachmentRow: {
        marginTop: 8,
        marginBottom: 20,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    attachmentText: {
        color: "#6B7280",
        fontSize: 13,
        flex: 1,
    },
    submitBtn: {
        backgroundColor: "#D4A537",
        borderRadius: 14,
        paddingVertical: 14,
        alignItems: "center",
        shadowColor: "#D4A537",
        shadowOpacity: 0.25,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 8 },
        elevation: 6,
    },
    submitText: {
        color: "#FFFFFF",
        fontWeight: "700",
        letterSpacing: 1,
        textTransform: "uppercase",
    },
    discardBtn: {
        marginTop: 14,
        alignItems: "center",
    },
    discardText: {
        color: "#6B7280",
        fontSize: 12,
    },
});
