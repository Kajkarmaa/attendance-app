import { useAuth } from "@/contexts/AuthContext";
import { fetchLeaveBalance, requestLeave, type LeaveBalanceData } from "@/services/leaves";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, {
    DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import * as DocumentPicker from "expo-document-picker";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View
} from "react-native";
import { Calendar, type DateData } from "react-native-calendars";

type MarkedDates = {
    [key: string]: {
        startingDay?: boolean;
        endingDay?: boolean;
        color?: string;
        textColor?: string;
    };
};

const formatTypeLabel = (value: string) => {
    if (!value) return "Select";
    const normalized = value.replace(/[_-]+/g, " ").trim();
    if (!normalized) return "Select";
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

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
    const [attachment, setAttachment] = useState<DocumentPicker.DocumentPickerAsset | null>(null);

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

    const formatDateValue = (iso: string, includeYear = false) =>
        new Date(iso).toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
            ...(includeYear ? { year: "numeric" } : {}),
        });

    const setStartAndClampEnd = (iso: string) => {
        setStartDate(iso);
        setEndDate((prev) => (prev < iso ? iso : prev));
    };

    const setEndAndClampStart = (iso: string) => {
        setEndDate(iso);
        setStartDate((prev) => (prev > iso ? iso : prev));
    };

    const handleDaySelect = (iso: string) => {
        if (!startDate || iso <= startDate) {
            setStartAndClampEnd(iso);
            return;
        }
        setEndAndClampStart(iso);
    };

    const handleDateChange = (
        event: DateTimePickerEvent,
        kind: "start" | "end",
        closePicker: () => void,
    ) => {
        if (event.type === "set" && event.nativeEvent.timestamp) {
            const iso = new Date(event.nativeEvent.timestamp).toISOString().slice(0, 10);
            if (kind === "start") {
                setStartAndClampEnd(iso);
            } else {
                setEndAndClampStart(iso);
            }
        }
        if (Platform.OS !== "ios") {
            closePicker();
        }
    };

    const handlePickAttachment = async () => {
        const result = await DocumentPicker.getDocumentAsync({
            multiple: false,
            copyToCacheDirectory: true,
            type: ["application/pdf", "image/*", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
            const file = result.assets[0];
            setAttachment({
                ...file,
                name: file.name ?? "attachment",
                mimeType: file.mimeType ?? "application/octet-stream",
            });
        }
    };

    const markedDates = useMemo<MarkedDates>(() => {
        if (!startDate || !endDate) return {};
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return {};

        const result: MarkedDates = {};
        const cursor = new Date(start);

        while (cursor <= end) {
            const iso = cursor.toISOString().slice(0, 10);
            const isStart = iso === startDate;
            const isEnd = iso === endDate;
            result[iso] = {
                startingDay: isStart,
                endingDay: isEnd,
                color: isStart || isEnd ? "#D4A537" : "#F6E9C2",
                textColor: isStart || isEnd ? "#FFFFFF" : "#111827",
            };
            cursor.setDate(cursor.getDate() + 1);
        }

        return result;
    }, [startDate, endDate]);

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
                attachment: attachment
                    ? {
                        uri: attachment.uri,
                        name: attachment.name ?? "attachment",
                        type: attachment.mimeType ?? "application/octet-stream",
                    }
                    : undefined,
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
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
        >
            <ScrollView
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
            >
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
                    <Text style={styles.calendarHint}>Select start and end dates</Text>
                    <Calendar
                        markingType="period"
                        markedDates={markedDates}
                        onDayPress={(day: DateData) => handleDaySelect(day.dateString)}
                        enableSwipeMonths
                        firstDay={1}
                        theme={{
                            todayTextColor: "#D4A537",
                            arrowColor: "#D4A537",
                            selectedDayBackgroundColor: "#D4A537",
                            textDayFontWeight: "600",
                            textMonthFontWeight: "700",
                        }}
                    />

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
                    <View style={styles.pickerContainer}>
                        <DateTimePicker
                            value={new Date(startDate)}
                            mode="date"
                            display="spinner"
                            onChange={(event: DateTimePickerEvent) =>
                                handleDateChange(event, "start", () => setShowStartPicker(false))
                            }
                        />
                        <Pressable
                            style={styles.pickerCloseBtn}
                            onPress={() => setShowStartPicker(false)}
                        >
                            <Text style={styles.pickerCloseText}>Close</Text>
                        </Pressable>
                    </View>
                )}

                {showEndPicker && (
                    <View style={styles.pickerContainer}>
                        <DateTimePicker
                            value={new Date(endDate)}
                            mode="date"
                            display="spinner"
                            onChange={(event: DateTimePickerEvent) =>
                                handleDateChange(event, "end", () => setShowEndPicker(false))
                            }
                        />
                        <Pressable
                            style={styles.pickerCloseBtn}
                            onPress={() => setShowEndPicker(false)}
                        >
                            <Text style={styles.pickerCloseText}>Close</Text>
                        </Pressable>
                    </View>
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

                <Pressable style={styles.attachmentRow} onPress={handlePickAttachment}>
                    <Ionicons name="add-circle-outline" size={18} color="#D4A537" />
                    <Text style={styles.attachmentText}>Add supporting documentation</Text>
                    <Ionicons name="add" size={18} color="#D4A537" />
                </Pressable>

                {attachment && (
                    <View style={styles.attachmentChip}>
                        <View style={styles.attachmentInfo}>
                            <Ionicons name="document-attach-outline" size={16} color="#6B7280" />
                            <Text style={styles.attachmentName} numberOfLines={1}>
                                {attachment.name || "Selected file"}
                            </Text>
                        </View>
                        <Pressable onPress={() => setAttachment(null)}>
                            <Ionicons name="close" size={16} color="#9CA3AF" />
                        </Pressable>
                    </View>
                )}

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
        </KeyboardAvoidingView>
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
    calendarHint: {
        color: "#9CA3AF",
        fontSize: 12,
        marginBottom: 12,
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
    attachmentChip: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#E5E7EB",
        backgroundColor: "#FFFFFF",
        marginBottom: 20,
    },
    attachmentInfo: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        flex: 1,
    },
    attachmentName: {
        color: "#111827",
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
    pickerContainer: {
        marginTop: 4,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: "#E5E7EB",
        borderRadius: 12,
        backgroundColor: "#FFFFFF",
        padding: 8,
    },
    pickerCloseBtn: {
        marginTop: 4,
        alignSelf: "flex-end",
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
        backgroundColor: "#F3F4F6",
    },
    pickerCloseText: {
        color: "#111827",
        fontWeight: "600",
    },
});
