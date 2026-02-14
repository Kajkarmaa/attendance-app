import { useAuth } from "@/contexts/AuthContext";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

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

export default function EmployeeDashboard() {
    const { user } = useAuth();

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.name}>{user?.name ?? "Employee"}</Text>
                <Text style={styles.subtitle}>{user?.designation ?? "Software Developer"}</Text>
                <Text style={styles.date}>Dec 14, 2025</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.attendanceCard}>
                    <View style={styles.attendanceText}>
                        <Text style={styles.sectionLabel}>Attendance</Text>
                        <Text style={styles.attendanceTime}>09:05 AM</Text>
                        <Text style={styles.attendanceShift}>Standard shift: 09:30 AM - 06:30 PM</Text>
                    </View>
                    <Pressable style={styles.punchButton}>
                        <Text style={styles.punchText}>Punch In</Text>
                    </Pressable>
                    <View style={styles.clockRow}>
                        <View>
                            <Text style={styles.clockLabel}>Clock In</Text>
                            <Text style={styles.clockValue}>--:--</Text>
                        </View>
                        <View style={styles.divider} />
                        <View>
                            <Text style={styles.clockLabel}>Clock Out</Text>
                            <Text style={styles.clockValue}>--:--</Text>
                        </View>
                    </View>
                </View>

                <View style={styles.salaryCard}>
                    <View>
                        <Text style={styles.salaryLabel}>Estimated net salary (FYE)</Text>
                        <Text style={styles.salaryValue}>$40,000</Text>
                        <Text style={styles.salaryDate}>Last credited 31 Dec 2025</Text>
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
                                <Text style={styles.payslipMonth}>{item.month}</Text>
                                <Text style={styles.payslipLabel}>{item.label}</Text>
                            </View>
                            <Pressable style={styles.downloadBadge}>
                                <Text style={styles.downloadText}>{item.badge}</Text>
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
                            <View style={[styles.activityMarker, { backgroundColor: `${activity.color}33` }]}>
                                <View style={[styles.activityDot, { backgroundColor: activity.color }]} />
                            </View>
                            <View style={styles.activityTextBlock}>
                                <Text style={styles.activityTitle}>{activity.title}</Text>
                                <Text style={styles.activityLabel}>{activity.description}</Text>
                            </View>
                            <Text style={styles.activityTime}>{activity.time}</Text>
                        </View>
                    ))}
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#FFFFFF",
    },
    header: {
        paddingTop: 56,
        paddingHorizontal: 24,
        paddingBottom: 16,
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
    date: {
        marginTop: 4,
        fontSize: 12,
        color: "#9CA3AF",
        letterSpacing: 1,
    },
    content: {
        paddingHorizontal: 24,
        paddingBottom: 40,
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
});
