import SkeletonBlock from "@/components/SkeletonBlock";
import { useAuth } from "@/contexts/AuthContext";
import {
    EmployeeActivity,
    fetchRecentActivity,
    RecentActivityData,
} from "@/services/activity";
import {
    checkIn,
    checkOut,
    fetchAttendance,

    type AttendanceRecord,
} from "@/services/attendance";
import { getPayslipDownloadUrl } from "@/services/payroll";
import { fetchEmployeeProfile, type EmployeeProfile } from "@/services/profile";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import * as LocalAuthentication from "expo-local-authentication";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Animated,
    Image,
    Linking,
    Modal,
    PanResponder,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

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
    const { user, isLoading } = useAuth();
    const [attendance, setAttendance] = useState<AttendanceRecord | null>(null);
    const [attLoading, setAttLoading] = useState(false);
    const [punching, setPunching] = useState(false);
    const [profile, setProfile] = useState<EmployeeProfile | null>(null);
    const [profileLoading, setProfileLoading] = useState(false);
    const [activityData, setActivityData] = useState<RecentActivityData | null>(
        null,
    );
    const [activityLoading, setActivityLoading] = useState(false);
    const [checkinImageLoading, setCheckinImageLoading] = useState(false);
    const [previewVisible, setPreviewVisible] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    // Swipe gesture state
    const pan = useRef(new Animated.Value(0)).current;
    const trackWidth = useRef(0);
    const HANDLE_WIDTH = 48;
    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => !punching && !attLoading,
            onMoveShouldSetPanResponder: (_, gesture) =>
                Math.abs(gesture.dx) > 6 && !punching && !attLoading,
            onPanResponderMove: (_, gesture) => {
                const max = Math.max(
                    0,
                    Math.min(
                        gesture.dx,
                        (trackWidth.current || 0) - HANDLE_WIDTH,
                    ),
                );
                pan.setValue(max);
            },
            onPanResponderRelease: (_, gesture) => {
                const maxPos = (trackWidth.current || 0) - HANDLE_WIDTH;
                const threshold = Math.max(30, Math.floor(maxPos * 0.6));
                if (gesture.dx >= threshold) {
                    Animated.timing(pan, {
                        toValue: maxPos,
                        duration: 120,
                        useNativeDriver: true,
                    }).start(() => {
                        // trigger punch
                        handlePunch();
                        Animated.timing(pan, {
                            toValue: 0,
                            duration: 300,
                            useNativeDriver: true,
                        }).start();
                    });
                } else {
                    Animated.timing(pan, {
                        toValue: 0,
                        duration: 180,
                        useNativeDriver: true,
                    }).start();
                }
            },
        }),
    ).current;
    const [selectedPayslipYear, setSelectedPayslipYear] = useState<
        number | null
    >(null);
    const [yearPickerVisible, setYearPickerVisible] = useState(false);
    const [downloadingPayslipId, setDownloadingPayslipId] = useState<
        string | null
    >(null);

    const _fullName = profile?.name ?? user?.name ?? "Employee";
    const displayName = (_fullName || "").split(" ")[0] || _fullName;
    const displayDesignation =
        profile?.designation ?? user?.designation ?? "Software Developer";
    const salaryValue =
        typeof profile?.salary === "number"
            ? `₹${profile.salary.toLocaleString("en-IN")}`
            : "₹--";

    const formatPayslipMonth = (
        month?: number | null,
        year?: number | null,
    ) => {
        if (!month || !year) {
            return "Upcoming payout";
        }
        const date = new Date(year, month - 1, 1);
        if (Number.isNaN(date.getTime())) {
            return `Month ${month}, ${year}`;
        }
        return date.toLocaleDateString(undefined, {
            month: "long",
            year: "numeric",
        });
    };

    const formatCurrency = (value?: number | null) => {
        if (typeof value !== "number") {
            return "--";
        }
        return `₹${value.toLocaleString("en-IN")}`;
    };

    const payslipYears = useMemo(() => {
        if (!profile?.Payslips) {
            return [];
        }
        const unique = Array.from(
            new Set(
                profile.Payslips.map((slip) => Number(slip.year)).filter(
                    (year) => typeof year === "number" && !Number.isNaN(year),
                ),
            ),
        );
        return unique.sort((a, b) => b - a);
    }, [profile?.Payslips]);

    useEffect(() => {
        if (!selectedPayslipYear && payslipYears.length > 0) {
            setSelectedPayslipYear(payslipYears[0]);
        }
    }, [payslipYears, selectedPayslipYear]);

    const payslipEntries = useMemo<PayslipEntry[]>(() => {
        if (
            !profile?.Payslips ||
            profile.Payslips.length === 0 ||
            !selectedPayslipYear
        ) {
            return [];
        }

        const filtered = profile.Payslips.filter(
            (slip) => Number(slip.year) === selectedPayslipYear,
        );

        if (filtered.length === 0) {
            return [];
        }

        return filtered.map((slip, index) => {
            const monthValue =
                typeof slip.month === "number"
                    ? slip.month
                    : Number(slip.month);
            const yearValue =
                typeof slip.year === "number" ? slip.year : Number(slip.year);
            const monthLabel = formatPayslipMonth(
                slip.month as number | undefined,
                slip.year as number | undefined,
            );
            const netLabel = slip.netSalary
                ? `Net ${formatCurrency(slip.netSalary)}`
                : "Awaiting net salary";
            const canDownload = Boolean(
                slip.payslipGenerated && slip.payslipSent,
            );
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

    const payslipYearLabel = selectedPayslipYear
        ? `${selectedPayslipYear}`
        : "Select";
    const payslipEmptyMessage = selectedPayslipYear
        ? `No payslips available for ${selectedPayslipYear} yet.`
        : "Payslips will appear automatically after payroll generates them.";

    const getActivityColor = (type?: string) => {
        if (!type) {
            return DEFAULT_ACTIVITY_COLOR;
        }
        const normalized = type.replace(/[_-]+/g, " ").toLowerCase();
        const found = Object.entries(ACTIVITY_COLOR_MAP).find(([key]) =>
            normalized.includes(key),
        );
        return found?.[1] ?? DEFAULT_ACTIVITY_COLOR;
    };

    const getActivityIcon = (type?: string) => {
        if (!type) return "notifications-outline";
        const t = type.toLowerCase();
        if (t.includes("present") || t.includes("attendance"))
            return "checkmark-circle-outline";
        if (
            t.includes("wfh") ||
            t.includes("work from home") ||
            t.includes("remote")
        )
            return "home-outline";
        if (
            t.includes("salary") ||
            t.includes("payroll") ||
            t.includes("credited")
        )
            return "cash-outline";
        if (t.includes("leave")) return "beer-outline";
        return "notifications-outline";
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
            return date.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
            });
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
            router.replace("/admin");
            return;
        }

        loadAttendance();
        loadProfile();
        loadRecentActivity();
    }, [isLoading, user]);

    const getInitials = (name?: string | null) => {
        if (!name) return "";
        const parts = name.trim().split(/\s+/);
        if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
        return (
            parts[0].charAt(0) + parts[parts.length - 1].charAt(0)
        ).toUpperCase();
    };

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
            Alert.alert(
                "Download unavailable",
                "Missing payslip period details for this record.",
            );
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

            const downloadUrl = response?.data?.downloadUrl;
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

    const isCheckedIn = attendance?.checkIn && !attendance?.checkOut;

    const handlePunch = async () => {
        if (!user) return;

        try {
            const hasHardware = await LocalAuthentication.hasHardwareAsync();
            const isEnrolled = await LocalAuthentication.isEnrolledAsync();

            if (!hasHardware) {
                Alert.alert(
                    "Fingerprint not supported",
                    "This device does not support biometric authentication.",
                );
                return;
            }

            if (!isEnrolled) {
                Alert.alert(
                    "Fingerprint not set up",
                    "Please register your fingerprint in your device settings to punch in or out.",
                );
                return;
            }

            const authResult = await LocalAuthentication.authenticateAsync({
                promptMessage: isCheckedIn
                    ? "Confirm to check out"
                    : "Confirm to check in",
                fallbackLabel: "Use device passcode",
                cancelLabel: "Cancel",
            });

            if (!authResult.success) {
                if (
                    authResult.error !== "user_cancel" &&
                    authResult.error !== "system_cancel"
                ) {
                    Alert.alert(
                        "Authentication failed",
                        "We couldn't verify your identity.",
                    );
                }
                return;
            }

            setPunching(true);

            if (isCheckedIn) {
                const res = await checkOut();
                setAttendance((prev: any) => ({
                    ...prev,
                    ...res,
                    checkIn: prev?.checkIn || res.checkIn || null,
                }));
            } else {
                // Request camera permission and launch camera to take a check-in photo
                const permission =
                    await ImagePicker.requestCameraPermissionsAsync();
                if (permission.status !== "granted") {
                    Alert.alert(
                        "Permission required",
                        "Camera permission is required to capture a check-in photo.",
                    );
                    return;
                }

                const pickerResult = await ImagePicker.launchCameraAsync({
                    allowsEditing: false,
                    quality: 0.6,
                    exif: false,
                    cameraType: ImagePicker.CameraType.front,
                });

                if (pickerResult.canceled) {
                    return;
                }

                const asset = (pickerResult as any).assets?.[0];
                const localUri = asset?.uri ?? (pickerResult as any).uri;
                if (!localUri) {
                    Alert.alert(
                        "Capture failed",
                        "Unable to read captured image.",
                    );
                    return;
                }

                const filename = localUri.split("/").pop() || "photo.jpg";
                const match = /\.(\w+)$/.exec(filename);
                const ext = match ? match[1].toLowerCase() : "jpg";
                const mime =
                    ext === "jpg" || ext === "jpeg"
                        ? "image/jpeg"
                        : `image/${ext}`;

                const image = { uri: localUri, name: filename, type: mime };

                const res = await checkIn(image);
                setAttendance(res);
            }
        } catch (error: any) {
            const msg =
                error?.response?.data?.message ||
                error?.message ||
                "Something went wrong";
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
            // also fetch last check-in image for this employee
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

    const onRefresh = async () => {
        setRefreshing(true);
        try {
            await Promise.all([
                loadAttendance(),
                loadProfile(),
                loadRecentActivity(),
            ]);
        } catch (err) {
            console.log("refresh failed", err);
        } finally {
            setRefreshing(false);
        }
    };

    if (isLoading) {
        return (
            <SafeAreaView style={styles.container}>
                <ScrollView
                    contentContainerStyle={[styles.content, { paddingTop: 32 }]}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            colors={["#D4A537"]}
                        />
                    }
                >
                    <SkeletonBlock
                        style={{
                            height: 200,
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
                            height: 100,
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
                    <SkeletonBlock
                        style={{ height: 200, borderRadius: 12, marginTop: 12 }}
                    />
                </ScrollView>
            </SafeAreaView>
        );
    }

    const activityCountLabel = activityData?.totalActivities
        ? `${activityData.totalActivities} updates`
        : "Latest";
    const hasActivities = (activityData?.activities?.length ?? 0) > 0;

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <View style={styles.headerTop}>
                    <View style={styles.headerLeft}>
                        <Pressable
                            onPress={() => setPreviewVisible(true)}
                            style={styles.headerLogoWrap}
                        >
                            {profile?.profilePicture ? (
                                <Image
                                    source={{ uri: profile.profilePicture }}
                                    style={styles.headerLogo}
                                />
                            ) : (
                                <View style={styles.headerLogoPlaceholder}>
                                    <Text style={styles.headerLogoInitials}>
                                        {getInitials(
                                            profile?.name ?? user?.name,
                                        )}
                                    </Text>
                                </View>
                            )}
                        </Pressable>
                        <View style={styles.headerTextBlock}>
                            {profileLoading ? (
                                <>
                                    <SkeletonBlock
                                        style={{
                                            height: 20,
                                            width: 160,
                                            marginBottom: 6,
                                        }}
                                    />
                                    <SkeletonBlock
                                        style={{
                                            height: 16,
                                            width: 120,
                                            marginBottom: 6,
                                        }}
                                    />
                                    <SkeletonBlock
                                        style={{ height: 12, width: 200 }}
                                    />
                                </>
                            ) : (
                                <>
                                    <Text style={styles.name}>
                                        Hello, {displayName}
                                    </Text>
                                    <Text style={styles.subtitle}>
                                        {displayDesignation}
                                    </Text>
                                    <Text style={styles.metaTextSmall}>
                                        {profile?.employeeId ||
                                            user?.employeeId ||
                                            "--"}{" "}
                                        • {profile?.department || "Department"}
                                    </Text>
                                </>
                            )}
                        </View>
                    </View>

                    {/* <View style={styles.headerActions}>
                        <Pressable
                            style={styles.headerIcon}
                            accessibilityRole="button"
                        >
                            <Ionicons
                                name="notifications-outline"
                                size={20}
                                color="#D4A537"
                            />
                        </Pressable>
                    </View> */}
                </View>
            </View>

            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={["#D4A537"]}
                    />
                }
            >
                <View>
                    <View style={styles.tilesRow}>
                        <View style={styles.tileCard}>
                            <View style={styles.tileIconWrap}>
                                <Ionicons
                                    name="log-in-outline"
                                    size={16}
                                    color="#F6C84C"
                                />
                            </View>
                            <Text style={styles.tileTitle}>Check In</Text>
                            <Text style={styles.tileTime}>
                                {attLoading || profileLoading ? (
                                    <SkeletonBlock
                                        style={{ height: 18, width: 80 }}
                                    />
                                ) : (
                                    attendance?.checkIn?.time || "--:--"
                                )}
                            </Text>
                            <Text style={styles.tileNote}>On Time</Text>
                        </View>
                        <View style={styles.tileCard}>
                            <View style={styles.tileIconWrap}>
                                <Ionicons
                                    name="log-out-outline"
                                    size={16}
                                    color="#F6C84C"
                                />
                            </View>
                            <Text style={styles.tileTitle}>Check Out</Text>
                            <Text style={styles.tileTime}>
                                {attLoading || profileLoading ? (
                                    <SkeletonBlock
                                        style={{ height: 18, width: 80 }}
                                    />
                                ) : (
                                    attendance?.checkOut?.time || "--:--"
                                )}
                            </Text>
                            <Text style={styles.tileNote}>Go Home</Text>
                        </View>
                    </View>
                    <View style={styles.tilesRow}>
                        <View style={styles.tileCard}>
                            <View style={styles.tileIconWrap}>
                                <Ionicons
                                    name="cafe-outline"
                                    size={16}
                                    color="#F6C84C"
                                />
                            </View>
                            <Text style={styles.tileTitle}>Break Time</Text>
                            <Text style={styles.tileTime}>
                                {profileLoading ? (
                                    <SkeletonBlock
                                        style={{ height: 18, width: 80 }}
                                    />
                                ) : (
                                    "00:30 min"
                                )}
                            </Text>
                            <Text style={styles.tileNote}>Avg Time 30 min</Text>
                        </View>
                        <View style={styles.tileCard}>
                            <View style={styles.tileIconWrap}>
                                <Ionicons
                                    name="calendar-outline"
                                    size={16}
                                    color="#F6C84C"
                                />
                            </View>
                            <Text style={styles.tileTitle}>Total Days</Text>
                            <Text style={styles.tileTime}>
                                {profileLoading ? (
                                    <SkeletonBlock
                                        style={{ height: 18, width: 40 }}
                                    />
                                ) : (
                                    String((attendance as any)?.totalDays ?? 0)
                                )}
                            </Text>
                            <Text style={styles.tileNote}>Working Days</Text>
                        </View>
                    </View>
                </View>

                <Text style={styles.salaryCardTitle}>Salary Overview</Text>
                <LinearGradient
                    colors={["#FFF7EA", "#F8D99A"]}
                    start={[0, 0]}
                    end={[1, 1]}
                    style={styles.salaryCard}
                >
                    <View>
                        <Text style={styles.salaryLabel}>Net Salary</Text>
                        <Text style={styles.salaryValue}>{salaryValue}</Text>
                        {/* <Text style={styles.salaryDate}>
                            Credited 31 Dec 2025
                        </Text> */}
                    </View>
                    <Text style={styles.salaryRupee}>₹</Text>
                </LinearGradient>
                <View>
                    <View style={styles.cardHeaderRow}>
                        <Text style={styles.cardHeader}>Payslips</Text>
                        <Pressable
                            style={styles.yearFilterCompact}
                            onPress={() => setYearPickerVisible(true)}
                            accessibilityRole="button"
                        >
                            <Text style={styles.yearFilterTextCompact}>
                                {payslipYearLabel}
                            </Text>
                            <Ionicons
                                name="chevron-down"
                                size={14}
                                color="#D4A537"
                            />
                        </Pressable>
                    </View>

                    {payslipEntries.length === 0 ? (
                        <Text style={styles.payslipEmptyText}>
                            {payslipEmptyMessage}
                        </Text>
                    ) : (
                        <View style={styles.payslipList}>
                            {payslipEntries.map((item) => (
                                <View key={item.id} style={styles.payslipItem}>
                                    <View style={styles.payslipLeft}>
                                        <View style={styles.payslipIconWrap}>
                                            <Ionicons
                                                name="document-text-outline"
                                                size={16}
                                                color="#F6C84C"
                                            />
                                        </View>
                                        <View style={styles.payslipTextBlock}>
                                            <Text
                                                style={styles.payslipMonth}
                                                numberOfLines={1}
                                            >
                                                {item.monthLabel}
                                            </Text>
                                            <Text
                                                style={styles.payslipLabel}
                                                numberOfLines={1}
                                            >
                                                {item.detail}
                                            </Text>
                                        </View>
                                    </View>
                                    <Pressable
                                        style={[
                                            styles.payslipDownload,
                                            (!item.canDownload ||
                                                downloadingPayslipId ===
                                                    item.id) &&
                                                styles.payslipDownloadDisabled,
                                        ]}
                                        disabled={
                                            !item.canDownload ||
                                            downloadingPayslipId === item.id
                                        }
                                        onPress={() =>
                                            handleDownloadPayslip(item)
                                        }
                                    >
                                        {downloadingPayslipId === item.id ? (
                                            <ActivityIndicator
                                                size="small"
                                                color="#9CA3AF"
                                            />
                                        ) : (
                                            <Ionicons
                                                name="download-outline"
                                                size={16}
                                                color="#111827"
                                            />
                                        )}
                                    </Pressable>
                                </View>
                            ))}
                        </View>
                    )}
                </View>

                <View style={{ marginBottom: 24 }}>
                    <View style={styles.cardHeaderRow}>
                        <Text style={styles.cardHeader}>Recent Activity</Text>
                        <Pressable
                            style={styles.activityAllWrap}
                            accessibilityRole="button"
                        >
                            <Text style={styles.activityAllText}>All</Text>
                            <Ionicons
                                name="chevron-down"
                                size={14}
                                color="#D4A537"
                            />
                        </Pressable>
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
                        <View style={styles.activityList}>
                            {activityData?.activities?.map(
                                (activity: EmployeeActivity, index: number) => {
                                    const color = getActivityColor(
                                        activity.type,
                                    );
                                    const iconName = getActivityIcon(
                                        activity.type,
                                    );
                                    return (
                                        <View
                                            key={`${activity.type}-${activity.date}-${index}`}
                                            style={styles.activityItem}
                                        >
                                            <View
                                                style={[
                                                    styles.activityItemIcon,
                                                    {
                                                        backgroundColor: `${color}22`,
                                                        borderColor: `${color}33`,
                                                    },
                                                ]}
                                            >
                                                <Ionicons
                                                    name={iconName as any}
                                                    size={20}
                                                    color={color}
                                                />
                                            </View>
                                            <View
                                                style={styles.activityItemText}
                                            >
                                                <Text
                                                    style={
                                                        styles.activityItemTitle
                                                    }
                                                >
                                                    {formatActivityTitle(
                                                        activity.type,
                                                    )}
                                                </Text>
                                                <Text
                                                    style={
                                                        styles.activityItemSubtitle
                                                    }
                                                >
                                                    {formatActivitySubtitle(
                                                        activity,
                                                    )}
                                                </Text>
                                            </View>
                                            <Text
                                                style={styles.activityItemTime}
                                            >
                                                {formatActivityTime(
                                                    activity.date,
                                                )}
                                            </Text>
                                        </View>
                                    );
                                },
                            )}
                        </View>
                    )}
                </View>
                {/* swipe placeholder removed (moved out of ScrollView for fixed positioning) */}
            </ScrollView>

            <View style={styles.swipeFloatingWrap} pointerEvents="box-none">
                <View style={styles.swipeContainerFixed}>
                    <View
                        style={styles.swipeTrack}
                        onLayout={(e) => {
                            trackWidth.current = e.nativeEvent.layout.width;
                        }}
                    >
                        <Text style={styles.swipeLabel}>
                            {isCheckedIn
                                ? "Swipe to Check Out"
                                : "Swipe to Check In"}
                        </Text>
                        <Animated.View
                            style={[
                                styles.swipeHandle,
                                { transform: [{ translateX: pan }] },
                            ]}
                            {...panResponder.panHandlers}
                        >
                            {punching || attLoading ? (
                                <ActivityIndicator color="#F2C94C" />
                            ) : (
                                <Ionicons
                                    name="arrow-forward"
                                    size={20}
                                    color="#F2C94C"
                                />
                            )}
                        </Animated.View>
                    </View>
                </View>
            </View>

            <View style={styles.bottomBar}>
                <Pressable
                    style={styles.bottomIconActive}
                    accessibilityRole="button"
                >
                    <Ionicons name="home" size={22} color="#D4A537" />
                </Pressable>
                <Pressable
                    style={styles.bottomIcon}
                    onPress={() => router.push("/leave")}
                    accessibilityRole="button"
                >
                    <Ionicons
                        name="calendar-outline"
                        size={22}
                        color="#9CA3AF"
                    />
                </Pressable>
                <Pressable
                    style={styles.bottomIcon}
                    onPress={() => router.push("/profile-setting")}
                    accessibilityRole="button"
                >
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
                                        selectedPayslipYear === year &&
                                            styles.yearOptionActive,
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
                                            selectedPayslipYear === year &&
                                                styles.yearOptionTextActive,
                                        ]}
                                    >
                                        {year}
                                    </Text>
                                    {selectedPayslipYear === year && (
                                        <Ionicons
                                            name="checkmark"
                                            size={16}
                                            color="#111827"
                                        />
                                    )}
                                </Pressable>
                            ))
                        )}
                    </View>
                </Pressable>
            </Modal>
            <Modal
                visible={previewVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setPreviewVisible(false)}
            >
                <Pressable
                    style={{
                        flex: 1,
                        backgroundColor: "rgba(0,0,0,0.8)",
                        justifyContent: "center",
                        alignItems: "center",
                    }}
                    onPress={() => setPreviewVisible(false)}
                >
                    <Image
                        source={{ uri: profile?.profilePicture ?? undefined }}
                        style={{
                            width: "90%",
                            height: "70%",
                            resizeMode: "contain",
                            borderRadius: 12,
                        }}
                    />
                </Pressable>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F3F4F6",
    },
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#FFFFFF",
    },
    header: {
        paddingTop: 20,
        paddingHorizontal: 24,
        paddingBottom: 16,
    },
    headerTop: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 12,
    },
    headerLeft: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        flex: 1,
    },
    headerTextBlock: {
        flexDirection: "column",
        justifyContent: "center",
    },
    metaTextSmall: {
        marginTop: 4,
        fontSize: 12,
        color: "#9CA3AF",
    },
    headerLogoWrap: {
        height: 50,
        width: 50,
        borderRadius: 25,
        backgroundColor: "#F8FAFC",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "#E5E7EB",
        overflow: "hidden",
    },
    headerLogo: {
        height: "100%",
        width: "100%",
        borderRadius: 25,
        resizeMode: "cover",
    },
    headerLogoPlaceholder: {
        height: "100%",
        width: "100%",
        borderRadius: 25,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#FEF8EF",
        borderWidth: 1,
        borderColor: "#F8EFD6",
    },
    headerLogoInitials: {
        color: "#D4A537",
        fontWeight: "800",
        fontSize: 16,
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
        fontSize: 20,
        fontWeight: "700",
        color: "#111827",
    },
    subtitle: {
        color: "#6B7280",
        fontSize: 14,
        marginTop: 2,
    },
    metaText: {
        marginTop: 2,
        fontSize: 8,
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
        alignItems: "center",
        justifyContent: "space-between",
    },
    clockCol: {
        flex: 1,
        alignItems: "center",
    },
    clockDivider: {
        width: 1,
        height: 36,
        backgroundColor: "#E5E7EB",
        marginHorizontal: 12,
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

    checkinImageWrap: {
        alignSelf: "center",
        marginTop: 12,
        borderRadius: 12,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "#F1F5F9",
    },
    checkinImage: {
        width: 84,
        height: 84,
        resizeMode: "cover",
    },
    bannerWrap: {
        marginTop: 12,
        borderRadius: 14,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "#F3E9D4",
    },
    bannerImage: {
        width: "100%",
        height: 110,
        resizeMode: "cover",
    },
    tilesRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginTop: 12,
        gap: 10,
    },
    tileCard: {
        flex: 1,
        backgroundColor: "#FFFFFF",
        borderRadius: 14,
        padding: 12,
        borderWidth: 1,
        borderColor: "#F1F5F9",
        shadowColor: "#000",
        shadowOpacity: 0.03,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        position: "relative",
        minHeight: 128,
    },
    tileTitle: {
        color: "#9CA3AF",
        fontSize: 12,
        textTransform: "uppercase",
        letterSpacing: 0.6,
    },
    tileTime: {
        fontSize: 20,
        fontWeight: "700",
        color: "#111827",
        marginTop: 6,
        lineHeight: 24,
        minHeight: 48,
        paddingRight: 18,
    },
    tileNote: {
        color: "#6B7280",
        fontSize: 12,
        marginTop: 4,
    },
    swipeWrap: {
        marginTop: 16,
        alignItems: "center",
    },
    swipeButton: {
        width: "92%",
        backgroundColor: "#F2C94C",
        paddingVertical: 14,
        borderRadius: 28,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#000",
        shadowOpacity: 0.08,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 6,
    },
    swipeIcon: {
        marginRight: 12,
    },
    swipeText: {
        color: "#111827",
        fontWeight: "700",
        fontSize: 16,
    },
    swipeLeftCircle: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: "#FFFFFF",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 12,
        shadowColor: "#000",
        shadowOpacity: 0.04,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
    },
    tileIconWrap: {
        position: "absolute",
        right: 12,
        top: 12,
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: "#FEF8EF",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "#FEEBC8",
    },

    salaryCard: {
        borderRadius: 24,
        padding: 20,
        marginBottom: 16,
        position: "relative",
        marginTop: 24,
        overflow: "hidden",
        shadowColor: "#F2C94C",
        shadowOpacity: 0.1,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
        elevation: 6,
    },
    salaryLabel: {
        fontSize: 12,
        color: "#6B7280",
        letterSpacing: 0.6,
        marginBottom: 8,
    },
    salaryValue: {
        fontSize: 36,
        color: "#111827",
        fontWeight: "800",
    },
    salaryDate: {
        color: "#6B7280",
        marginTop: 4,
        fontSize: 12,
    },
    salaryRupee: {
        position: "absolute",
        right: 12,
        top: 8,
        fontSize: 92,
        color: "rgba(255,255,255,0.12)",
        fontWeight: "800",
        transform: [{ rotate: "6deg" }],
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
        // backgroundColor: "#FFFFFF",
        // borderRadius: 24,
        // padding: 20,
        // borderWidth: 1,
        // borderColor: "#F1F5F9",
        // marginBottom: 16,
    },
    cardHeaderRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 4,
    },
    cardHeader: {
        fontSize: 16,
        fontWeight: "600",
        color: "#111827",
        margin: 0,
        padding: 0,
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
    /* New payslip list styles */
    yearFilterCompact: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: "#F2C94C",
        backgroundColor: "#FFFFFF",
    },
    yearFilterTextCompact: {
        fontSize: 13,
        color: "#D4A537",
        fontWeight: "700",
    },
    payslipList: {
        marginTop: 12,
        backgroundColor: "transparent",
        borderRadius: 14,
        padding: 0,
        borderWidth: 0,
        shadowColor: "transparent",
    },
    payslipItem: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 14,
        paddingHorizontal: 12,
        backgroundColor: "#FFFFFF",
        borderRadius: 12,
        marginBottom: 12,
        shadowColor: "#000",
        shadowOpacity: 0.02,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 4 },
        borderWidth: 1,
        borderColor: "#F7F5F3",
    },
    payslipLeft: {
        flexDirection: "row",
        alignItems: "center",
    },
    payslipIconWrap: {
        width: 40,
        height: 40,
        borderRadius: 8,
        backgroundColor: "#FFF7EB",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 12,
        borderWidth: 1,
        borderColor: "#FAEFD6",
    },
    payslipTextBlock: {
        maxWidth: 220,
    },
    payslipDownload: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "#E6E9EE",
        backgroundColor: "#FFFFFF",
        shadowColor: "#000",
        shadowOpacity: 0.02,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 4 },
    },
    payslipDownloadDisabled: {
        borderColor: "#F1F5F9",
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
    /* Swipe track styles */
    swipeContainer: {
        margin: 20,
        alignItems: "center",
    },
    swipeTrack: {
        width: "94%",
        height: 55,
        borderRadius: 27.5,
        backgroundColor: "#F2C94C",
        justifyContent: "center",
        paddingLeft: 0,
        paddingRight: 0,
        paddingTop: 0,
        shadowColor: "#000",
        shadowOpacity: 0.06,
        shadowRadius: 0,
        shadowOffset: { width: 0, height: 0 },
    },
    swipeLabel: {
        position: "absolute",
        alignSelf: "center",
        color: "#FFFFFF",
        fontWeight: "700",
        fontSize: 15,
    },
    swipeHandle: {
        position: "absolute",
        left: 6,
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: "#FFFFFF",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "#F2C94C",
        shadowColor: "#000",
        shadowOpacity: 0.06,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 6 },
    },

    /* fixed swipe wrapper above bottom bar */
    swipeFloatingWrap: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 86,
        alignItems: "center",
        pointerEvents: "box-none",
    },
    swipeContainerFixed: {
        width: "100%",
        alignItems: "center",
        paddingHorizontal: 12,
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
    activityList: {
        marginTop: 6,
    },
    activityAllWrap: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    activityAllText: {
        color: "#D4A537",
        fontWeight: "700",
        fontSize: 13,
        marginRight: 2,
    },
    activityItem: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FFFFFF",
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 12,
        marginBottom: 10,
        shadowColor: "#000",
        shadowOpacity: 0.03,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
    },
    activityItemIcon: {
        width: 44,
        height: 44,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 12,
        borderWidth: 1,
    },
    activityItemText: {
        flex: 1,
    },
    activityItemTitle: {
        fontSize: 14,
        fontWeight: "600",
        color: "#111827",
    },
    activityItemSubtitle: {
        color: "#6B7280",
        fontSize: 12,
        marginTop: 4,
    },
    activityItemTime: {
        color: "#6B7280",
        fontSize: 12,
        marginLeft: 8,
    },

    /* checkin thumbnail row */
    checkinRow: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 12,
        marginBottom: 8,
    },
    checkinThumbWrap: {
        width: 64,
        height: 64,
        borderRadius: 12,
        backgroundColor: "#FFFFFF",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "#F3E9D4",
        overflow: "hidden",
        marginRight: 12,
        shadowColor: "#000",
        shadowOpacity: 0.03,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
    },
    checkinThumb: {
        width: 60,
        height: 60,
        borderRadius: 10,
        resizeMode: "cover",
    },
    checkinTextBlock: {
        flexDirection: "column",
        justifyContent: "center",
    },
    checkinLabel: {
        color: "#9CA3AF",
        fontSize: 12,
    },
    checkinTime: {
        fontSize: 16,
        fontWeight: "700",
        color: "#111827",
        marginTop: 2,
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
        justifyContent: "space-evenly",
        alignItems: "center",
        shadowColor: "#000",
        shadowOpacity: 0.08,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: -4 },
        elevation: 6,
        paddingHorizontal: 12,
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
    salaryCardTitle: {
        fontSize: 16,
        fontWeight: "600",
        color: "#111827",
        paddingBottom: 0,
        paddingTop: 24,
    },
});
