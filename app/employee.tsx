import { useAuth } from "@/contexts/AuthContext";
import { EmployeeActivity, fetchRecentActivity, RecentActivityData } from "@/services/activity";
import {
    checkIn,
    checkOut,
    fetchAttendance,
    type AttendanceRecord,
} from "@/services/attendance";
import { getPayslipDownloadUrl } from "@/services/payroll";
import { fetchEmployeeProfile, type EmployeeProfile } from "@/services/profile";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Linking,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

const ACTIVITY_COLOR_MAP: Record<string, string> = {
    attendance: "#34D399",
    present: "#34D399",
    payroll: "#FBBF24",
    salary: "#FBBF24",
    remote: "#60A5FA",
    wfh: "#60A5FA",
    leave: "#60A5FA",
    warning: "#FB7185",
    alert: "#FB7185",
};
const DEFAULT_ACTIVITY_COLOR = "#94A3B8";

interface PayslipEntry {
    id: string;
    monthLabel: string;
    detail: string;
    canDownload: boolean;
    buttonLabel: string;
    month?: number | null;
    year?: number | null;
}

export default function EmployeeDashboardScreen() {
    const { user, isLoading, logout } = useAuth();
    const [attendance, setAttendance] = useState<AttendanceRecord | null>(null);
    const [attLoading, setAttLoading] = useState(false);
    const [punching, setPunching] = useState(false);
    const [profile, setProfile] = useState<EmployeeProfile | null>(null);
    const [profileLoading, setProfileLoading] = useState(false);
    const [activityData, setActivityData] = useState<RecentActivityData | null>(null);
    const [activityLoading, setActivityLoading] = useState(false);
    const [selectedPayslipYear, setSelectedPayslipYear] = useState<number | null>(null);
    const [yearPickerVisible, setYearPickerVisible] = useState(false);
    const [downloadingPayslipId, setDownloadingPayslipId] = useState<string | null>(null);

    const displayName = profile?.name ?? user?.name ?? "Employee";
    const displayDesignation = profile?.designation ?? user?.designation ?? "Software Developer";
    const salaryValue =
        typeof profile?.salary === "number"
            ? `$${profile.salary.toLocaleString()}`
            : "$40,000";

    const formatPayslipMonth = (month?: number | null, year?: number | null) => {
        if (!month || !year) {
            return "Upcoming payout";
        }
        const date = new Date(year, month - 1, 1);
        if (Number.isNaN(date.getTime())) {
            return `Month ${month}, ${year}`;
        }
        return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    };

    const formatCurrency = (value?: number | null) => {
        if (typeof value !== "number") {
            return "--";
        }
        return `$${value.toLocaleString()}`;
    };

    const payslipYears = useMemo(() => {
        if (!profile?.Payslips) {
            return [];
        }
        const unique = Array.from(
            new Set(
                profile.Payslips.map((slip) => Number(slip.year)).filter(
                    (year) => typeof year === "number" && !Number.isNaN(year)
                )
            )
        );
        return unique.sort((a, b) => b - a);
    }, [profile?.Payslips]);

    useEffect(() => {
        if (!selectedPayslipYear && payslipYears.length > 0) {
            setSelectedPayslipYear(payslipYears[0]);
        }
    }, [payslipYears, selectedPayslipYear]);

    const payslipEntries = useMemo<PayslipEntry[]>(() => {
        if (!profile?.Payslips || profile.Payslips.length === 0 || !selectedPayslipYear) {
            return [];
        }

        const filtered = profile.Payslips.filter(
            (slip) => Number(slip.year) === selectedPayslipYear
        );

        if (filtered.length === 0) {
            return [];
        }

        return filtered.map((slip, index) => {
            const monthValue = typeof slip.month === "number" ? slip.month : Number(slip.month);
            const yearValue = typeof slip.year === "number" ? slip.year : Number(slip.year);
            const monthLabel = formatPayslipMonth(slip.month as number | undefined, slip.year as number | undefined);
            const netLabel = slip.netSalary ? `Net ${formatCurrency(slip.netSalary)}` : "Awaiting net salary";
            const canDownload = Boolean(slip.payslipGenerated && slip.payslipSent);
            return {
                id: slip.payrollId || `${slip.year}-${slip.month}-${index}`,
                monthLabel,
                detail: netLabel,
                canDownload,
                buttonLabel: canDownload ? "Download" : "Pending",
                month: Number.isFinite(monthValue) ? monthValue : null,
                year: Number.isFinite(yearValue) ? yearValue : null,
            };
        });
    }, [profile?.Payslips, selectedPayslipYear]);

    const payslipYearLabel = selectedPayslipYear ? `${selectedPayslipYear}` : "Select";
    const payslipEmptyMessage = selectedPayslipYear
        ? `No payslips available for ${selectedPayslipYear} yet.`
        : "Payslips will appear automatically after payroll generates them.";

    const getActivityColor = (type?: string) => {
        if (!type) {
            return DEFAULT_ACTIVITY_COLOR;
        }
        const normalized = type.replace(/[_-]+/g, " ").toLowerCase();
        const found = Object.entries(ACTIVITY_COLOR_MAP).find(([key]) =>
            normalized.includes(key)
        );
        return found?.[1] ?? DEFAULT_ACTIVITY_COLOR;
    };

    const formatActivityTitle = (type?: string) => {
        if (!type) {
            return "Update";
        }
        return type
            .replace(/[_-]+/g, " ")
            .toLowerCase()
            .replace(/\b\w/g, (char) => char.toUpperCase());
    };

    const formatActivitySubtitle = (activity: EmployeeActivity) => {
        const parts = [activity.description, activity.value].filter(Boolean);
        return parts.join(" • ") || "No additional details";
    };

    const formatActivityTime = (value?: string) => {
        if (!value) {
            return "--";
        }
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return value;
        }
        const now = new Date();
        const sameDay =
            date.getDate() === now.getDate() &&
            date.getMonth() === now.getMonth() &&
            date.getFullYear() === now.getFullYear();
        if (sameDay) {
            return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        }
        return date.toLocaleDateString();
    };

    useEffect(() => {
        if (isLoading) {
            return;
        }

        if (!user) {
            router.replace("/");
            return;
        }

        if (user.role !== "emp") {
            (async () => {
                try {
                    await logout();
                } finally {
                    router.replace("/");
                }
            })();
            return;
        }

        loadAttendance();
        loadProfile();
        loadRecentActivity();
    }, [isLoading, user, logout]);

    const loadAttendance = async () => {
        setAttLoading(true);
        try {
            const latest = await fetchAttendance();
            setAttendance(latest);
        } catch (error: any) {
            console.log("attendance fetch failed", error?.message);
        } finally {
            setAttLoading(false);
        }
    };

    const handleDownloadPayslip = async (entry: PayslipEntry) => {
        if (!profile?.employeeId || !entry.month || !entry.year) {
            Alert.alert("Download unavailable", "Missing payslip period details for this record.");
            return;
        }

        if (!entry.canDownload) {
            Alert.alert("Not ready", "This payslip is still being processed.");
            return;
        }

        setDownloadingPayslipId(entry.id);
        try {
            const response = await getPayslipDownloadUrl({
                employeeId: profile.employeeId,
                month: entry.month,
                year: entry.year,
            });

            const downloadUrl = response?.data?.downloadUrl 
            if (!downloadUrl) {
                throw new Error("Download link not available yet.");
            }

            const canOpen = await Linking.canOpenURL(downloadUrl);
            if (canOpen) {
                await Linking.openURL(downloadUrl);
            } else {
                await WebBrowser.openBrowserAsync(downloadUrl);
            }
        } catch (error: any) {
            const message =
                error?.response?.data?.message ||
                error?.message ||
                "Unable to download payslip right now.";
            Alert.alert("Download failed", message);
        } finally {
            setDownloadingPayslipId(null);
        }
    };

    const handleLogout = async () => {
        await logout();
        router.replace("/");
    };

    const isCheckedIn = attendance?.checkIn && !attendance?.checkOut;

    const handlePunch = async () => {
        if (!user) return;
        setPunching(true);
        try {
            if (isCheckedIn) {
                const res = await checkOut();
                setAttendance((prev:any ) => ({
                    ...prev,
                    ...res,
                    checkIn: prev?.checkIn || res.checkIn || null,
                }));
            } else {
                const res = await checkIn();
                setAttendance(res);
            }
        } catch (error: any) {
            const msg = error?.response?.data?.message || error?.message || "Something went wrong";
            Alert.alert("Punch failed", msg);
        } finally {
            setPunching(false);
        }
    };

    const loadProfile = async () => {
        setProfileLoading(true);
        try {
            const data = await fetchEmployeeProfile();
            setProfile(data);
        } catch (error: any) {
            console.log("profile fetch failed", error?.message);
        } finally {
            setProfileLoading(false);
        }
    };

    const loadRecentActivity = async () => {
        setActivityLoading(true);
        try {
            const data = await fetchRecentActivity();
            setActivityData(data);
        } catch (error: any) {
            console.log("recent activity fetch failed", error?.message);
        } finally {
            setActivityLoading(false);
        }
    };

    if (isLoading || !user || user.role !== "emp") {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#D4A537" />
            </View>
        );
    }

    const activityCountLabel = activityData?.totalActivities
        ? `${activityData.totalActivities} updates`
        : "Latest";
    const hasActivities = (activityData?.activities?.length ?? 0) > 0;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.headerTop}>
                    <Pressable style={styles.headerIcon} accessibilityRole="button">
                        <Ionicons name="menu" size={22} color="#111827" />
                    </Pressable>
                    <View style={styles.headerActions}>
                        <Pressable style={styles.headerIcon} accessibilityRole="button">
                            <Ionicons name="notifications-outline" size={20} color="#D4A537" />
                        </Pressable>
                        <Pressable
                            style={styles.headerIcon}
                            onPress={handleLogout}
                            accessibilityRole="button"
                        >
                            <Ionicons name="log-out-outline" size={20} color="#EF4444" />
                        </Pressable>
                    </View>
                </View>
                <Text style={styles.name}>{displayName}</Text>
                <Text style={styles.subtitle}>{displayDesignation}</Text>
                <Text style={styles.metaText}>
                    ID: {profile?.employeeId || user?.employeeId || "--"} • {profile?.department || "Department"}
                </Text>
                <Text style={styles.metaText}>Joined: {profile?.joinDate || "--"}</Text>
            </View>

            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.attendanceCard}>
                    <View style={styles.attendanceText}>
                        <Text style={styles.sectionLabel}>Attendance</Text>
                        <Text style={styles.attendanceTime}>
                            {attendance?.checkIn?.time || "--:--"}
                        </Text>
                        <Text style={styles.attendanceShift}>
                            Standard shift: 09:30 AM - 06:30 PM
                        </Text>
                    </View>
                    <Pressable
                        style={styles.punchButton}
                        onPress={handlePunch}
                        disabled={punching || attLoading}
                        accessibilityRole="button"
                    >
                        {punching ? (
                            <ActivityIndicator color="#111827" />
                        ) : (
                            <Text style={styles.punchText}>
                                {isCheckedIn ? "Check Out" : "Check In"}
                            </Text>
                        )}
                    </Pressable>
                    <View style={styles.clockRow}>
                        <View>
                            <Text style={styles.clockLabel}>Clock In</Text>
                            <Text style={styles.clockValue}>
                                {attendance?.checkIn?.time || "--:--"}
                            </Text>
                        </View>
                        <View style={styles.divider} />
                        <View>
                            <Text style={styles.clockLabel}>Clock Out</Text>
                            <Text style={styles.clockValue}>
                                {attendance?.checkOut?.time || "--:--"}
                            </Text>
                        </View>
                    </View>
                </View>

                <View style={styles.salaryCard}>
                    <View>
                        <Text style={styles.salaryLabel}>
                            Estimated net salary (FYE)
                        </Text>
                        <Text style={styles.salaryValue}>{salaryValue}</Text>
                        <Text style={styles.salaryDate}>
                            Last credited 31 Dec 2025
                        </Text>
                    </View>
                    <Pressable style={styles.viewMoreButton} accessibilityRole="button">
                        <Text style={styles.viewMoreText}>View More</Text>
                    </Pressable>
                </View>

                <View style={styles.payslipCard}>
                    <View style={styles.cardHeaderRow}>
                        <Text style={styles.cardHeader}>Payslips</Text>
                        <Pressable
                            style={styles.yearFilter}
                            onPress={() => setYearPickerVisible(true)}
                            accessibilityRole="button"
                        >
                            <Text style={styles.yearFilterLabel}>Year</Text>
                            <View style={styles.yearFilterValue}>
                                <Text style={styles.yearFilterText}>{payslipYearLabel}</Text>
                                <Ionicons name="chevron-down" size={14} color="#6B7280" />
                            </View>
                        </Pressable>
                    </View>
                    {payslipEntries.length === 0 ? (
                        <Text style={styles.payslipEmptyText}>
                            {payslipEmptyMessage}
                        </Text>
                    ) : (
                        payslipEntries.map((item) => (
                            <View key={item.id} style={styles.payslipRow}>
                                <View>
                                    <Text style={styles.payslipMonth}>
                                        {item.monthLabel}
                                    </Text>
                                    <Text style={styles.payslipLabel}>
                                        {item.detail}
                                    </Text>
                                </View>
                                <Pressable
                                    style={[
                                        styles.downloadBadge,
                                        (!item.canDownload || downloadingPayslipId === item.id) &&
                                            styles.downloadBadgeDisabled,
                                    ]}
                                    disabled={!item.canDownload || downloadingPayslipId === item.id}
                                    accessibilityRole="button"
                                    onPress={() => handleDownloadPayslip(item)}
                                >
                                    {downloadingPayslipId === item.id ? (
                                        <ActivityIndicator size="small" color="#9CA3AF" />
                                    ) : (
                                        <Text
                                            style={[
                                                styles.downloadText,
                                                !item.canDownload && styles.downloadTextDisabled,
                                            ]}
                                        >
                                            {item.buttonLabel}
                                        </Text>
                                    )}
                                </Pressable>
                            </View>
                        ))
                    )}
                </View>

                <View style={styles.activityCard}>
                    <View style={styles.cardHeaderRow}>
                        <Text style={styles.cardHeader}>Recent Activity</Text>
                        <Text style={styles.cardSubtle}>{activityCountLabel}</Text>
                    </View>
                    {activityLoading ? (
                        <View style={styles.activityState}>
                            <ActivityIndicator color="#D4A537" />
                        </View>
                    ) : !hasActivities ? (
                        <View style={styles.activityState}>
                            <Text style={styles.activityEmptyText}>
                                No recent updates yet.
                            </Text>
                        </View>
                    ) : (
                        activityData?.activities?.map((activity: EmployeeActivity, index: number) => {
                            const color = getActivityColor(activity.type);
                            return (
                                <View
                                    key={`${activity.type}-${activity.date}-${index}`}
                                    style={[
                                        styles.activityRow,
                                        index === 0 && styles.activityRowFirst,
                                    ]}
                                >
                                    <View
                                        style={[
                                            styles.activityMarker,
                                            { backgroundColor: `${color}33` },
                                        ]}
                                    >
                                        <View
                                            style={[
                                                styles.activityDot,
                                                { backgroundColor: color },
                                            ]}
                                        />
                                    </View>
                                    <View style={styles.activityTextBlock}>
                                        <Text style={styles.activityTitle}>
                                            {formatActivityTitle(activity.type)}
                                        </Text>
                                        <Text style={styles.activityLabel}>
                                            {formatActivitySubtitle(activity)}
                                        </Text>
                                    </View>
                                    <Text style={styles.activityTime}>
                                        {formatActivityTime(activity.date)}
                                    </Text>
                                </View>
                            );
                        })
                    )}
                </View>
            </ScrollView>

            <View style={styles.bottomBar}>
                <Pressable style={styles.bottomIconActive} accessibilityRole="button">
                    <Ionicons name="home" size={22} color="#D4A537" />
                </Pressable>
                <Pressable
                    style={styles.bottomIcon}
                    onPress={() => router.replace("/leave")}
                    accessibilityRole="button"
                >
                    <Ionicons name="calendar-outline" size={22} color="#9CA3AF" />
                </Pressable>
                <Pressable style={styles.bottomIcon} accessibilityRole="button">
                    <Ionicons name="card-outline" size={22} color="#9CA3AF" />
                </Pressable>
                <Pressable style={styles.bottomIcon} accessibilityRole="button">
                    <Ionicons name="person-outline" size={22} color="#9CA3AF" />
                </Pressable>
            </View>

            <Modal
                visible={yearPickerVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setYearPickerVisible(false)}
            >
                <Pressable
                    style={styles.yearModalBackdrop}
                    onPress={() => setYearPickerVisible(false)}
                    accessibilityRole="button"
                >
                    <View style={styles.yearModalCard}>
                        <Text style={styles.yearModalTitle}>Select year</Text>
                        {payslipYears.length === 0 ? (
                            <Text style={styles.yearModalEmpty}>
                                No payslip years available yet.
                            </Text>
                        ) : (
                            payslipYears.map((year) => (
                                <Pressable
                                    key={year}
                                    style={[
                                        styles.yearOption,
                                        selectedPayslipYear === year && styles.yearOptionActive,
                                    ]}
                                    onPress={() => {
                                        setSelectedPayslipYear(year);
                                        setYearPickerVisible(false);
                                    }}
                                    accessibilityRole="button"
                                >
                                    <Text
                                        style={[
                                            styles.yearOptionText,
                                            selectedPayslipYear === year && styles.yearOptionTextActive,
                                        ]}
                                    >
                                        {year}
                                    </Text>
                                    {selectedPayslipYear === year && (
                                        <Ionicons name="checkmark" size={16} color="#111827" />
                                    )}
                                </Pressable>
                            ))
                        )}
                    </View>
                </Pressable>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#FFFFFF",
    },
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#FFFFFF",
    },
    header: {
        paddingTop: 56,
        paddingHorizontal: 24,
        paddingBottom: 16,
    },
    headerTop: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 12,
    },
    headerActions: {
        flexDirection: "row",
        gap: 10,
    },
    headerIcon: {
        height: 38,
        width: 38,
        borderRadius: 12,
        backgroundColor: "#F8FAFC",
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#000000",
        shadowOpacity: 0.04,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 2,
    },
    name: {
        fontSize: 28,
        fontWeight: "700",
        color: "#111827",
    },
    subtitle: {
        color: "#6B7280",
        fontSize: 14,
        marginTop: 4,
    },
    metaText: {
        marginTop: 4,
        fontSize: 12,
        color: "#9CA3AF",
        letterSpacing: 0.5,
    },
    content: {
        paddingHorizontal: 24,
        paddingBottom: 120,
    },
    attendanceCard: {
        backgroundColor: "#FEF8EF",
        borderRadius: 26,
        padding: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: "#FEEBC8",
        shadowColor: "#FEEBC8",
        shadowOpacity: 0.5,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 10 },
    },
    attendanceText: {
        marginBottom: 16,
    },
    sectionLabel: {
        color: "#9CA3AF",
        fontSize: 12,
        letterSpacing: 1,
        textTransform: "uppercase",
        marginBottom: 8,
    },
    attendanceTime: {
        fontSize: 42,
        fontWeight: "700",
        color: "#111827",
    },
    attendanceShift: {
        color: "#71717A",
        fontSize: 12,
        marginTop: 4,
    },
    punchButton: {
        alignSelf: "center",
        backgroundColor: "#D4A537",
        width: 110,
        height: 110,
        borderRadius: 55,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 16,
        shadowColor: "#D4A537",
        shadowOpacity: 0.4,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 10 },
    },
    punchText: {
        color: "#111827",
        fontWeight: "700",
        fontSize: 14,
    },
    clockRow: {
        flexDirection: "row",
        justifyContent: "space-between",
    },
    clockLabel: {
        color: "#9CA3AF",
        fontSize: 12,
        letterSpacing: 1,
        textTransform: "uppercase",
    },
    clockValue: {
        color: "#111827",
        fontSize: 16,
        fontWeight: "600",
        marginTop: 4,
    },
    divider: {
        width: 1,
        backgroundColor: "#E5E7EB",
        marginHorizontal: 12,
    },
    salaryCard: {
        backgroundColor: "#111827",
        borderRadius: 24,
        padding: 20,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 16,
    },
    salaryLabel: {
        fontSize: 12,
        color: "#E5E7EB",
        letterSpacing: 1,
        textTransform: "uppercase",
        marginBottom: 8,
    },
    salaryValue: {
        fontSize: 36,
        color: "#F8FAFE",
        fontWeight: "700",
    },
    salaryDate: {
        color: "#9CA3AF",
        marginTop: 4,
        fontSize: 12,
    },
    balanceCard: {
        backgroundColor: "#FDFBF7",
        borderRadius: 18,
        padding: 20,
        borderWidth: 1,
        borderColor: "#F3E9D4",
        alignItems: "center",
        marginBottom: 24,
    },
    balanceLabel: {
        color: "#A78B5C",
        letterSpacing: 1,
        textTransform: "uppercase",
        fontSize: 11,
    },
    balanceValue: {
        fontSize: 48,
        color: "#D4A537",
        fontWeight: "700",
        marginTop: 6,
    },
    balanceUnit: {
        color: "#9CA3AF",
        letterSpacing: 1,
        textTransform: "uppercase",
        fontSize: 11,
    },
    balanceDivider: {
        width: "70%",
        height: 1,
        backgroundColor: "#EFE7D7",
        marginVertical: 16,
    },
    balanceRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        width: "80%",
    },
    balanceCol: {
        alignItems: "center",
    },
    balanceSubLabel: {
        color: "#9CA3AF",
        fontSize: 11,
        letterSpacing: 1,
        textTransform: "uppercase",
    },
    balanceSubValue: {
        color: "#111827",
        fontWeight: "600",
        marginTop: 6,
    },
    viewMoreButton: {
        borderWidth: 1,
        borderColor: "#F8FAFE",
        borderRadius: 999,
        paddingHorizontal: 16,
        paddingVertical: 6,
    },
    viewMoreText: {
        color: "#F8FAFE",
        fontWeight: "600",
        fontSize: 11,
    },
    payslipCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 24,
        padding: 20,
        borderWidth: 1,
        borderColor: "#F1F5F9",
        marginBottom: 16,
    },
    cardHeaderRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "baseline",
        marginBottom: 12,
    },
    cardHeader: {
        fontSize: 16,
        fontWeight: "600",
        color: "#111827",
    },
    cardSubtle: {
        fontSize: 12,
        color: "#9CA3AF",
    },
    yearFilter: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: "#E5E7EB",
        backgroundColor: "#F9FAFB",
    },
    yearFilterLabel: {
        fontSize: 11,
        textTransform: "uppercase",
        letterSpacing: 0.8,
        color: "#9CA3AF",
        fontWeight: "600",
    },
    yearFilterValue: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
    },
    yearFilterText: {
        fontSize: 13,
        color: "#111827",
        fontWeight: "600",
    },
    payslipRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 12,
        borderTopWidth: 1,
        borderColor: "#F1F5F9",
    },
    payslipMonth: {
        fontSize: 14,
        fontWeight: "600",
        color: "#111827",
    },
    payslipLabel: {
        color: "#6B7280",
        fontSize: 12,
    },
    downloadBadge: {
        borderRadius: 999,
        borderWidth: 1,
        borderColor: "#D4A537",
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    downloadText: {
        color: "#D4A537",
        fontSize: 12,
        fontWeight: "600",
    },
    downloadBadgeDisabled: {
        borderColor: "#E5E7EB",
        backgroundColor: "#F9FAFB",
    },
    downloadTextDisabled: {
        color: "#9CA3AF",
    },
    payslipEmptyText: {
        color: "#9CA3AF",
        fontSize: 12,
        paddingVertical: 8,
    },
    yearModalBackdrop: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.3)",
        justifyContent: "center",
        paddingHorizontal: 32,
    },
    yearModalCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 20,
        padding: 20,
        gap: 8,
    },
    yearModalTitle: {
        fontSize: 16,
        fontWeight: "600",
        color: "#111827",
        marginBottom: 4,
    },
    yearModalEmpty: {
        color: "#9CA3AF",
        fontSize: 13,
        paddingVertical: 4,
    },
    yearOption: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderColor: "#F1F5F9",
    },
    yearOptionActive: {
        backgroundColor: "#F8FAFC",
    },
    yearOptionText: {
        fontSize: 15,
        color: "#1F2937",
    },
    yearOptionTextActive: {
        fontWeight: "700",
    },
    activityCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 24,
        padding: 20,
        borderWidth: 1,
        borderColor: "#F1F5F9",
    },
    activityRow: {
        flexDirection: "row",
        alignItems: "center",
        borderTopWidth: 1,
        borderColor: "#F1F5F9",
        paddingTop: 12,
        paddingBottom: 12,
    },
    activityRowFirst: {
        borderTopWidth: 0,
        paddingTop: 0,
    },
    activityMarker: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 12,
    },
    activityDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
    },
    activityTextBlock: {
        flex: 1,
    },
    activityTitle: {
        fontSize: 14,
        fontWeight: "600",
        color: "#1F2937",
    },
    activityLabel: {
        color: "#6B7280",
        fontSize: 12,
        marginTop: 2,
    },
    activityTime: {
        color: "#6B7280",
        fontSize: 12,
    },
    activityState: {
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 24,
    },
    activityEmptyText: {
        color: "#9CA3AF",
        fontSize: 12,
    },
    bottomBar: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        height: 76,
        backgroundColor: "#FFFFFF",
        borderTopWidth: 1,
        borderColor: "#E5E7EB",
        flexDirection: "row",
        justifyContent: "space-around",
        alignItems: "center",
        shadowColor: "#000",
        shadowOpacity: 0.08,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: -4 },
        elevation: 6,
        paddingHorizontal: 24,
    },
    bottomIcon: {
        height: 44,
        width: 44,
        borderRadius: 22,
        alignItems: "center",
        justifyContent: "center",
    },
    bottomIconActive: {
        height: 44,
        width: 44,
        borderRadius: 22,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#FEF8EF",
    },
});
