import { useAuth } from "@/contexts/AuthContext";
import {
    fetchAttendancePolicies,
    fetchLeavePolicies,
    upsertAttendancePolicy,
    upsertLeavePolicy,
    type AttendancePolicyPayload,
    type LeavePolicyPayload,
} from "@/services/policies";
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
    Switch,
    Text,
    TextInput,
    View,
    useWindowDimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

const DEFAULT_LEAVE_POLICY: LeavePolicyPayload = {
    name: "Leave Policy 2026",
    year: 2026,
    description: "Standard leave policy for 2026",
    leaves: [
        {
            type: "sick",
            totalDays: 12,
            probationDays: 0,
            rules: {
                requireDocuments: false,
                minAdvanceNoticeDays: 0,
                maxConsecutiveDays: 3,
            },
        },
        {
            type: "casual",
            totalDays: 12,
            probationDays: 0,
            rules: {
                requireDocuments: false,
                minAdvanceNoticeDays: 1,
                maxConsecutiveDays: 2,
            },
        },
        {
            type: "earned",
            totalDays: 15,
            probationDays: 90,
            rules: {
                requireDocuments: false,
                minAdvanceNoticeDays: 7,
                maxConsecutiveDays: 5,
            },
        },
    ],
    isActive: true,
};

const DEFAULT_ATTENDANCE_POLICY: AttendancePolicyPayload = {
    name: "Office Hours 2026",
    year: 2026,
    description: "Standard office hours policy for 2026",
    checkInRules: {
        startTime: "09:00",
        gracePeriod: 15,
        locationRequired: true,
    },
    checkOutRules: {
        endTime: "18:00",
        gracePeriod: 15,
    },
    workHours: {
        fullDayHours: 8,
        halfDayHours: 4,
    },
    latePolicy: {
        maxLateMinutes: 30,
    },
    weekSettings: {
        workingDays: [1, 2, 3, 4, 5],
    },
    isActive: true,
};

const dayOptions = [
    { value: 1, label: "Mon" },
    { value: 2, label: "Tue" },
    { value: 3, label: "Wed" },
    { value: 4, label: "Thu" },
    { value: 5, label: "Fri" },
    { value: 6, label: "Sat" },
    { value: 7, label: "Sun" },
];

const ADMIN_POLICIES_CACHE_KEY = "admin:policies";
const ADMIN_POLICIES_CACHE_TTL_MS = 5 * 60 * 1000;

