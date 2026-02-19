import { useAuth } from "@/contexts/AuthContext";
import { API_BASE_URL } from "@/services/api";
import {
    approveAdminLeave,
    fetchAdminLeaves,
    rejectAdminLeave,
    type AdminLeaveItem,
} from "@/services/leaves";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Linking,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

export default function AdminLeavesScreen() {
    const { user, isLoading } = useAuth();
    const [allLeaves, setAllLeaves] = useState<AdminLeaveItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
    const [actionLoadingType, setActionLoadingType] = useState<"approve" | "reject" | null>(null);
    const [activeTab, setActiveTab] = useState<"pending" | "approved" | "rejected">(
        "pending",
    );
    const [comments, setComments] = useState<Record<string, string>>({});

    useEffect(() => {
        if (isLoading) return;
        if (!user) {
            router.replace("/");
            return;
        }
        if (user.role === "emp") {
            router.replace("/employee");
            return;
        }
        loadLeaves();
    }, [isLoading, user]);

    const loadLeaves = async () => {
        setLoading(true);
        try {
            const data = await fetchAdminLeaves("all");
            setAllLeaves(data ?? []);
        } catch (error: any) {
            console.log("admin leaves fetch failed", error?.message);
            Alert.alert("Error", "Unable to load leave requests.");
        } finally {
            setLoading(false);
        }
    };

    const counts = useMemo(() => {
        return allLeaves.reduce(
            (acc, item) => {
                const status = (item.status || "pending").toLowerCase();
                if (status === "approved") acc.approved += 1;
                else if (status === "rejected") acc.rejected += 1;
                else acc.pending += 1;
                acc.total += 1;
                return acc;
            },
            { total: 0, pending: 0, approved: 0, rejected: 0 },
        );
    }, [allLeaves]);

    const leavesForTab = useMemo(() => {
        return allLeaves.filter(
            (item) => (item.status || "pending").toLowerCase() === activeTab,
        );
    }, [allLeaves, activeTab]);

    const formatDate = (iso?: string) => {
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

    const statusStylesFor = (status: string) => {
        switch (status) {
            case "approved":
                return { pill: styles.statusApproved, text: styles.statusApprovedText };
            case "rejected":
                return { pill: styles.statusRejected, text: styles.statusRejectedText };
            default:
                return { pill: styles.statusPending, text: styles.statusPendingText };
        }
    };

    const handleDownloadAttachment = async (item: AdminLeaveItem) => {
        try {
            const fileName = item.attachments?.[0];
            if (!fileName) {
                if ((item.attachmentCount ?? 0) > 0) {
                    Alert.alert("Unavailable", "Attachment metadata missing. Please refresh and try again.");
                    return;
                }
                Alert.alert("No attachment", "This request has no downloadable file.");
                return;
            }

            const isAbsolute = fileName.startsWith("http://") || fileName.startsWith("https://");
            const url = isAbsolute
                ? fileName
                : `${API_BASE_URL}/leaves/attachment/download?leaveId=${encodeURIComponent(item.id)}&fileName=${encodeURIComponent(fileName)}`;

            const supported = await Linking.canOpenURL(url);
            if (!supported) {
                Alert.alert("Unavailable", "Unable to open the attachment link.");
                return;
            }

            await Linking.openURL(url);
        } catch (error: any) {
            console.log("attachment open failed", error?.message);
            Alert.alert("Error", "Could not open the attachment.");
        }
    };

    const handleDownloadPress = (item: AdminLeaveItem) => {
        if ((item.attachments?.length ?? 0) > 0) {
            handleDownloadAttachment(item);
            return;
        }
        Alert.alert("Unavailable", "Attachment link not available yet. Please refresh and try again.");
    };

    const handleApprove = async (id: string, note: string) => {
        const trimmed = note.trim();
        if (!trimmed) {
            Alert.alert("Comment required", "Please add a comment before approving.");
            return;
        }
        const previous = [...allLeaves];
        setAllLeaves((current) =>
            current.map((item) =>
                item.id === id ? { ...item, status: "approved" } : item,
            ),
        );
        setActionLoadingId(id);
        setActionLoadingType("approve");
        try {
            await approveAdminLeave(id, trimmed);
            setComments((prev) => {
                const next = { ...prev };
                delete next[id];
                return next;
            });
            await loadLeaves();
        } catch (error: any) {
            console.log("approve failed", error?.message);
            Alert.alert("Error", "Unable to approve the request.");
            setAllLeaves(previous);
        } finally {
            setActionLoadingId(null);
            setActionLoadingType(null);
        }
    };

    const handleReject = async (id: string, note: string) => {
        const trimmed = note.trim();
        if (!trimmed) {
            Alert.alert("Comment required", "Please add a comment before rejecting.");
            return;
        }
        const previous = [...allLeaves];
        setAllLeaves((current) =>
            current.map((item) =>
                item.id === id ? { ...item, status: "rejected" } : item,
            ),
        );
        setActionLoadingId(id);
        setActionLoadingType("reject");
        try {
            await rejectAdminLeave(id, trimmed);
            setComments((prev) => {
                const next = { ...prev };
                delete next[id];
                return next;
            });
            await loadLeaves();
        } catch (error: any) {
            console.log("reject failed", error?.message);
            Alert.alert("Error", "Unable to reject the request.");
            setAllLeaves(previous);
        } finally {
            setActionLoadingId(null);
            setActionLoadingType(null);
        }
    };

    if (isLoading || !user) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#D4A537" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.headerRow}>
                <View>
                    <Text style={styles.heading}>Leave Requests</Text>
                    <Text style={styles.subheading}>Admin overview</Text>
                </View>
                <Pressable onPress={loadLeaves} style={styles.refreshBtn}>
                    {loading ? (
                        <ActivityIndicator size="small" color="#D4A537" />
                    ) : (
                        <Ionicons name="refresh" size={18} color="#9CA3AF" />
                    )}
                </Pressable>
            </View>

            <View style={styles.statsRow}>
                <View style={styles.statCard}>
                    <Text style={styles.statLabel}>Total</Text>
                    <Text style={styles.statValue}>{counts.total}</Text>
                </View>
                <View style={styles.statCard}>
                    <Text style={styles.statLabel}>Pending</Text>
                    <Text style={styles.statValuePending}>{counts.pending}</Text>
                </View>
                <View style={styles.statCard}>
                    <Text style={styles.statLabel}>Approved</Text>
                    <Text style={styles.statValueApproved}>{counts.approved}</Text>
                </View>
                <View style={styles.statCard}>
                    <Text style={styles.statLabel}>Rejected</Text>
                    <Text style={styles.statValueRejected}>{counts.rejected}</Text>
                </View>
            </View>

            <View style={styles.tabRow}>
                <Pressable
                    style={[
                        styles.tabButton,
                        activeTab === "pending" && styles.tabButtonActive,
                    ]}
                    onPress={() => setActiveTab("pending")}
                >
                    <Text
                        style={
                            activeTab === "pending"
                                ? styles.tabTextActive
                                : styles.tabText
                        }
                    >
                        Pending
                    </Text>
                </Pressable>
                <Pressable
                    style={[
                        styles.tabButton,
                        activeTab === "approved" && styles.tabButtonActive,
                    ]}
                    onPress={() => setActiveTab("approved")}
                >
                    <Text
                        style={
                            activeTab === "approved"
                                ? styles.tabTextActive
                                : styles.tabText
                        }
                    >
                        Approved
                    </Text>
                </Pressable>
                <Pressable
                    style={[
                        styles.tabButton,
                        activeTab === "rejected" && styles.tabButtonActive,
                    ]}
                    onPress={() => setActiveTab("rejected")}
                >
                    <Text
                        style={
                            activeTab === "rejected"
                                ? styles.tabTextActive
                                : styles.tabText
                        }
                    >
                        Rejected
                    </Text>
                </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.listContent}>
                {loading && (
                    <View style={styles.inlineLoadingRow}>
                        <ActivityIndicator size="small" color="#D4A537" />
                        <Text style={styles.inlineLoadingText}>Loading requests…</Text>
                    </View>
                )}

                {!loading && leavesForTab.length === 0 && (
                    <Text style={styles.emptyText}>No leave requests found.</Text>
                )}

                {!loading &&
                    leavesForTab.map((item) => {
                        const status = (item.status || "pending").toLowerCase();
                        const statusStyles = statusStylesFor(status);
                        const isWorking = actionLoadingId === item.id;
                        const isApproveWorking = isWorking && actionLoadingType === "approve";
                        const isRejectWorking = isWorking && actionLoadingType === "reject";
                        const note = (comments[item.id] || "").trim();
                        const disableReject = isRejectWorking || !note;
                        const disableApprove = isApproveWorking || !note;
                        return (
                            <View key={item.id} style={styles.leaveCard}>
                                <View style={styles.leaveHeader}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.employeeName}>
                                            {item.employee?.name || "Unknown"}
                                        </Text>
                                        <Text style={styles.employeeMeta}>
                                            {item.employee?.employeeId || ""} • {item.type}
                                        </Text>
                                        <Text style={styles.employeeMeta}>
                                            {item.employee?.department || ""}
                                        </Text>
                                    </View>
                                    <View style={[styles.statusPill, statusStyles.pill]}>
                                        <Text style={statusStyles.text}>{status}</Text>
                                    </View>
                                </View>

                                <Text style={styles.dateText}>
                                    {formatDate(item.startDate)} - {formatDate(item.endDate)} · {item.days} day(s)
                                </Text>
                                <Text style={styles.reasonText} numberOfLines={2}>
                                    {item.reason || "No reason provided"}
                                </Text>
                                <Text style={styles.attachmentText}>
                                    Attachments: {item.attachmentCount ?? 0}
                                </Text>

                                {(item.attachments?.length ?? 0) > 0 || (item.attachmentCount ?? 0) > 0 ? (
                                    <Pressable
                                        style={[
                                            styles.downloadRow,
                                            (item.attachments?.length ?? 0) === 0 && { opacity: 0.6 },
                                        ]}
                                        onPress={() => handleDownloadPress(item)}
                                    >
                                        <Pressable
                                            onPress={() => handleDownloadPress(item)}
                                            hitSlop={10}
                                        >
                                            <Ionicons name="download-outline" size={18} color="#111827" />
                                        </Pressable>
                                        <View style={{ flex: 1, marginHorizontal: 8 }}>
                                            <Text style={styles.downloadLabel}>Download</Text>
                                            <Text style={styles.downloadFile} numberOfLines={1}>
                                                {(item.attachments?.length ?? 0) > 0
                                                    ? item.attachments?.[0]
                                                    : "Attachment link not available"}
                                            </Text>
                                        </View>
                                        <Pressable
                                            onPress={() => handleDownloadPress(item)}
                                            hitSlop={10}
                                        >
                                            <Ionicons name="open-outline" size={16} color="#9CA3AF" />
                                        </Pressable>
                                    </Pressable>
                                ) : null}

                                {status === "pending" && (
                                    <View style={styles.commentBlock}>
                                        <Text style={styles.commentLabel}>Comment</Text>
                                        <TextInput
                                            style={styles.commentInput}
                                            placeholder="Add a note for this decision"
                                            placeholderTextColor="#9CA3AF"
                                            value={comments[item.id] || ""}
                                            onChangeText={(text) =>
                                                setComments((prev) => ({ ...prev, [item.id]: text }))
                                            }
                                            multiline
                                        />
                                    </View>
                                )}

                                {status === "pending" && (
                                    <View style={styles.actionRow}>
                                        <Pressable
                                            style={[
                                                styles.actionBtn,
                                                styles.rejectBtn,
                                                disableReject && styles.actionBtnDisabled,
                                            ]}
                                            onPress={() => handleReject(item.id, note)}
                                            disabled={disableReject}
                                        >
                                            {isRejectWorking ? (
                                                <ActivityIndicator size="small" color="#DC2626" />
                                            ) : (
                                                <Text style={styles.rejectText}>Reject</Text>
                                            )}
                                        </Pressable>
                                        <Pressable
                                            style={[
                                                styles.actionBtn,
                                                styles.approveBtn,
                                                disableApprove && styles.actionBtnDisabled,
                                            ]}
                                            onPress={() => handleApprove(item.id, note)}
                                            disabled={disableApprove}
                                        >
                                            {isApproveWorking ? (
                                                <ActivityIndicator size="small" color="#FFFFFF" />
                                            ) : (
                                                <Text style={styles.approveText}>Approve</Text>
                                            )}
                                        </Pressable>
                                    </View>
                                )}
                            </View>
                        );
                    })}

                <View style={{ height: 120 }} />
            </ScrollView>

            <View style={styles.bottomBar}>
                <Pressable
                    style={styles.bottomIcon}
                    onPress={() => router.replace("/admin")}
                >
                    <Ionicons name="home" size={22} color="#9CA3AF" />
                </Pressable>
                <Pressable
                    style={styles.bottomIconActive}
                    onPress={() => router.replace("/admin-leaves")}
                >
                    <Ionicons name="leaf" size={22} color="#D4A537" />
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
    headerRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 20,
        paddingTop: 52,
        paddingBottom: 12,
    },
    heading: {
        fontSize: 22,
        fontWeight: "700",
        color: "#111827",
    },
    subheading: {
        fontSize: 13,
        color: "#6B7280",
        marginTop: 4,
    },
    refreshBtn: {
        height: 36,
        width: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "#E5E7EB",
    },
    statsRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        paddingHorizontal: 20,
        gap: 10,
    },
    statCard: {
        flex: 1,
        backgroundColor: "#FFFFFF",
        padding: 12,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: "#E5E7EB",
    },
    statLabel: {
        color: "#6B7280",
        fontSize: 12,
    },
    statValue: {
        color: "#111827",
        fontWeight: "700",
        fontSize: 20,
        marginTop: 4,
    },
    statValuePending: {
        color: "#F59E0B",
        fontWeight: "700",
        fontSize: 20,
        marginTop: 4,
    },
    statValueApproved: {
        color: "#10B981",
        fontWeight: "700",
        fontSize: 20,
        marginTop: 4,
    },
    statValueRejected: {
        color: "#DC2626",
        fontWeight: "700",
        fontSize: 20,
        marginTop: 4,
    },
    tabRow: {
        flexDirection: "row",
        paddingHorizontal: 20,
        marginTop: 16,
        gap: 10,
    },
    tabButton: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#E5E7EB",
        alignItems: "center",
        backgroundColor: "#FFFFFF",
    },
    tabButtonActive: {
        backgroundColor: "#111827",
        borderColor: "#111827",
    },
    tabText: {
        color: "#374151",
        fontWeight: "700",
        letterSpacing: 0.3,
    },
    tabTextActive: {
        color: "#FFFFFF",
        fontWeight: "700",
        letterSpacing: 0.3,
    },
    listContent: {
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 24,
    },
    inlineLoadingRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        marginTop: 24,
    },
    inlineLoadingText: {
        color: "#6B7280",
        fontWeight: "600",
    },
    emptyText: {
        color: "#9CA3AF",
        textAlign: "center",
        marginTop: 24,
    },
    leaveCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: "#E5E7EB",
        marginBottom: 12,
        shadowColor: "#000",
        shadowOpacity: 0.04,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 6 },
        elevation: 2,
    },
    leaveHeader: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 8,
    },
    employeeName: {
        fontSize: 16,
        fontWeight: "700",
        color: "#111827",
    },
    employeeMeta: {
        fontSize: 12,
        color: "#6B7280",
        marginTop: 2,
    },
    statusPill: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
    },
    statusPending: {
        backgroundColor: "#FEF3C7",
    },
    statusPendingText: {
        color: "#D97706",
        fontWeight: "700",
        textTransform: "uppercase",
        fontSize: 11,
    },
    statusApproved: {
        backgroundColor: "#DCFCE7",
    },
    statusApprovedText: {
        color: "#15803D",
        fontWeight: "700",
        textTransform: "uppercase",
        fontSize: 11,
    },
    statusRejected: {
        backgroundColor: "#FEE2E2",
    },
    statusRejectedText: {
        color: "#B91C1C",
        fontWeight: "700",
        textTransform: "uppercase",
        fontSize: 11,
    },
    dateText: {
        color: "#4B5563",
        fontWeight: "600",
    },
    reasonText: {
        marginTop: 6,
        color: "#374151",
    },
    attachmentText: {
        marginTop: 6,
        color: "#9CA3AF",
        fontSize: 12,
    },
    downloadRow: {
        marginTop: 8,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#E5E7EB",
        backgroundColor: "#F9FAFB",
        flexDirection: "row",
        alignItems: "center",
    },
    downloadLabel: {
        color: "#4B5563",
        fontSize: 12,
        fontWeight: "700",
        textTransform: "uppercase",
        letterSpacing: 0.3,
    },
    downloadFile: {
        color: "#111827",
        fontSize: 13,
        marginTop: 2,
    },
    actionRow: {
        flexDirection: "row",
        gap: 12,
        marginTop: 12,
    },
    actionBtn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: "center",
        borderWidth: 1,
    },
    rejectBtn: {
        borderColor: "#FCA5A5",
        backgroundColor: "#FFF1F2",
    },
    approveBtn: {
        borderColor: "#111827",
        backgroundColor: "#111827",
    },
    rejectText: {
        color: "#B91C1C",
        fontWeight: "700",
    },
    approveText: {
        color: "#FFFFFF",
        fontWeight: "700",
    },
    actionBtnDisabled: {
        opacity: 0.5,
    },
    commentBlock: {
        marginTop: 10,
        gap: 6,
    },
    commentLabel: {
        color: "#374151",
        fontWeight: "700",
        fontSize: 12,
        textTransform: "uppercase",
        letterSpacing: 0.3,
    },
    commentInput: {
        borderWidth: 1,
        borderColor: "#E5E7EB",
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        minHeight: 44,
        color: "#111827",
        backgroundColor: "#FFFFFF",
    },
    bottomBar: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: "row",
        backgroundColor: "#111827",
        paddingVertical: 12,
        paddingHorizontal: 40,
        justifyContent: "space-between",
    },
    bottomIcon: {
        height: 44,
        width: 44,
        borderRadius: 22,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#1F2937",
        borderWidth: 1,
        borderColor: "#374151",
    },
    bottomIconActive: {
        height: 44,
        width: 44,
        borderRadius: 22,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#FBBF24",
        shadowColor: "#000",
        shadowOpacity: 0.18,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 4,
    },
});
