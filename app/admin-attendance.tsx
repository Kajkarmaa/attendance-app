import SkeletonBlock from "@/components/SkeletonBlock";
import { CACHE_TTL } from "@/constants/cache";
import { useAuth } from "@/contexts/AuthContext";
import {
    AttendanceLocation,
    fetchTodayAttendance,
    TodayAttendanceItem,
} from "@/services/attendance";
import { getCachedData, setCachedData } from "@/stores/cacheStore";
import { logger } from "@/utils/logger";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Linking,
    Modal,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
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
        checkInTime?: string | null;
        location?: AttendanceLocation | null;
    } | null>(null);
    const [viewerLocation, setViewerLocation] = useState<AttendanceLocation | null>(null);
    const [viewerLocationLoading, setViewerLocationLoading] = useState(false);
    const [viewerLocationError, setViewerLocationError] = useState<string | null>(null);

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

    const getLocationLabel = (location?: AttendanceLocation | null) => {
        if (!location) {
            return "No location data available";
        }

        if (location.label) {
            return location.label;
        }

        if (
            typeof location.latitude === "number" &&
            typeof location.longitude === "number"
        ) {
            return `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`;
        }

        return "No location data available";
    };

    const getRegionFromLocation = (location?: AttendanceLocation | null) => {
        if (
            typeof location?.latitude !== "number" ||
            typeof location?.longitude !== "number"
        ) {
            return null;
        }

        return {
            latitude: location.latitude,
            longitude: location.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
        };
    };

    const getDistanceKm = (
        from?: AttendanceLocation | null,
        to?: AttendanceLocation | null,
    ) => {
        if (
            typeof from?.latitude !== "number" ||
            typeof from?.longitude !== "number" ||
            typeof to?.latitude !== "number" ||
            typeof to?.longitude !== "number"
        ) {
            return null;
        }

        const toRadians = (value: number) => (value * Math.PI) / 180;
        const earthRadiusKm = 6371;
        const deltaLat = toRadians(to.latitude - from.latitude);
        const deltaLng = toRadians(to.longitude - from.longitude);
        const a =
            Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
            Math.cos(toRadians(from.latitude)) *
                Math.cos(toRadians(to.latitude)) *
                Math.sin(deltaLng / 2) *
                Math.sin(deltaLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return earthRadiusKm * c;
    };

    const loadViewerLocation = async () => {
        setViewerLocationLoading(true);
        setViewerLocationError(null);

        try {
            const permission = await Location.requestForegroundPermissionsAsync();
            if (permission.status !== "granted") {
                setViewerLocation(null);
                setViewerLocationError("Admin location permission was denied.");
                return;
            }

            const current = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });
            const latitude = current.coords.latitude;
            const longitude = current.coords.longitude;
            const [address] = await Location.reverseGeocodeAsync({
                latitude,
                longitude,
            });
            const city =
                address?.city ||
                address?.subregion ||
                address?.district ||
                undefined;
            const state = address?.region || undefined;

            setViewerLocation({
                latitude,
                longitude,
                city,
                state,
                label: [city, state].filter(Boolean).join(", ") || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
            });
        } catch (error) {
            logger.warn("fetch admin location failed", error);
            setViewerLocation(null);
            setViewerLocationError("Unable to get admin location.");
        } finally {
            setViewerLocationLoading(false);
        }
    };

    const openLocationInMaps = async (location?: AttendanceLocation | null) => {
        if (
            typeof location?.latitude !== "number" ||
            typeof location?.longitude !== "number"
        ) {
            Alert.alert("Location unavailable", "This employee has no location data.");
            return;
        }

        const query = encodeURIComponent(
            `${location.latitude},${location.longitude}`,
        );
        const url = `https://www.google.com/maps/search/?api=1&query=${query}`;
        const canOpen = await Linking.canOpenURL(url);
        if (!canOpen) {
            Alert.alert("Unable to open maps", "No maps application is available.");
            return;
        }

        await Linking.openURL(url);
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
        const openModal = () => {
            setModalContent({
                employeeId: item.employeeId,
                name: item.name,
                checkInTime: item.checkInTime ?? null,
                location: item.location ?? null,
            });
            setModalVisible(true);
            loadViewerLocation();
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
                </View>
            </Pressable>
        );
    }

    const closeModal = () => {
        setModalVisible(false);
        setModalContent(null);
        setViewerLocation(null);
        setViewerLocationError(null);
    };

    const employeeRegion = getRegionFromLocation(modalContent?.location);
    const viewerRegion = getRegionFromLocation(viewerLocation);
    const activeRegion = employeeRegion ?? viewerRegion;
    const distanceKm = getDistanceKm(viewerLocation, modalContent?.location);

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
                    <Ionicons name="document-text-outline" size={22} color="#9CA3AF" />
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
                <View
                    style={[
                        styles.modalOverlay,
                        {
                            paddingTop: Math.max(insets.top, 16),
                            paddingBottom: Math.max(insets.bottom, 16),
                        },
                    ]}
                >
                    <Pressable style={styles.modalBackdrop} onPress={closeModal} />
                    <View style={styles.modalShell} pointerEvents="box-none">
                        <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <View style={styles.modalHandle} />
                            <View style={styles.modalHeaderRow}>
                                <Text style={styles.modalHeaderTitle}>
                                    Employee Attendance
                                </Text>
                                <Pressable
                                    style={styles.modalHeaderClose}
                                    onPress={closeModal}
                                >
                                    <Ionicons
                                        name="close"
                                        size={18}
                                        color="#111827"
                                    />
                                </Pressable>
                            </View>
                        </View>
                        <ScrollView
                            style={styles.modalScroll}
                            contentContainerStyle={styles.modalScrollContent}
                            showsVerticalScrollIndicator={false}
                            bounces={false}
                            alwaysBounceVertical={false}
                            overScrollMode="never"
                            nestedScrollEnabled
                            keyboardShouldPersistTaps="handled"
                            scrollEventThrottle={16}
                        >
                            <View style={styles.locationBlock}>
                                <Text style={styles.locationHeading}>Employee Location</Text>
                                <Text style={styles.locationText}>
                                    {getLocationLabel(modalContent?.location)}
                                </Text>
                                {viewerLocationLoading ? (
                                    <Text style={styles.locationHint}>Getting admin location...</Text>
                                ) : viewerLocation ? (
                                    <Text style={styles.locationHint}>
                                        Your location: {getLocationLabel(viewerLocation)}
                                    </Text>
                                ) : viewerLocationError ? (
                                    <Text style={styles.locationHint}>{viewerLocationError}</Text>
                                ) : null}
                                {distanceKm !== null ? (
                                    <Text style={styles.locationHint}>
                                        Distance from you: {distanceKm.toFixed(2)} km
                                    </Text>
                                ) : null}
                            </View>
                            {activeRegion ? (
                                <MapView style={styles.modalMap} region={activeRegion}>
                                    {employeeRegion ? (
                                        <Marker
                                            coordinate={{
                                                latitude: employeeRegion.latitude,
                                                longitude: employeeRegion.longitude,
                                            }}
                                            title={modalContent?.name || "Employee"}
                                            description={getLocationLabel(modalContent?.location)}
                                            pinColor="#D4A537"
                                        />
                                    ) : null}
                                    {viewerRegion ? (
                                        <Marker
                                            coordinate={{
                                                latitude: viewerRegion.latitude,
                                                longitude: viewerRegion.longitude,
                                            }}
                                            title="You"
                                            description={getLocationLabel(viewerLocation)}
                                            pinColor="#2563EB"
                                        />
                                    ) : null}
                                </MapView>
                            ) : (
                                <View style={styles.modalMapEmpty}>
                                    <Ionicons name="location-outline" size={28} color="#9CA3AF" />
                                    <Text style={styles.modalNoImage}>No location data available</Text>
                                </View>
                            )}
                            <Pressable
                                style={styles.locationAction}
                                onPress={() => openLocationInMaps(modalContent?.location)}
                            >
                                <Text style={styles.locationActionText}>Open Employee Location</Text>
                            </Pressable>
                            <Text style={styles.modalName}>
                                {modalContent?.name}
                            </Text>
                            <Text style={styles.modalMeta}>
                                ID: {modalContent?.employeeId}
                            </Text>
                            {modalContent?.checkInTime ? (
                                <Text style={styles.modalMeta}>
                                    Time:{" "}
                                    {new Date(
                                        modalContent.checkInTime,
                                    ).toLocaleString()}
                                </Text>
                            ) : null}
                        </ScrollView>
                        </View>
                    </View>
                </View>
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
    locationBlock: {
        width: "100%",
        backgroundColor: "#F8FAFC",
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
    },
    locationHeading: {
        color: "#111827",
        fontWeight: "700",
        marginBottom: 6,
    },
    locationText: {
        color: "#1F2937",
        fontSize: 13,
        lineHeight: 18,
    },
    locationHint: {
        color: "#6B7280",
        fontSize: 12,
        marginTop: 6,
    },
    modalMap: {
        width: "100%",
        height: 220,
        borderRadius: 12,
        marginBottom: 12,
    },
    modalMapEmpty: {
        width: "100%",
        height: 120,
        borderRadius: 12,
        backgroundColor: "#F8FAFC",
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 12,
    },
    locationAction: {
        width: "100%",
        backgroundColor: "#EFF6FF",
        borderRadius: 10,
        paddingVertical: 10,
        alignItems: "center",
        marginBottom: 12,
    },
    locationActionText: {
        color: "#1D4ED8",
        fontWeight: "700",
    },
    modalOverlay: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "rgba(0,0,0,0.5)",
        paddingHorizontal: 16,
    },
    modalBackdrop: {
        ...StyleSheet.absoluteFillObject,
    },
    modalShell: {
        width: "100%",
        flex: 1,
        justifyContent: "center",
    },
    modalCard: {
        width: "100%",
        maxHeight: "92%",
        alignSelf: "center",
        backgroundColor: "#FFF",
        borderRadius: 16,
        overflow: "hidden",
    },
    modalHeader: {
        paddingTop: 10,
        paddingHorizontal: 16,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: "#EEF2F7",
        backgroundColor: "#FFFFFF",
    },
    modalHandle: {
        alignSelf: "center",
        width: 42,
        height: 4,
        borderRadius: 999,
        backgroundColor: "#D1D5DB",
        marginBottom: 12,
    },
    modalHeaderRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    modalHeaderTitle: {
        color: "#111827",
        fontSize: 16,
        fontWeight: "700",
    },
    modalHeaderClose: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: "#F3F4F6",
        alignItems: "center",
        justifyContent: "center",
    },
    modalScroll: {
        width: "100%",
    },
    modalScrollContent: {
        padding: 16,
        alignItems: "center",
        paddingBottom: 24,
        flexGrow: 1,
    },
    modalNoImage: { color: "#6B7280", marginTop: 8 },
    modalName: { fontWeight: "700", marginTop: 12, color: "#111827" },
    modalMeta: { color: "#6B7280", marginTop: 6 },
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
