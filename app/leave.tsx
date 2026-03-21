import SkeletonBlock from "@/components/SkeletonBlock";
import { useAuth } from "@/contexts/AuthContext";
import {
    fetchLeaveBalance,
    fetchMyLeaves,
    type LeaveBalanceData,
    type MyLeaveRequest,
} from "@/services/leaves";
import { fetchEmployeeProfile, type EmployeeProfile } from "@/services/profile";
import { getCachedData, setCachedData } from "@/stores/cacheStore";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

const formatNumber = (value: unknown, fallback = 0) => {
    const num = typeof value === "number" ? value : Number(value);
    return Number.isFinite(num) ? num : fallback;
};

const formatWorkHours = (value: unknown) => {
    if (typeof value === "string" && value.trim().length > 0) return value;
    if (typeof value === "number" && Number.isFinite(value))
        return value.toFixed(2);
    return "0.00";
};

const formatTypeLabel = (value: string) => {
    if (!value) return "Unknown";
    const normalized = value.replace(/[_-]+/g, " ").trim();
    if (!normalized) return "Unknown";
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const leaveTypeIcon = (type: string) => {
    switch (type) {
        case "sick":
            return "medkit-outline" as const;
        case "casual":
            return "sunny-outline" as const;
        case "earned":
            return "briefcase-outline" as const;
        case "maternity":
            return "heart-outline" as const;
        case "paternity":
            return "people-outline" as const;
        default:
            return "leaf-outline" as const;
    }
};

const LEAVE_SCREEN_CACHE_KEY = "employee:leave-screen";
const LEAVE_SCREEN_CACHE_TTL_MS = 3 * 60 * 1000;

export default function LeaveScreen() {
    const { user, isLoading } = useAuth();
    const insets = useSafeAreaInsets();
    const BOTTOM_BAR_BASE_HEIGHT = 76;
    const [profile, setProfile] = useState<EmployeeProfile | null>(null);
    const [profileLoading, setProfileLoading] = useState(false);
    const [leaveBalance, setLeaveBalance] = useState<LeaveBalanceData | null>(
        null,
    );
    const [leaveBalanceLoading, setLeaveBalanceLoading] = useState(false);
    const [myLeaves, setMyLeaves] = useState<MyLeaveRequest[]>([]);
    const [myLeavesLoading, setMyLeavesLoading] = useState(false);
    const [showAllMyLeaves, setShowAllMyLeaves] = useState(false);
    const [selectedYear, setSelectedYear] = useState<number>(
        new Date().getFullYear(),
    );
    const [refreshing, setRefreshing] = useState(false);

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

        loadData();
    }, [isLoading, user]);

    const handleRefresh = async () => {
        setRefreshing(true);
        try {
            await loadData(true);
        } catch (err) {
            // loadData already logs errors
        } finally {
            setRefreshing(false);
        }
    };

    const loadData = async (force: boolean = false) => {
        if (!force) {
            const cached = getCachedData<{
                profile: EmployeeProfile | null;
                leaveBalance: LeaveBalanceData | null;
                myLeaves: MyLeaveRequest[];
            }>(LEAVE_SCREEN_CACHE_KEY, LEAVE_SCREEN_CACHE_TTL_MS);
            if (cached) {
                setProfile(cached.profile);
                setLeaveBalance(cached.leaveBalance);
                setMyLeaves(cached.myLeaves ?? []);
                return;
            }
        }

        setProfileLoading(true);
        setLeaveBalanceLoading(true);
        setMyLeavesLoading(true);
        try {
            const results = await Promise.allSettled([
                fetchEmployeeProfile(),
                fetchLeaveBalance(),
                fetchMyLeaves(),
            ]);

            const profileResult = results[0];
            const leaveBalanceResult = results[1];
            const myLeavesResult = results[2];

            if (profileResult.status === "fulfilled") {
                setProfile(profileResult.value);
            } else {
                console.log(
                    "profile fetch failed",
                    profileResult.reason?.message,
                );
            }

            if (leaveBalanceResult.status === "fulfilled") {
                setLeaveBalance(leaveBalanceResult.value);
            } else {
                console.log(
                    "leave balance fetch failed",
                    leaveBalanceResult.reason?.message,
                );
            }

            if (myLeavesResult.status === "fulfilled") {
                setMyLeaves(myLeavesResult.value ?? []);
            } else {
                console.log(
                    "my leaves fetch failed",
                    myLeavesResult.reason?.message,
                );
                setMyLeaves([]);
            }

            setCachedData(LEAVE_SCREEN_CACHE_KEY, {
                profile:
                    profileResult.status === "fulfilled"
                        ? profileResult.value
                        : null,
                leaveBalance:
                    leaveBalanceResult.status === "fulfilled"
                        ? leaveBalanceResult.value
                        : null,
                myLeaves:
                    myLeavesResult.status === "fulfilled"
                        ? myLeavesResult.value ?? []
                        : [],
            });
        } catch (error: any) {
            console.log("leave screen fetch failed", error?.message);
        } finally {
            setProfileLoading(false);
            setLeaveBalanceLoading(false);
            setMyLeavesLoading(false);
        }
    };

    const formatDateShort = (iso: string) => {
        if (!iso) return "";
        try {
            return new Date(iso).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
            });
        } catch {
            return iso;
        }
    };

    const myLeavesVisible = useMemo(() => {
        return showAllMyLeaves ? myLeaves : myLeaves.slice(0, 5);
    }, [myLeaves, showAllMyLeaves]);

    const canToggleMyLeaves = myLeaves.length > 5;

    const statusStyleFor = (status: string) => {
        switch (status) {
            case "approved":
                return {
                    pill: styles.statusApproved,
                    text: styles.statusApprovedText,
                };
            case "rejected":
                return {
                    pill: styles.statusRejected,
                    text: styles.statusRejectedText,
                };
            case "pending":
            default:
                return {
                    pill: styles.statusPending,
                    text: styles.statusPendingText,
                };
        }
    };

    const attendance = profile?.attendance?.thisMonth;
    const attendanceRows = [
        {
            title: "Present",
            subtitle: "This month",
            value: `${formatNumber(attendance?.present)} Days`,
            icon: "checkmark-circle-outline" as const,
        },
        {
            title: "Absent",
            subtitle: "This month",
            value: `${formatNumber(attendance?.absent)} Days`,
            icon: "close-circle-outline" as const,
        },
        {
            title: "Late",
            subtitle: "This month",
            value: `${formatNumber(attendance?.late)} Times`,
            icon: "time-outline" as const,
        },
        {
            title: "Half Day",
            subtitle: "This month",
            value: `${formatNumber(attendance?.halfDay)} Days`,
            icon: "remove-circle-outline" as const,
        },
        {
            title: "Total Days",
            subtitle: "This month",
            value: `${formatNumber(attendance?.totalDays)} Days`,
            icon: "calendar-outline" as const,
        },
        {
            title: "Avg Work Hours",
            subtitle: "This month",
            value: `${formatWorkHours(attendance?.averageWorkHours)} Hrs`,
            icon: "stopwatch-outline" as const,
        },
    ];

    const leaveRemaining = leaveBalance?.remaining ?? 0;
    const leaveUsed = leaveBalance?.used ?? 0;
    const leaveTotal = leaveBalance?.total ?? 0;
    const leavePending = Math.max(leaveTotal - leaveUsed - leaveRemaining, 0);

    const leaveByTypeRows = Object.entries(leaveBalance?.byType ?? {}).map(
        ([type, values]) => {
            const total = formatNumber(values?.total);
            const used = formatNumber(values?.used);
            const remaining = formatNumber(values?.remaining);
            return {
                key: type,
                title: formatTypeLabel(type),
                subtitle: `Used ${used} / Total ${total}`,
                value: `${remaining} Days`,
                icon: leaveTypeIcon(type),
            };
        },
    );

    if (isLoading) {
        return (
            <SafeAreaView style={styles.container}>
                <ScrollView
                    contentContainerStyle={[
                        styles.content,
                        {
                            paddingTop: 32,
                            paddingBottom:
                                BOTTOM_BAR_BASE_HEIGHT + insets.bottom + 64,
                        },
                    ]}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={handleRefresh}
                            colors={["#D4A537"]}
                        />
                    }
                >
                    <SkeletonBlock
                        style={{
                            height: 160,
                            borderRadius: 12,
                            marginBottom: 16,
                        }}
                    />
                    <SkeletonBlock
                        style={{ height: 24, width: "60%", marginBottom: 8 }}
                    />
                    <SkeletonBlock
                        style={{ height: 18, width: "40%", marginBottom: 16 }}
                    />
                    <SkeletonBlock
                        style={{
                            height: 120,
                            borderRadius: 12,
                            marginBottom: 12,
                        }}
                    />
                    <SkeletonBlock
                        style={{ height: 16, width: "80%", marginBottom: 8 }}
                    />
                    <SkeletonBlock
                        style={{ height: 16, width: "70%", marginBottom: 8 }}
                    />
                    <SkeletonBlock
                        style={{ height: 16, width: "90%", marginBottom: 8 }}
                    />
                </ScrollView>
            </SafeAreaView>
        );
    }

    if (!user || user.role !== "emp") {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#D4A537" />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView
                contentContainerStyle={[
                    styles.content,
                    {
                        paddingBottom:
                            BOTTOM_BAR_BASE_HEIGHT + insets.bottom + 64,
                    },
                ]}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={handleRefresh}
                        colors={["#D4A537"]}
                    />
                }
            >
                <View style={styles.headerRow}>
                    <Pressable
                        style={styles.backBtn}
                        onPress={() => router.back()}
                    >
                        <Ionicons
                            name="chevron-back"
                            size={22}
                            color="#111827"
                        />
                    </Pressable>
                    <Text style={styles.headerTitle}>Leave Management</Text>
                    <View style={{ width: 38 }} />
                </View>

                <View style={styles.bigBalanceWrap}>
                    <View style={styles.bigBalanceCard}>
                        <Text style={styles.bigBalanceLabel}>
                            Available Balance
                        </Text>
                        {leaveBalanceLoading ? (
                            <SkeletonBlock
                                style={{ height: 40, width: 120, marginTop: 8 }}
                            />
                        ) : (
                            <Text style={styles.bigBalanceValue}>
                                {leaveRemaining}
                            </Text>
                        )}
                        <Text style={styles.bigBalanceUnit}>DAYS</Text>
                    </View>

                    <View style={styles.smallBalanceRow}>
                        <View style={styles.smallCard}>
                            <Text style={styles.smallLabel}>Used</Text>
                            {leaveBalanceLoading ? (
                                <SkeletonBlock
                                    style={{ height: 30, width: 60 }}
                                />
                            ) : (
                                <Text style={styles.smallValue}>
                                    {String(leaveUsed).padStart(2, "0")}
                                </Text>
                            )}
                            <Text style={styles.smallUnit}>DAYS</Text>
                        </View>
                        <View style={styles.smallCard}>
                            <Text style={styles.smallLabel}>Pending</Text>
                            {leaveBalanceLoading ? (
                                <SkeletonBlock
                                    style={{ height: 30, width: 60 }}
                                />
                            ) : (
                                <Text style={styles.smallValue}>
                                    {String(leavePending).padStart(2, "0")}
                                </Text>
                            )}
                            <Text style={styles.smallUnit}>DAYS</Text>
                        </View>
                    </View>
                </View>

                <View style={styles.sectionHeaderRow}>
                    <Text style={[styles.sectionLabelLarge]}>
                        History & Activity
                    </Text>
                    <Pressable
                        style={styles.yearSelector}
                        onPress={() => {
                            const y =
                                selectedYear === new Date().getFullYear()
                                    ? selectedYear - 1
                                    : new Date().getFullYear();
                            setSelectedYear(y);
                        }}
                    >
                        <Text style={styles.yearText}>{selectedYear}</Text>
                        <Ionicons
                            name="chevron-down"
                            size={14}
                            color="#D4A537"
                        />
                    </Pressable>
                </View>

                <View style={styles.listCard}>
                    {myLeavesLoading ? (
                        <View style={styles.inlineLoadingRow}>
                            <ActivityIndicator size="small" color="#D4A537" />
                            <Text style={styles.inlineLoadingText}>
                                Loading your requests…
                            </Text>
                        </View>
                    ) : myLeaves.length === 0 ? (
                        <View style={styles.inlineLoadingRow}>
                            <Text style={styles.inlineLoadingText}>
                                No leave requests yet.
                            </Text>
                        </View>
                    ) : (
                        myLeavesVisible.map((item) => {
                            const status = (
                                item.status || "pending"
                            ).toLowerCase();
                            const statusStyles = statusStyleFor(status);

                            return (
                                <View key={item.id} style={styles.leaveRow}>
                                    <View style={styles.iconPill}>
                                        <Ionicons
                                            name={leaveTypeIcon(item.type)}
                                            size={18}
                                            color="#D4A537"
                                        />
                                    </View>
                                    <View style={styles.leaveTextBlock}>
                                        <Text style={styles.leaveTitle}>
                                            {formatTypeLabel(item.type)}
                                        </Text>
                                        <Text style={styles.leaveDates}>
                                            {formatDateShort(item.startDate)} -{" "}
                                            {formatDateShort(item.endDate)} ·{" "}
                                            {formatNumber(item.days)} day(s)
                                        </Text>
                                    </View>
                                    <View
                                        style={[
                                            styles.statusPill,
                                            statusStyles.pill,
                                        ]}
                                    >
                                        <Text style={statusStyles.text}>
                                            {formatTypeLabel(status)}
                                        </Text>
                                    </View>
                                </View>
                            );
                        })
                    )}

                    {canToggleMyLeaves && !myLeavesLoading && (
                        <Pressable
                            onPress={() => setShowAllMyLeaves((v) => !v)}
                            style={styles.moreLessBtn}
                        >
                            <Text style={styles.moreLessText}>
                                {showAllMyLeaves ? "Less" : "More"}
                            </Text>
                            <Ionicons
                                name={
                                    showAllMyLeaves
                                        ? "chevron-up"
                                        : "chevron-down"
                                }
                                size={18}
                                color="#D4A537"
                            />
                        </Pressable>
                    )}
                </View>
            </ScrollView>

            <Pressable
                style={[
                    styles.fab,
                    { bottom: BOTTOM_BAR_BASE_HEIGHT + insets.bottom + 16 },
                ]}
                onPress={() => router.replace("/leave-request")}
            >
                <Ionicons name="add" size={24} color="#FFFFFF" />
            </Pressable>

            <View
                style={[
                    styles.bottomBar,
                    {
                        height: BOTTOM_BAR_BASE_HEIGHT + insets.bottom,
                        paddingBottom: Math.max(insets.bottom, 10),
                    },
                ]}
            >
                <Pressable
                    style={styles.bottomIcon}
                    onPress={() => router.push("/employee")}
                >
                    <Ionicons name="home-outline" size={22} color="#9CA3AF" />
                </Pressable>
                <Pressable style={styles.bottomIconActive}>
                    <Ionicons name="calendar" size={22} color="#D4A537" />
                </Pressable>
                <Pressable
                    style={styles.bottomIcon}
                    onPress={() => router.push("/profile-setting")}
                    accessibilityRole="button"
                >
                    <Ionicons name="person-outline" size={22} color="#9CA3AF" />
                </Pressable>
            </View>
        </SafeAreaView>
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
        paddingTop: 28,
        paddingHorizontal: 20,
        paddingBottom: 140,
    },
    headerRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 24,
    },
    sectionHeaderRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 12,
    },
    refreshBtn: {
        padding: 6,
        borderRadius: 999,
    },
    backBtn: {
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
        fontWeight: "600",
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
    bigBalanceWrap: {
        marginBottom: 16,
    },
    bigBalanceCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 18,
        paddingVertical: 28,
        alignItems: "center",
        shadowColor: "#000",
        shadowOpacity: 0.03,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        borderWidth: 1,
        borderColor: "#F1F5F9",
        marginBottom: 12,
    },
    bigBalanceLabel: {
        color: "#9CA3AF",
        fontSize: 14,
        marginBottom: 6,
    },
    bigBalanceValue: {
        fontSize: 48,
        fontWeight: "800",
        color: "#111827",
    },
    bigBalanceUnit: {
        color: "#9CA3AF",
        marginTop: 6,
        letterSpacing: 1,
    },
    smallBalanceRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        gap: 12,
    },
    smallCard: {
        flex: 1,
        backgroundColor: "#FFFFFF",
        borderRadius: 14,
        paddingVertical: 14,
        alignItems: "center",
        marginRight: 8,
        borderWidth: 1,
        borderColor: "#F1F5F9",
        shadowColor: "#000",
        shadowOpacity: 0.02,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
    },
    smallLabel: { color: "#9CA3AF", fontSize: 13 },
    smallValue: {
        fontSize: 28,
        fontWeight: "800",
        color: "#111827",
        marginTop: 6,
    },
    smallUnit: { color: "#9CA3AF", fontSize: 12, marginTop: 4 },
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
    sectionLabel: {
        color: "#9CA3AF",
        paddingTop: 10,
        fontSize: 11,
        letterSpacing: 1,
        textTransform: "uppercase",
        marginBottom: 12,
    },
    sectionLabelLarge: {
        color: "#111827",
        fontSize: 18,
        fontWeight: "700",
        marginBottom: 8,
    },
    yearSelector: { flexDirection: "row", alignItems: "center", gap: 6 },
    yearText: { color: "#D4A537", fontWeight: "700" },
    listCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 18,
        padding: 12,
        borderWidth: 1,
        borderColor: "#F1F5F9",
    },
    inlineLoadingRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 18,
        gap: 10,
    },
    inlineLoadingText: {
        color: "#6B7280",
        fontSize: 12,
        fontWeight: "500",
    },
    leaveRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderColor: "#F5F3EE",
    },
    iconPill: {
        height: 36,
        width: 36,
        borderRadius: 10,
        backgroundColor: "#FEF8EF",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 12,
        borderWidth: 1,
        borderColor: "#F3E9D4",
    },
    leaveTextBlock: {
        flex: 1,
    },
    leaveTitle: {
        color: "#111827",
        fontWeight: "700",
    },
    leaveDates: {
        color: "#9CA3AF",
        fontSize: 12,
        marginTop: 2,
    },
    statusPill: {
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderWidth: 1,
    },
    valuePill: {
        borderColor: "#E5E7EB",
        backgroundColor: "#F8FAFC",
    },
    valueText: {
        color: "#111827",
        fontSize: 11,
        fontWeight: "600",
    },
    statusApproved: {
        borderColor: "#F3E9D4",
        backgroundColor: "#FEF8EF",
    },
    statusPending: {
        borderColor: "#E5E7EB",
        backgroundColor: "#F8FAFC",
    },
    statusRejected: {
        borderColor: "#FECACA",
        backgroundColor: "#FEF2F2",
    },
    statusApprovedText: {
        color: "#A78B5C",
        fontSize: 11,
        fontWeight: "600",
    },
    statusPendingText: {
        color: "#6B7280",
        fontSize: 11,
        fontWeight: "600",
    },
    statusRejectedText: {
        color: "#B91C1C",
        fontSize: 11,
        fontWeight: "600",
    },
    moreLessBtn: {
        marginTop: 8,
        paddingVertical: 10,
        borderTopWidth: 1,
        borderColor: "#F5F3EE",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
    },
    moreLessText: {
        color: "#D4A537",
        fontWeight: "700",
    },
    fab: {
        position: "absolute",
        right: 24,
        bottom: 92,
        height: 52,
        width: 52,
        borderRadius: 26,
        backgroundColor: "#D4A537",
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#D4A537",
        shadowOpacity: 0.3,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
        elevation: 6,
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
        zIndex: 30,
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
