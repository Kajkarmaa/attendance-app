import { useAuth } from "@/contexts/AuthContext";
import { fetchEmployeeProfile, type EmployeeProfile } from "@/services/profile";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

const formatNumber = (value: unknown, fallback = 0) => {
    const num = typeof value === "number" ? value : Number(value);
    return Number.isFinite(num) ? num : fallback;
};

const formatWorkHours = (value: unknown) => {
    if (typeof value === "string" && value.trim().length > 0) return value;
    if (typeof value === "number" && Number.isFinite(value)) return value.toFixed(2);
    return "0.00";
};

export default function LeaveScreen() {
    const { user, isLoading } = useAuth();
    const [profile, setProfile] = useState<EmployeeProfile | null>(null);
    const [profileLoading, setProfileLoading] = useState(false);

    useEffect(() => {
        if (isLoading) return;
        if (!user) {
            router.replace("/");
            return;
        }
        if (user.role !== "emp") {
            router.replace("/(tabs)");
            return;
        }

        loadProfile();
    }, [isLoading, user]);

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
                        style={styles.backBtn}
                        onPress={() => router.replace("/employee")}
                    >
                        <Ionicons name="chevron-back" size={22} color="#111827" />
                    </Pressable>
                    <Text style={styles.headerTitle}>Leave Management</Text>
                    <View style={{ width: 38 }} />
                </View>

                <View style={styles.balanceCard}>
                    <Text style={styles.balanceLabel}>Available Balance</Text>
                    <Text style={styles.balanceValue}>{profile?.leaveBalance?.remaining ?? 0}</Text>
                    <Text style={styles.balanceUnit}>days</Text>
                    <View style={styles.balanceDivider} />
                    <View style={styles.balanceRow}>
                        <View style={styles.balanceCol}>
                            <Text style={styles.balanceSubLabel}>Used</Text>
                            <Text style={styles.balanceSubValue}>{profile?.leaveBalance?.used ?? 0} D</Text>
                        </View>
                        <View style={styles.balanceCol}>
                            <Text style={styles.balanceSubLabel}>Pending</Text>
                            <Text style={styles.balanceSubValue}>
                                {Math.max(
                                    (profile?.leaveBalance?.total ?? 0) - (profile?.leaveBalance?.used ?? 0) - (profile?.leaveBalance?.remaining ?? 0),
                                    0,
                                )} D
                            </Text>
                        </View>
                    </View>
                </View>

                <Text style={styles.sectionLabel}>Attendance Summary</Text>

                <View style={styles.listCard}>
                    {profileLoading ? (
                        <View style={styles.inlineLoadingRow}>
                            <ActivityIndicator size="small" color="#D4A537" />
                            <Text style={styles.inlineLoadingText}>Loading attendance…</Text>
                        </View>
                    ) : (
                        attendanceRows.map((item) => (
                            <View key={item.title} style={styles.leaveRow}>
                                <View style={styles.iconPill}>
                                    <Ionicons name={item.icon} size={18} color="#D4A537" />
                                </View>
                                <View style={styles.leaveTextBlock}>
                                    <Text style={styles.leaveTitle}>{item.title}</Text>
                                    <Text style={styles.leaveDates}>{item.subtitle}</Text>
                                </View>
                                <View style={[styles.statusPill, styles.valuePill]}>
                                    <Text style={styles.valueText}>{item.value}</Text>
                                </View>
                            </View>
                        ))
                    )}
                </View>
            </ScrollView>

            <Pressable
                style={styles.fab}
                onPress={() => router.replace("/leave-request")}
            >
                <Ionicons name="add" size={24} color="#FFFFFF" />
            </Pressable>

            <View style={styles.bottomBar}>
                <Pressable
                    style={styles.bottomIcon}
                    onPress={() => router.replace("/employee")}
                >
                    <Ionicons name="home-outline" size={22} color="#9CA3AF" />
                </Pressable>
                <Pressable style={styles.bottomIconActive}>
                    <Ionicons name="calendar" size={22} color="#D4A537" />
                </Pressable>
            </View>
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
        fontSize: 11,
        letterSpacing: 1,
        textTransform: "uppercase",
        marginBottom: 12,
    },
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
