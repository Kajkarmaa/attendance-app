import { useAuth } from "@/contexts/AuthContext";
import {
    checkIn,
    checkOut,
    fetchAttendance,
    type AttendanceRecord,
} from "@/services/attendance";
import { fetchEmployeeProfile, type EmployeeProfile } from "@/services/profile";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

const payslips = [
    { month: "November 2025", label: "Payslip Nov 20", badge: "Download" },
    { month: "December 2025", label: "Payslip Dec 20", badge: "Download" },
];

const activities = [
    {
        title: "Marked Present",
        description: "On time",
        time: "09:32 AM",
        color: "#34D399",
    },
    {
        title: "Work From Home",
        description: "Manager: Ravi K.",
        time: "09:32 AM",
        color: "#60A5FA",
    },
    {
        title: "Salary Credited",
        description: "$40,000",
        time: "31 Dec",
        color: "#FBBF24",
    },
];

export default function EmployeeDashboardScreen() {
    const { user, isLoading, logout } = useAuth();
    const [attendance, setAttendance] = useState<AttendanceRecord | null>(null);
    const [attLoading, setAttLoading] = useState(false);
    const [punching, setPunching] = useState(false);
    const [profile, setProfile] = useState<EmployeeProfile | null>(null);
    const [profileLoading, setProfileLoading] = useState(false);

    const displayName = profile?.name ?? user?.name ?? "Employee";
    const displayDesignation = profile?.designation ?? user?.designation ?? "Software Developer";
    const salaryValue =
        typeof profile?.salary === "number"
            ? `$${profile.salary.toLocaleString()}`
            : "$40,000";

    useEffect(() => {
        if (isLoading) {
            return;
        }

        if (!user) {
            router.replace("/");
            return;
        }

        if (user.role !== "emp") {
            router.replace("/(tabs)");
            return;
        }

        loadAttendance();
        loadProfile();
    }, [isLoading, user]);

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

    if (isLoading || !user || user.role !== "emp") {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#D4A537" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.headerTop}>
                    <Pressable style={styles.headerIcon}>
                        <Ionicons name="menu" size={22} color="#111827" />
                    </Pressable>
                    <View style={styles.headerActions}>
                        <Pressable style={styles.headerIcon}>
                            <Ionicons name="notifications-outline" size={20} color="#D4A537" />
                        </Pressable>
                        <Pressable style={styles.headerIcon} onPress={handleLogout}>
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
                    <Pressable style={styles.punchButton} onPress={handlePunch} disabled={punching || attLoading}>
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
                    <Pressable style={styles.viewMoreButton}>
                        <Text style={styles.viewMoreText}>View More</Text>
                    </Pressable>
                </View>

                <View style={styles.payslipCard}>
                    <View style={styles.cardHeaderRow}>
                        <Text style={styles.cardHeader}>Payslips</Text>
                        <Text style={styles.cardSubtle}>2025</Text>
                    </View>
                    {payslips.map((item) => (
                        <View key={item.month} style={styles.payslipRow}>
                            <View>
                                <Text style={styles.payslipMonth}>
                                    {item.month}
                                </Text>
                                <Text style={styles.payslipLabel}>
                                    {item.label}
                                </Text>
                            </View>
                            <Pressable style={styles.downloadBadge}>
                                <Text style={styles.downloadText}>
                                    {item.badge}
                                </Text>
                            </Pressable>
                        </View>
                    ))}
                </View>

                <View style={styles.activityCard}>
                    <View style={styles.cardHeaderRow}>
                        <Text style={styles.cardHeader}>Recent Activity</Text>
                        <Text style={styles.cardSubtle}>Today</Text>
                    </View>
                    {activities.map((activity) => (
                        <View key={activity.title} style={styles.activityRow}>
                            <View
                                style={[
                                    styles.activityMarker,
                                    { backgroundColor: `${activity.color}33` },
                                ]}
                            >
                                <View
                                    style={[
                                        styles.activityDot,
                                        { backgroundColor: activity.color },
                                    ]}
                                />
                            </View>
                            <View style={styles.activityTextBlock}>
                                <Text style={styles.activityTitle}>
                                    {activity.title}
                                </Text>
                                <Text style={styles.activityLabel}>
                                    {activity.description}
                                </Text>
                            </View>
                            <Text style={styles.activityTime}>
                                {activity.time}
                            </Text>
                        </View>
                    ))}
                </View>
            </ScrollView>

            <View style={styles.bottomBar}>
                <Pressable style={styles.bottomIconActive}>
                    <Ionicons name="home" size={22} color="#D4A537" />
                </Pressable>
                <Pressable
                    style={styles.bottomIcon}
                    onPress={() => router.replace("/leave")}
                >
                    <Ionicons name="calendar-outline" size={22} color="#9CA3AF" />
                </Pressable>
                <Pressable style={styles.bottomIcon}>
                    <Ionicons name="card-outline" size={22} color="#9CA3AF" />
                </Pressable>
                <Pressable style={styles.bottomIcon}>
                    <Ionicons name="person-outline" size={22} color="#9CA3AF" />
                </Pressable>
            </View>
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