export default function AdminPolicyScreen() {
    const { user, isLoading } = useAuth();
    const insets = useSafeAreaInsets();
    const BOTTOM_BAR_BASE_HEIGHT = 76;
    const { width } = useWindowDimensions();
    const isWide = width >= 940;

    const [refreshing, setRefreshing] = useState(false);
    const [screenLoading, setScreenLoading] = useState(false);

    const [leavePolicy, setLeavePolicy] = useState<LeavePolicyPayload>(
        DEFAULT_LEAVE_POLICY,
    );
    const [attendancePolicy, setAttendancePolicy] =
        useState<AttendancePolicyPayload>(DEFAULT_ATTENDANCE_POLICY);

    const [leaveSaveLoading, setLeaveSaveLoading] = useState(false);
    const [attendanceSaveLoading, setAttendanceSaveLoading] = useState(false);

    const [leaveMessage, setLeaveMessage] = useState<{
        text: string;
        tone: "success" | "error";
    } | null>(null);
    const [attendanceMessage, setAttendanceMessage] = useState<{
        text: string;
        tone: "success" | "error";
    } | null>(null);

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

        loadPolicies();
    }, [isLoading, user]);

    const loadPolicies = async (force: boolean = false) => {
        if (!force) {
            const cached = getCachedData<{
                leavePolicy: LeavePolicyPayload;
                attendancePolicy: AttendancePolicyPayload;
            }>(ADMIN_POLICIES_CACHE_KEY, ADMIN_POLICIES_CACHE_TTL_MS);
            if (cached) {
                setLeavePolicy(cached.leavePolicy);
                setAttendancePolicy(cached.attendancePolicy);
                return;
            }
        }

        setScreenLoading(true);
        try {
            const [leaveRes, attendanceRes] = await Promise.all([
                fetchLeavePolicies(),
                fetchAttendancePolicies(),
            ]);

            const latestLeave = leaveRes?.data?.[0];
            if (latestLeave) {
                setLeavePolicy({
                    name: latestLeave.name || DEFAULT_LEAVE_POLICY.name,
                    year: latestLeave.year || DEFAULT_LEAVE_POLICY.year,
                    description:
                        latestLeave.description ||
                        DEFAULT_LEAVE_POLICY.description,
                    leaves: DEFAULT_LEAVE_POLICY.leaves.map((baseLeave) => {
                        const found = latestLeave.leaves?.find(
                            (item) =>
                                item.type?.toLowerCase() ===
                                baseLeave.type.toLowerCase(),
                        );
                        return {
                            type: baseLeave.type,
                            totalDays: found?.totalDays ?? baseLeave.totalDays,
                            probationDays:
                                found?.probationDays ?? baseLeave.probationDays,
                            rules: {
                                requireDocuments:
                                    found?.rules?.requireDocuments ??
                                    baseLeave.rules?.requireDocuments ??
                                    false,
                                minAdvanceNoticeDays:
                                    found?.rules?.minAdvanceNoticeDays ??
                                    baseLeave.rules?.minAdvanceNoticeDays ??
                                    0,
                                maxConsecutiveDays:
                                    found?.rules?.maxConsecutiveDays ??
                                    baseLeave.rules?.maxConsecutiveDays ??
                                    0,
                            },
                        };
                    }),
                    isActive: latestLeave.isActive ?? true,
                });
            }

            const latestAttendance = attendanceRes?.data?.[0];
            if (latestAttendance) {
                setAttendancePolicy({
                    name:
                        latestAttendance.name || DEFAULT_ATTENDANCE_POLICY.name,
                    year:
                        latestAttendance.year || DEFAULT_ATTENDANCE_POLICY.year,
                    description:
                        latestAttendance.description ||
                        DEFAULT_ATTENDANCE_POLICY.description,
                    checkInRules: {
                        startTime:
                            latestAttendance.checkInRules?.startTime ||
                            DEFAULT_ATTENDANCE_POLICY.checkInRules.startTime,
                        gracePeriod:
                            latestAttendance.checkInRules?.gracePeriod ??
                            DEFAULT_ATTENDANCE_POLICY.checkInRules.gracePeriod,
                        locationRequired:
                            latestAttendance.checkInRules?.locationRequired ??
                            DEFAULT_ATTENDANCE_POLICY.checkInRules
                                .locationRequired,
                    },
                    checkOutRules: {
                        endTime:
                            latestAttendance.checkOutRules?.endTime ||
                            DEFAULT_ATTENDANCE_POLICY.checkOutRules.endTime,
                        gracePeriod:
                            latestAttendance.checkOutRules?.gracePeriod ??
                            DEFAULT_ATTENDANCE_POLICY.checkOutRules.gracePeriod,
                    },
                    workHours: {
                        fullDayHours:
                            latestAttendance.workHours?.fullDayHours ??
                            DEFAULT_ATTENDANCE_POLICY.workHours.fullDayHours,
                        halfDayHours:
                            latestAttendance.workHours?.halfDayHours ??
                            DEFAULT_ATTENDANCE_POLICY.workHours.halfDayHours,
                    },
                    latePolicy: {
                        maxLateMinutes:
                            latestAttendance.latePolicy?.maxLateMinutes ??
                            DEFAULT_ATTENDANCE_POLICY.latePolicy.maxLateMinutes,
                    },
                    weekSettings: {
                        workingDays:
                            latestAttendance.weekSettings?.workingDays?.length
                                ? latestAttendance.weekSettings.workingDays
                                : DEFAULT_ATTENDANCE_POLICY.weekSettings
                                      .workingDays,
                    },
                    isActive: latestAttendance.isActive ?? true,
                });
            }

            setCachedData(ADMIN_POLICIES_CACHE_KEY, {
                leavePolicy: latestLeave
                    ? {
                          name: latestLeave.name || DEFAULT_LEAVE_POLICY.name,
                          year: latestLeave.year || DEFAULT_LEAVE_POLICY.year,
                          description:
                              latestLeave.description ||
                              DEFAULT_LEAVE_POLICY.description,
                          leaves: DEFAULT_LEAVE_POLICY.leaves.map(
                              (baseLeave) => {
                                  const found = latestLeave.leaves?.find(
                                      (item) =>
                                          item.type?.toLowerCase() ===
                                          baseLeave.type.toLowerCase(),
                                  );
                                  return {
                                      type: baseLeave.type,
                                      totalDays:
                                          found?.totalDays ??
                                          baseLeave.totalDays,
                                      probationDays:
                                          found?.probationDays ??
                                          baseLeave.probationDays,
                                      rules: {
                                          requireDocuments:
                                              found?.rules
                                                  ?.requireDocuments ??
                                              baseLeave.rules
                                                  ?.requireDocuments ??
                                              false,
                                          minAdvanceNoticeDays:
                                              found?.rules
                                                  ?.minAdvanceNoticeDays ??
                                              baseLeave.rules
                                                  ?.minAdvanceNoticeDays ??
                                              0,
                                          maxConsecutiveDays:
                                              found?.rules
                                                  ?.maxConsecutiveDays ??
                                              baseLeave.rules
                                                  ?.maxConsecutiveDays ??
                                              0,
                                      },
                                  };
                              },
                          ),
                          isActive: latestLeave.isActive ?? true,
                      }
                    : leavePolicy,
                attendancePolicy: latestAttendance
                    ? {
                          name:
                              latestAttendance.name ||
                              DEFAULT_ATTENDANCE_POLICY.name,
                          year:
                              latestAttendance.year ||
                              DEFAULT_ATTENDANCE_POLICY.year,
                          description:
                              latestAttendance.description ||
                              DEFAULT_ATTENDANCE_POLICY.description,
                          checkInRules: {
                              startTime:
                                  latestAttendance.checkInRules?.startTime ||
                                  DEFAULT_ATTENDANCE_POLICY.checkInRules
                                      .startTime,
                              gracePeriod:
                                  latestAttendance.checkInRules?.gracePeriod ??
                                  DEFAULT_ATTENDANCE_POLICY.checkInRules
                                      .gracePeriod,
                              locationRequired:
                                  latestAttendance.checkInRules
                                      ?.locationRequired ??
                                  DEFAULT_ATTENDANCE_POLICY.checkInRules
                                      .locationRequired,
                          },
                          checkOutRules: {
                              endTime:
                                  latestAttendance.checkOutRules?.endTime ||
                                  DEFAULT_ATTENDANCE_POLICY.checkOutRules
                                      .endTime,
                              gracePeriod:
                                  latestAttendance.checkOutRules
                                      ?.gracePeriod ??
                                  DEFAULT_ATTENDANCE_POLICY.checkOutRules
                                      .gracePeriod,
                          },
                          workHours: {
                              fullDayHours:
                                  latestAttendance.workHours?.fullDayHours ??
                                  DEFAULT_ATTENDANCE_POLICY.workHours
                                      .fullDayHours,
                              halfDayHours:
                                  latestAttendance.workHours?.halfDayHours ??
                                  DEFAULT_ATTENDANCE_POLICY.workHours
                                      .halfDayHours,
                          },
                          latePolicy: {
                              maxLateMinutes:
                                  latestAttendance.latePolicy
                                      ?.maxLateMinutes ??
                                  DEFAULT_ATTENDANCE_POLICY.latePolicy
                                      .maxLateMinutes,
                          },
                          weekSettings: {
                              workingDays:
                                  latestAttendance.weekSettings?.workingDays
                                      ?.length
                                      ? latestAttendance.weekSettings
                                            .workingDays
                                      : DEFAULT_ATTENDANCE_POLICY
                                            .weekSettings.workingDays,
                          },
                          isActive: latestAttendance.isActive ?? true,
                      }
                    : attendancePolicy,
            });
        } catch (error: any) {
            setLeaveMessage({
                text: error?.message || "Failed to load policies.",
                tone: "error",
            });
        } finally {
            setScreenLoading(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        setLeaveMessage(null);
        setAttendanceMessage(null);
        try {
            await loadPolicies(true);
        } finally {
            setRefreshing(false);
        }
    };

    const saveLeavePolicy = async () => {
        setLeaveSaveLoading(true);
        setLeaveMessage(null);
        try {
            const response = await upsertLeavePolicy(leavePolicy);
            setCachedData(ADMIN_POLICIES_CACHE_KEY, {
                leavePolicy,
                attendancePolicy,
            });
            setLeaveMessage({
                text: response?.message || "Leave policy updated successfully.",
                tone: "success",
            });
        } catch (error: any) {
            const message =
                error?.response?.data?.message ||
                error?.message ||
                "Failed to update leave policy.";
            setLeaveMessage({ text: message, tone: "error" });
        } finally {
            setLeaveSaveLoading(false);
        }
    };

    const saveAttendancePolicy = async () => {
        setAttendanceSaveLoading(true);
        setAttendanceMessage(null);
        try {
            const response = await upsertAttendancePolicy(attendancePolicy);
            setCachedData(ADMIN_POLICIES_CACHE_KEY, {
                leavePolicy,
                attendancePolicy,
            });
            setAttendanceMessage({
                text:
                    response?.message ||
                    "Attendance policy updated successfully.",
                tone: "success",
            });
        } catch (error: any) {
            const message =
                error?.response?.data?.message ||
                error?.message ||
                "Failed to update attendance policy.";
            setAttendanceMessage({ text: message, tone: "error" });
        } finally {
            setAttendanceSaveLoading(false);
        }
    };

    const panelStyle = useMemo(
        () => [styles.card, isWide && styles.cardWide],
        [isWide],
    );

    if (isLoading || !user || user.role === "emp") {
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
                            BOTTOM_BAR_BASE_HEIGHT + insets.bottom + 44,
                    },
                ]}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={["#D4A537"]}
                    />
                }
            >
                <View style={styles.headerRow}>
                    <Text style={styles.headerTitle}>Policy Management</Text>
                    {screenLoading ? (
                        <ActivityIndicator size="small" color="#111827" />
                    ) : null}
                </View>
                <Text style={styles.headerSubTitle}>
                    Update leave and attendance policies for all employees.
                </Text>

                <View style={panelStyle}>
                    <Text style={styles.cardTitle}>Leave Policy</Text>
                    <TextInput
                        style={styles.input}
                        value={leavePolicy.name}
                        onChangeText={(value) =>
                            setLeavePolicy((prev) => ({ ...prev, name: value }))
                        }
                        placeholder="Policy name"
                        placeholderTextColor="#9CA3AF"
                    />
                    <TextInput
                        style={styles.input}
                        value={`${leavePolicy.year}`}
                        onChangeText={(value) =>
                            setLeavePolicy((prev) => ({
                                ...prev,
                                year: Number(value) || prev.year,
                            }))
                        }
                        keyboardType="number-pad"
                        placeholder="Year"
                        placeholderTextColor="#9CA3AF"
                    />
                    <TextInput
                        style={[styles.input, styles.notesInput]}
                        value={leavePolicy.description}
                        onChangeText={(value) =>
                            setLeavePolicy((prev) => ({
                                ...prev,
                                description: value,
                            }))
                        }
                        multiline
                        placeholder="Description"
                        placeholderTextColor="#9CA3AF"
                    />

                    {leavePolicy.leaves.map((leave, index) => (
                        <View key={leave.type} style={styles.innerBlock}>
                            <Text style={styles.leaveTypeLabel}>
                                {leave.type.toUpperCase()}
                            </Text>
                            <View style={styles.row2}>
                                <TextInput
                                    style={[styles.input, styles.halfInput]}
                                    value={`${leave.totalDays}`}
                                    onChangeText={(value) => {
                                        const num = Number(value) || 0;
                                        setLeavePolicy((prev) => {
                                            const next = [...prev.leaves];
                                            next[index] = {
                                                ...next[index],
                                                totalDays: num,
                                            };
                                            return { ...prev, leaves: next };
                                        });
                                    }}
                                    keyboardType="number-pad"
                                    placeholder="Total days"
                                    placeholderTextColor="#9CA3AF"
                                />
                                <TextInput
                                    style={[styles.input, styles.halfInput]}
                                    value={`${leave.probationDays}`}
                                    onChangeText={(value) => {
                                        const num = Number(value) || 0;
                                        setLeavePolicy((prev) => {
                                            const next = [...prev.leaves];
                                            next[index] = {
                                                ...next[index],
                                                probationDays: num,
                                            };
                                            return { ...prev, leaves: next };
                                        });
                                    }}
                                    keyboardType="number-pad"
                                    placeholder="Probation days"
                                    placeholderTextColor="#9CA3AF"
                                />
                            </View>
                        </View>
                    ))}

                    <View style={styles.switchRow}>
                        <Text style={styles.switchLabel}>Active Policy</Text>
                        <Switch
                            value={leavePolicy.isActive}
                            onValueChange={(value) =>
                                setLeavePolicy((prev) => ({
                                    ...prev,
                                    isActive: value,
                                }))
                            }
                        />
                    </View>

                    {leaveMessage && (
                        <Text
                            style={
                                leaveMessage.tone === "success"
                                    ? styles.successText
                                    : styles.errorText
                            }
                        >
                            {leaveMessage.text}
                        </Text>
                    )}

                    <Pressable
                        style={styles.primaryButton}
                        onPress={saveLeavePolicy}
                        disabled={leaveSaveLoading}
                    >
                        {leaveSaveLoading ? (
                            <ActivityIndicator color="#FFFFFF" size="small" />
                        ) : (
                            <Text style={styles.primaryButtonText}>
                                Save Leave Policy
                            </Text>
                        )}
                    </Pressable>
                </View>

                <View style={panelStyle}>
                    <Text style={styles.cardTitle}>Attendance Policy</Text>
                    <TextInput
                        style={styles.input}
                        value={attendancePolicy.name}
                        onChangeText={(value) =>
                            setAttendancePolicy((prev) => ({
                                ...prev,
                                name: value,
                            }))
                        }
                        placeholder="Policy name"
                        placeholderTextColor="#9CA3AF"
                    />
                    <TextInput
                        style={styles.input}
                        value={`${attendancePolicy.year}`}
                        onChangeText={(value) =>
                            setAttendancePolicy((prev) => ({
                                ...prev,
                                year: Number(value) || prev.year,
                            }))
                        }
                        keyboardType="number-pad"
                        placeholder="Year"
                        placeholderTextColor="#9CA3AF"
                    />
                    <TextInput
                        style={[styles.input, styles.notesInput]}
                        value={attendancePolicy.description}
                        onChangeText={(value) =>
                            setAttendancePolicy((prev) => ({
                                ...prev,
                                description: value,
                            }))
                        }
                        multiline
                        placeholder="Description"
                        placeholderTextColor="#9CA3AF"
                    />

                    <View style={styles.row2}>
                        <TextInput
                            style={[styles.input, styles.halfInput]}
                            value={attendancePolicy.checkInRules.startTime}
                            onChangeText={(value) =>
                                setAttendancePolicy((prev) => ({
                                    ...prev,
                                    checkInRules: {
                                        ...prev.checkInRules,
                                        startTime: value,
                                    },
                                }))
                            }
                            placeholder="Check-in (09:00)"
                            placeholderTextColor="#9CA3AF"
                        />
                        <TextInput
                            style={[styles.input, styles.halfInput]}
                            value={attendancePolicy.checkOutRules.endTime}
                            onChangeText={(value) =>
                                setAttendancePolicy((prev) => ({
                                    ...prev,
                                    checkOutRules: {
                                        ...prev.checkOutRules,
                                        endTime: value,
                                    },
                                }))
                            }
                            placeholder="Check-out (18:00)"
                            placeholderTextColor="#9CA3AF"
                        />
                    </View>

                    <View style={styles.row2}>
                        <TextInput
                            style={[styles.input, styles.halfInput]}
                            value={`${attendancePolicy.workHours.fullDayHours}`}
                            onChangeText={(value) =>
                                setAttendancePolicy((prev) => ({
                                    ...prev,
                                    workHours: {
                                        ...prev.workHours,
                                        fullDayHours: Number(value) || 0,
                                    },
                                }))
                            }
                            keyboardType="number-pad"
                            placeholder="Full day hours"
                            placeholderTextColor="#9CA3AF"
                        />
                        <TextInput
                            style={[styles.input, styles.halfInput]}
                            value={`${attendancePolicy.workHours.halfDayHours}`}
                            onChangeText={(value) =>
                                setAttendancePolicy((prev) => ({
                                    ...prev,
                                    workHours: {
                                        ...prev.workHours,
                                        halfDayHours: Number(value) || 0,
                                    },
                                }))
                            }
                            keyboardType="number-pad"
                            placeholder="Half day hours"
                            placeholderTextColor="#9CA3AF"
                        />
                    </View>

                    <View style={styles.row2}>
                        <TextInput
                            style={[styles.input, styles.halfInput]}
                            value={`${attendancePolicy.checkInRules.gracePeriod}`}
                            onChangeText={(value) =>
                                setAttendancePolicy((prev) => ({
                                    ...prev,
                                    checkInRules: {
                                        ...prev.checkInRules,
                                        gracePeriod: Number(value) || 0,
                                    },
                                }))
                            }
                            keyboardType="number-pad"
                            placeholder="Check-in grace (min)"
                            placeholderTextColor="#9CA3AF"
                        />
                        <TextInput
                            style={[styles.input, styles.halfInput]}
                            value={`${attendancePolicy.checkOutRules.gracePeriod}`}
                            onChangeText={(value) =>
                                setAttendancePolicy((prev) => ({
                                    ...prev,
                                    checkOutRules: {
                                        ...prev.checkOutRules,
                                        gracePeriod: Number(value) || 0,
                                    },
                                }))
                            }
                            keyboardType="number-pad"
                            placeholder="Check-out grace (min)"
                            placeholderTextColor="#9CA3AF"
                        />
                    </View>

                    <TextInput
                        style={styles.input}
                        value={`${attendancePolicy.latePolicy.maxLateMinutes}`}
                        onChangeText={(value) =>
                            setAttendancePolicy((prev) => ({
                                ...prev,
                                latePolicy: {
                                    maxLateMinutes: Number(value) || 0,
                                },
                            }))
                        }
                        keyboardType="number-pad"
                        placeholder="Max late minutes"
                        placeholderTextColor="#9CA3AF"
                    />

                    <Text style={styles.weekLabel}>Working Days</Text>
                    <View style={styles.weekRow}>
                        {dayOptions.map((day) => {
                            const selected =
                                attendancePolicy.weekSettings.workingDays.includes(
                                    day.value,
                                );
                            return (
                                <Pressable
                                    key={day.value}
                                    style={[
                                        styles.dayChip,
                                        selected && styles.dayChipActive,
                                    ]}
                                    onPress={() => {
                                        setAttendancePolicy((prev) => {
                                            const exists =
                                                prev.weekSettings.workingDays.includes(
                                                    day.value,
                                                );
                                            const nextDays = exists
                                                ? prev.weekSettings.workingDays.filter(
                                                      (item) => item !== day.value,
                                                  )
                                                : [
                                                      ...prev.weekSettings
                                                          .workingDays,
                                                      day.value,
                                                  ];
                                            return {
                                                ...prev,
                                                weekSettings: {
                                                    workingDays:
                                                        nextDays.sort(
                                                            (a, b) => a - b,
                                                        ),
                                                },
                                            };
                                        });
                                    }}
                                >
                                    <Text
                                        style={[
                                            styles.dayChipText,
                                            selected &&
                                                styles.dayChipTextActive,
                                        ]}
                                    >
                                        {day.label}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </View>

                    <View style={styles.switchRow}>
                        <Text style={styles.switchLabel}>Location Required</Text>
                        <Switch
                            value={attendancePolicy.checkInRules.locationRequired}
                            onValueChange={(value) =>
                                setAttendancePolicy((prev) => ({
                                    ...prev,
                                    checkInRules: {
                                        ...prev.checkInRules,
                                        locationRequired: value,
                                    },
                                }))
                            }
                        />
                    </View>

                    <View style={styles.switchRow}>
                        <Text style={styles.switchLabel}>Active Policy</Text>
                        <Switch
                            value={attendancePolicy.isActive}
                            onValueChange={(value) =>
                                setAttendancePolicy((prev) => ({
                                    ...prev,
                                    isActive: value,
                                }))
                            }
                        />
                    </View>

                    {attendanceMessage && (
                        <Text
                            style={
                                attendanceMessage.tone === "success"
                                    ? styles.successText
                                    : styles.errorText
                            }
                        >
                            {attendanceMessage.text}
                        </Text>
                    )}

                    <Pressable
                        style={styles.primaryButton}
                        onPress={saveAttendancePolicy}
                        disabled={attendanceSaveLoading}
                    >
                        {attendanceSaveLoading ? (
                            <ActivityIndicator color="#FFFFFF" size="small" />
                        ) : (
                            <Text style={styles.primaryButtonText}>
                                Save Attendance Policy
                            </Text>
                        )}
                    </Pressable>
                </View>
            </ScrollView>

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
                    style={styles.bottomIcon}
                    onPress={() => router.push("/admin-attendance")}
                >
                    <Ionicons name="layers-outline" size={22} color="#9CA3AF" />
                </Pressable>
                <Pressable style={styles.bottomIconActive}>
                    <Ionicons name="settings" size={22} color="#D4A537" />
                </Pressable>
            </View>
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
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#F3F4F6",
    },
    content: {
        paddingHorizontal: 16,
        paddingTop: 18,
        paddingBottom: 120,
        gap: 14,
    },
    headerRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: "700",
        color: "#111827",
    },
    headerSubTitle: {
        color: "#6B7280",
        marginTop: 2,
    },
    card: {
        backgroundColor: "#FFFFFF",
        borderRadius: 18,
        padding: 14,
        shadowColor: "#000",
        shadowOpacity: 0.05,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 2,
    },
    cardWide: {
        maxWidth: 980,
        alignSelf: "center",
        width: "100%",
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: "700",
        color: "#111827",
        marginBottom: 10,
    },
    input: {
        borderWidth: 1,
        borderColor: "#E5E7EB",
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 10,
        color: "#111827",
        backgroundColor: "#FFFFFF",
    },
    notesInput: {
        minHeight: 74,
        textAlignVertical: "top",
    },
    innerBlock: {
        borderWidth: 1,
        borderColor: "#E5E7EB",
        borderRadius: 12,
        padding: 10,
        marginBottom: 10,
    },
    leaveTypeLabel: {
        fontSize: 12,
        fontWeight: "700",
        color: "#374151",
        marginBottom: 8,
        letterSpacing: 0.5,
    },
    row2: {
        flexDirection: "row",
        gap: 10,
    },
    halfInput: {
        flex: 1,
    },
    switchRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 10,
    },
    switchLabel: {
        color: "#374151",
        fontWeight: "600",
    },
    primaryButton: {
        borderRadius: 12,
        paddingVertical: 12,
        alignItems: "center",
        backgroundColor: "#111827",
        marginTop: 2,
    },
    primaryButtonText: {
        color: "#FFFFFF",
        fontWeight: "700",
    },
    successText: {
        color: "#16A34A",
        fontWeight: "600",
        marginBottom: 8,
    },
    errorText: {
        color: "#DC2626",
        fontWeight: "600",
        marginBottom: 8,
    },
    weekLabel: {
        color: "#374151",
        fontWeight: "700",
        marginBottom: 8,
    },
    weekRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
        marginBottom: 10,
    },
    dayChip: {
        borderWidth: 1,
        borderColor: "#D1D5DB",
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 7,
    },
    dayChipActive: {
        borderColor: "#D4A537",
        backgroundColor: "#FEF8EF",
    },
    dayChipText: {
        color: "#6B7280",
        fontWeight: "600",
        fontSize: 12,
    },
    dayChipTextActive: {
        color: "#D4A537",
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
