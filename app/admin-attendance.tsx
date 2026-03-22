import SkeletonBlock from "@/components/SkeletonBlock";
import { CACHE_TTL } from "@/constants/cache";
import { useAuth } from "@/contexts/AuthContext";
import {
    fetchCheckinImageUrl,
    fetchEmployeeAttendanceImage,
    fetchTodayAttendance,
    TodayAttendanceItem,
} from "@/services/attendance";
import { getCachedData, setCachedData } from "@/stores/cacheStore";
import { logger } from "@/utils/logger";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    Modal,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";


export default function AdminAttendanceScreen() {
    const { user, isLoading } = useAuth();
    const insets = useSafeAreaInsets();
    const BOTTOM_BAR_BASE_HEIGHT = 76;
    const [status, setStatus] = useState<
        "checkedin" | "checkedout" | "notcheckedin"
    >("checkedin");
    const [data, setData] = useState<TodayAttendanceItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [modalContent, setModalContent] = useState<{
        employeeId: string;
        name?: string;
        attendanceId?: string;
        imageUrl?: string | null;
        checkInTime?: string | null;
    } | null>(null);

    useEffect(() => {
        if (!isLoading && user && user.role !== "emp") {
            load();
        }
    }, [status, isLoading, user]);

    const getInitials = (name?: string) => {
        if (!name) return '';
        const parts = name.trim().split(/\s+/);
        if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
        return (parts[0][0] + (parts[1][0] ?? '')).slice(0, 2).toUpperCase();
    };

    const load = async (force: boolean = false) => {
        const requestStatus =
            status === "checkedin"
                ? "checkedin"
                : status === "checkedout"
                  ? "checkedout"
                  : "notcheckedin";
        const cacheKey = `admin:attendance:${requestStatus}`;

        if (!force) {
            const cached = getCachedData<TodayAttendanceItem[]>(
                cacheKey,
            );
            if (cached) {
                setData(cached);
                return;
            }
        }

        setLoading(true);
        try {
            const items = await fetchTodayAttendance(requestStatus);
            const next = items || [];
            setData(next);
            setCachedData(cacheKey, next, CACHE_TTL.ATTENDANCE);
        } catch (error: any) {
            logger.warn("fetch today attendance failed", error?.message);
            Alert.alert(
                "Load failed",
                error?.message || "Unable to load attendance",
            );
        } finally {
            setLoading(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        try {
            await load(true);
        } catch (err) {
            logger.warn("refresh failed", err);
        } finally {
            setRefreshing(false);
        }
    };

    if (isLoading) {
        return (
            <SafeAreaView style={styles.container}>
                <ScrollView
                    contentContainerStyle={{
                        padding: 16,
                        paddingBottom:
                            BOTTOM_BAR_BASE_HEIGHT + insets.bottom + 40,
                    }}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            colors={["#D4A537"]}
                        />
                    }
                >
                    <SkeletonBlock
                        style={{ height: 28, width: 220, marginBottom: 8 }}
                    />
                    <SkeletonBlock
                        style={{ height: 18, width: 140, marginBottom: 16 }}
                    />
                    <SkeletonBlock
                        style={{
                            height: 120,
                            borderRadius: 12,
                            marginBottom: 12,
                        }}
                    />
                    <SkeletonBlock
                        style={{
                            height: 120,
                            borderRadius: 12,
                            marginBottom: 12,
                        }}
                    />
                    <SkeletonBlock
                        style={{
                            height: 120,
                            borderRadius: 12,
                            marginBottom: 12,
                        }}
                    />
                </ScrollView>
            </SafeAreaView>
        );
    }

    if (!user) {
        return (
            <View style={styles.center}>
                <ActivityIndicator />
            </View>
        );
    }

    const renderItem = ({ item }: { item: TodayAttendanceItem }) => {
        return <RowWithThumbnail item={item} />;
    };

    function RowWithThumbnail({ item }: { item: TodayAttendanceItem }) {
        const [imgUri, setImgUri] = useState<string | null>(null);
        const [loadingImg, setLoadingImg] = useState(false);

        useEffect(() => {
            let mounted = true;
            if (item.hasCheckInImage) {
                const imageKey = `admin:attendance:image-url:${item.employeeId}`;
                const cachedImage = getCachedData<string | null>(
                    imageKey,
                );
                if (cachedImage) {
                    setImgUri(cachedImage);
                    return () => {
                        mounted = false;
                    };
                }

                setLoadingImg(true);
                fetchCheckinImageUrl(item.employeeId)
                    .then((u) => {
                        if (!mounted) return;
                        setImgUri(u);
                        setCachedData(imageKey, u, CACHE_TTL.IMAGE);
                    })
                    .catch(() => {
                        if (!mounted) return;
                        setImgUri(null);
                    })
                    .finally(() => mounted && setLoadingImg(false));
            }
            return () => {
                mounted = false;
            };
        }, [item.employeeId, item.hasCheckInImage]);

        const openModal = async () => {
            setModalContent({ employeeId: item.employeeId, name: item.name });
            setModalVisible(true);
            try {
                const modalImageKey =
                    `admin:attendance:image-detail:${item.employeeId}`;
                const cachedDetails = getCachedData<{
                    attendanceId?: string;
                    imageUrl?: string | null;
                    checkInTime?: string | null;
                }>(modalImageKey);
                if (cachedDetails) {
                    setModalContent((prev) => {
                        if (!prev) return null;
                        return {
                            employeeId: prev.employeeId,
                            name: prev.name,
                            attendanceId: cachedDetails.attendanceId,
                            imageUrl: cachedDetails.imageUrl ?? null,
                            checkInTime: cachedDetails.checkInTime ?? null,
                        };
                    });
                    return;
                }

                const data = await fetchEmployeeAttendanceImage(
                    item.employeeId,
                );
                setCachedData(modalImageKey, {
                    attendanceId: data?.attendanceId,
                    imageUrl: data?.imageUrl ?? null,
                    checkInTime: data?.checkInTime ?? null,
                }, CACHE_TTL.IMAGE);
                setModalContent((prev) => {
                    if (!prev) return null;
                    return {
                        employeeId: prev.employeeId,
                        name: prev.name,
                        attendanceId: data?.attendanceId,
                        imageUrl: data?.imageUrl ?? null,
                        checkInTime: data?.checkInTime ?? null,
                    };
                });
            } catch (err) {
                logger.warn("fetch employee image failed", err);
            }
        };

        return (
            <Pressable style={styles.card} onPress={openModal}>
                <View style={styles.cardLeft}>
                    <View style={styles.avatarPlaceholder}>
                        <Text style={styles.avatarInitials}>{getInitials(item.name)}</Text>
                    </View>
                </View>

                <View style={styles.cardBody}>
                    <Text style={styles.cardName}>{item.name}</Text>
                    <Text style={styles.cardRole}>
                        {item.department || "-"} • {item.employeeId}
                    </Text>
                </View>

                <View style={styles.cardRight}>
                    <Text style={styles.approvedLabel}>
                        {item.checkInTime ? "" : item.status || ""}
                    </Text>
                    {item.checkInTime ? (
                        <Text style={styles.approvedDate}>
                            {new Date(item.checkInTime).toLocaleDateString()}
                        </Text>
                    ) : null}
                    {item.hasCheckInImage ? (
                        imgUri ? (
                            <Image
                                source={{ uri: imgUri }}
                                style={styles.thumbSmall}
                            />
                        ) : loadingImg ? (
                            <ActivityIndicator style={{ marginTop: 6 }} />
                        ) : (
                            <Ionicons
                                name="image"
                                size={20}
                                color="#6B7280"
                                style={{ marginTop: 8 }}
                            />
                        )
                    ) : null}
                </View>
            </Pressable>
        );
    }

    const closeModal = () => {
        setModalVisible(false);
        setModalContent(null);
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.headerRow}>
                <Pressable style={styles.backBtn} onPress={() => router.back()}>
                    <Ionicons name="chevron-back" size={22} color="#111827" />
                </Pressable>
                <Text style={styles.headerTitle}>Today's Attendance</Text>
                <View style={{ width: 38 }} />
            </View>

            <View style={styles.tabs}>
                <Pressable
                    style={[
                        styles.tab,
                        status === "checkedin" && styles.tabActive,
                    ]}
                    onPress={() => setStatus("checkedin")}
                >
                    <Text
                        style={
                            status === "checkedin"
                                ? styles.tabTextActive
                                : styles.tabText
                        }
                    >
                        Checked In
                    </Text>
                </Pressable>
                <Pressable
                    style={[
                        styles.tab,
                        status === "checkedout" && styles.tabActive,
                    ]}
                    onPress={() => setStatus("checkedout")}
                >
                    <Text
                        style={
                            status === "checkedout"
                                ? styles.tabTextActive
                                : styles.tabText
                        }
                    >
                        Checked Out
                    </Text>
                </Pressable>
                <Pressable
                    style={[
                        styles.tab,
                        status === "notcheckedin" && styles.tabActive,
                    ]}
                    onPress={() => setStatus("notcheckedin")}
                >
                    <Text
                        style={
                            status === "notcheckedin"
                                ? styles.tabTextActive
                                : styles.tabText
                        }
                    >
                        Not Checked In
                    </Text>
                </Pressable>
            </View>

            <View style={styles.content}>
                {loading ? (
                    <View style={styles.center}>
                        <ActivityIndicator />
                    </View>
                ) : data.length === 0 ? (
                    <View style={styles.center}>
                        <Text style={styles.empty}>No records found.</Text>
                    </View>
                ) : (
                    <FlatList
                        data={data}
                        keyExtractor={(i) => i.employeeId}
                        renderItem={renderItem}
                        showsVerticalScrollIndicator={true}
                        contentContainerStyle={{
                            paddingBottom:
                                BOTTOM_BAR_BASE_HEIGHT + insets.bottom + 44,
                        }}
                        ItemSeparatorComponent={() => (
                            <View style={styles.sep} />
                        )}
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                    />
                )}
            </View>

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
                    onPress={() => router.replace("/admin")}
                >
                    <Ionicons name="home" size={22} color="#9CA3AF" />
                </Pressable>

                <Pressable
                    style={styles.bottomIcon}
                    onPress={() => router.replace("/admin-leaves")}
                >
                    <Ionicons name="leaf" size={22} color="#9CA3AF" />
                </Pressable>
                <Pressable
                    style={styles.bottomIconActive}
                    onPress={() => router.push("/admin-attendance")}
                >
                    <Ionicons name="layers-outline" size={22} color="#D4A537" />
                </Pressable>
                <Pressable
                                    style={styles.bottomIcon}
                                    onPress={() => router.push("/admin-policy")}
                                >
                                    <Ionicons name="settings-outline" size={22} color="#9CA3AF" />
                                </Pressable>
            </View>
            <Modal
                visible={modalVisible}
                transparent
                animationType="fade"
                onRequestClose={closeModal}
            >
                <Pressable style={styles.modalOverlay} onPress={closeModal}>
                    <View style={styles.modalCard}>
                        {modalContent?.imageUrl ? (
                            <Image
                                source={{ uri: modalContent.imageUrl }}
                                style={styles.modalImage}
                                resizeMode="contain"
                            />
                        ) : (
                            <View style={styles.modalPlaceholder}>
                                <Ionicons
                                    name="image"
                                    size={48}
                                    color="#9CA3AF"
                                />
                                <Text style={styles.modalNoImage}>
                                    No image available
                                </Text>
                            </View>
                        )}
                        <Text style={styles.modalName}>
                            {modalContent?.name}
                        </Text>
                        <Text style={styles.modalMeta}>
                            ID: {modalContent?.employeeId}
                        </Text>
                        {modalContent?.attendanceId ? (
                            <Text style={styles.modalMeta}>
                                Attendance: {modalContent.attendanceId}
                            </Text>
                        ) : null}
                        {modalContent?.checkInTime ? (
                            <Text style={styles.modalMeta}>
                                Time:{" "}
                                {new Date(
                                    modalContent.checkInTime,
                                ).toLocaleString()}
                            </Text>
                        ) : null}
                        <Pressable
                            style={styles.modalClose}
                            onPress={closeModal}
                        >
                            <Text style={styles.modalCloseText}>Close</Text>
                        </Pressable>
                    </View>
                </Pressable>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#FFFFFF",
        paddingTop: 10,
        paddingHorizontal: 12,
    },
    headerRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 24,
    },
    backButton: { padding: 8, marginRight: 8 },
    headerTitle: {
        fontSize: 18,
        color: "#1F2937",
        fontWeight: "600",
    },
    tabs: {
        flexDirection: "row",
        paddingHorizontal: 12,
        gap: 8,
        marginBottom: 8,
    },
    tab: {
        flex: 1,
        paddingVertical: 10,
        alignItems: "center",
        borderRadius: 8,
        backgroundColor: "#F3F4F6",
    },
    tabActive: { backgroundColor: "#D4A537" },
    tabText: { color: "#374151", fontWeight: "600" },
    tabTextActive: { color: "#111827", fontWeight: "700" },
    content: { flex: 1, paddingHorizontal: 12, paddingTop: 8 },
    avatarInitials: { fontSize: 15,
    fontWeight: '600',
    color: '#111111', },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    empty: { color: "#6B7280" },
    row: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 12,
    },
    rowLeft: {},
    rowRight: { alignItems: "flex-end" },
    name: { fontWeight: "700", color: "#111827" },
    meta: { color: "#6B7280", fontSize: 12, marginTop: 2 },
    time: { color: "#111827", fontWeight: "600" },
    statusText: { color: "#6B7280" },
    sep: { height: 1, backgroundColor: "#F3F4F6" },
    thumb: { width: 44, height: 44, borderRadius: 6, marginTop: 6 },
    thumbSmall: { width: 36, height: 36, borderRadius: 8, marginTop: 8 },
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
    /* Card styles */
    card: {
        backgroundColor: "#FFFFFF",
        borderRadius: 14,
        padding: 16,
        marginBottom: 12,
        flexDirection: "row",
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.06,
        shadowRadius: 16,
        elevation: 2,
    },
    cardLeft: { width: 56, alignItems: "center", justifyContent: "center" },
    avatarPlaceholder: {
        height: 50,
    width: 50,
    borderRadius: 25,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    },
    cardBody: { flex: 1, paddingHorizontal: 12 },
    cardName: { fontWeight: "700", color: "#111827" },
    cardRole: { color: "#6B7280", marginTop: 4, fontSize: 12 },
    cardRight: { alignItems: "flex-end", minWidth: 100 },
    approvedLabel: { color: "#D4A537", fontWeight: "700", fontSize: 12 },
    approvedDate: { color: "#D4A537", fontWeight: "700", marginTop: 6 },
    modalOverlay: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "rgba(0,0,0,0.5)",
    },
    modalCard: {
        width: "90%",
        backgroundColor: "#FFF",
        borderRadius: 12,
        padding: 16,
        alignItems: "center",
    },
    modalImage: {
        width: "100%",
        height: 320,
        borderRadius: 8,
        backgroundColor: "#F3F4F6",
    },
    modalPlaceholder: {
        width: "100%",
        height: 320,
        borderRadius: 8,
        backgroundColor: "#F8FAFC",
        justifyContent: "center",
        alignItems: "center",
    },
    modalNoImage: { color: "#6B7280", marginTop: 8 },
    modalName: { fontWeight: "700", marginTop: 12, color: "#111827" },
    modalMeta: { color: "#6B7280", marginTop: 6 },
    modalClose: {
        marginTop: 12,
        backgroundColor: "#D4A537",
        paddingVertical: 8,
        paddingHorizontal: 20,
        borderRadius: 8,
    },
    modalCloseText: { color: "#111827", fontWeight: "700" },
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
});
