import BonusProgressBar from "@/components/BonusProgressBar";
import MonthlyAttendanceGrid from "@/components/MonthlyAttendanceGrid";
import SalaryProgressBar from "@/components/SalaryProgressBar";
import SkeletonBlock from "@/components/SkeletonBlock";
import { CACHE_TTL } from "@/constants/cache";
import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    Linking,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { getPayslipDownloadUrl } from "@/services/payroll";
import {
    fetchEmployeeDetail,
    updateEmployeeSalary,
    type EmployeeDetail,
    type EmployeePayslip,
} from "@/services/users";
import { getCachedData, setCachedData } from "@/stores/cacheStore";
import { logger } from "@/utils/logger";

const EMPLOYEE_PROFILE_CACHE_PREFIX = "admin:employee-profile:";

const TABS = ["Overview", "Attendance", "Salary", "Bonus", "Payslips"] as const;
type TabKey = (typeof TABS)[number];

export default function EmployeeProfileScreen() {
    const params = useLocalSearchParams<{
        name?: string;
        role?: string;
        avatar?: string;
        employeeId?: string;
        division?: string;
        email?: string;
        employeeRecordId?: string | string[];
    }>();

    const [profile, setProfile] = useState<EmployeeDetail | null>(null);
    const [activeTab, setActiveTab] = useState<TabKey>("Overview");
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [payslipDownloading, setPayslipDownloading] = useState(false);
    const [downloadingPayslipKey, setDownloadingPayslipKey] = useState<
        string | null
    >(null);
    const [salaryModalVisible, setSalaryModalVisible] = useState(false);
    const [salaryInput, setSalaryInput] = useState("");
    const [savingSalary, setSavingSalary] = useState(false);

    const recordId = useMemo(() => {
        const value = params.employeeRecordId;
        if (Array.isArray(value)) {
            return value[0];
        }
        return value && value.length > 0 ? value : undefined;
    }, [params.employeeRecordId]);

    const loadProfile = useCallback(
        async (force: boolean = false) => {
            logger.log("Loading employee profile", { recordId });
            if (!recordId) {
                setProfile(null);
                setError("Missing employee identifier.");
                setLoading(false);
                return;
            }

            const cacheKey = `${EMPLOYEE_PROFILE_CACHE_PREFIX}${recordId}`;
            if (!force) {
                const cached = getCachedData<EmployeeDetail | null>(cacheKey);
                if (cached) {
                    setProfile(cached);
                    setError(null);
                    setLoading(false);
                    return;
                }
            }

            setLoading(true);
            setError(null);
            try {
                const data = await fetchEmployeeDetail(recordId);
                setProfile(data);
                setCachedData(cacheKey, data, CACHE_TTL.PROFILE);
            } catch (err: any) {
                const message =
                    err?.response?.data?.message ||
                    err?.message ||
                    "Unable to load employee profile.";
                setError(message);
            } finally {
                setLoading(false);
            }
        },
        [recordId],
    );

    useEffect(() => {
        loadProfile();
    }, [loadProfile]);

    const fallbackAvatar =
        params.avatar ||
        "https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=200&q=80&auto=format&fit=facearea";
    const headerName = profile?.name ?? params.name ?? "Employee";
    const headerRole = (
        profile?.designation ??
        params.role ??
        "Team Member"
    ).toUpperCase();
    const headerDepartment =
        profile?.department ?? params.division ?? "Department";
    const headerEmployeeId = profile?.employeeId ?? params.employeeId ?? "--";
    const headerStatus = profile?.status ?? "Unknown";
    const monthlySalary =
        typeof profile?.salary === "number" ? profile.salary : null;
    const salaryDisplay = useMemo(() => {
        if (monthlySalary == null) return "--";
        return `₹${monthlySalary.toLocaleString("en-IN")}`;
    }, [monthlySalary]);

    const joinDateLabel = useMemo(() => {
        const value = profile?.joinDate;
        if (!value) return "—";
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return value;
        return parsed.toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        });
    }, [profile?.joinDate]);

    const leaveBalance = profile?.leaveBalance;

    const attendanceSummary = profile?.attendance?.thisMonth;
    const hasPayslips = (profile?.Payslips?.length ?? 0) > 0;

    const latestPayslip = useMemo(() => {
        return profile?.Payslips?.[0];
    }, [profile?.Payslips]);

    const payslipKey = (payslip: EmployeePayslip, index: number): string => {
        return (
            payslip.payrollId ||
            payslip.id ||
            `${payslip.year ?? ""}-${payslip.month ?? ""}-${index}`
        );
    };

    const sortedPayslips = useMemo(() => {
        const list = profile?.Payslips?.slice() ?? [];
        return list.sort((a, b) => {
            const aMy = extractMonthYear(a);
            const bMy = extractMonthYear(b);
            if (!aMy && !bMy) return 0;
            if (!aMy) return 1;
            if (!bMy) return -1;
            return bMy.year - aMy.year || bMy.month - aMy.month;
        });
    }, [profile?.Payslips]);

    const formatPayslipPeriod = (payslip: EmployeePayslip) => {
        const my = extractMonthYear(payslip);
        if (my) {
            const date = new Date(my.year, my.month - 1, 1);
            return date.toLocaleDateString(undefined, {
                month: "long",
                year: "numeric",
            });
        }
        if (typeof payslip.month === "string" && payslip.month.length > 0) {
            return payslip.month;
        }
        return "Period not set";
    };

    const getInitials = (name?: string) => {
        if (!name) return "";
        const parts = name.trim().split(/\s+/);
        if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
        return (parts[0][0] + (parts[1][0] ?? "")).slice(0, 2).toUpperCase();
    };

    const extractMonthYear = (
        payslip: any,
    ): { month: number; year: number } | null => {
        if (!payslip) return null;

        const rawMonth = payslip.month;
        const rawYear = payslip.year;

        const monthNum =
            typeof rawMonth === "number" ? rawMonth : Number(rawMonth);
        const yearNum = typeof rawYear === "number" ? rawYear : Number(rawYear);
        if (
            Number.isFinite(monthNum) &&
            monthNum >= 1 &&
            monthNum <= 12 &&
            Number.isFinite(yearNum) &&
            yearNum >= 2000
        ) {
            return { month: monthNum, year: yearNum };
        }

        if (typeof rawMonth === "string") {
            const value = rawMonth.trim();
            const match = value.match(/^(\d{4})-(\d{1,2})/);
            if (match) {
                const parsedYear = Number(match[1]);
                const parsedMonth = Number(match[2]);
                if (
                    Number.isFinite(parsedYear) &&
                    Number.isFinite(parsedMonth) &&
                    parsedMonth >= 1 &&
                    parsedMonth <= 12
                ) {
                    return { month: parsedMonth, year: parsedYear };
                }
            }
        }

        return null;
    };

    const downloadPayslip = useCallback(
        async (payslip: EmployeePayslip | undefined, key: string) => {
            if (payslipDownloading) return;
            if (!payslip) return;

            const employeeId = profile?.employeeId || params.employeeId;
            if (!employeeId) {
                Alert.alert("Payslip", "Missing employee id.");
                return;
            }

            const monthYear = extractMonthYear(payslip);
            if (!monthYear) {
                Alert.alert(
                    "Payslip",
                    "Payslip month/year missing from API response.",
                );
                return;
            }

            setPayslipDownloading(true);
            setDownloadingPayslipKey(key);
            try {
                const response = await getPayslipDownloadUrl({
                    employeeId,
                    month: monthYear.month,
                    year: monthYear.year,
                });

                if (!response?.success) {
                    throw new Error(
                        response?.message ||
                            "Failed to get payslip download url.",
                    );
                }

                const url =
                    response?.data?.downloadUrl || response?.data?.payslipUrl;
                if (!url) {
                    throw new Error("Download url not found in response.");
                }

                const canOpen = await Linking.canOpenURL(url);
                if (!canOpen) {
                    throw new Error("Cannot open download url.");
                }
                await Linking.openURL(url);
            } catch (err: any) {
                const message =
                    err?.response?.data?.message ||
                    err?.message ||
                    "Unable to download payslip.";
                Alert.alert("Payslip", message);
            } finally {
                setPayslipDownloading(false);
                setDownloadingPayslipKey(null);
            }
        },
        [payslipDownloading, profile?.employeeId, params.employeeId],
    );

    const handleDownloadLatestPayslip = useCallback(() => {
        if (!hasPayslips) return;
        return downloadPayslip(latestPayslip, "__latest__");
    }, [hasPayslips, downloadPayslip, latestPayslip]);

    const formatHours = (value?: number | string) => {
        if (typeof value === "number") {
            return `${value.toFixed(1)}h`;
        }
        if (typeof value === "string" && value.length > 0) {
            return `${value}h`;
        }
        return "--";
    };

    const formatCurrency = (value?: number | null) => {
        if (typeof value !== "number") {
            return "--";
        }
        return `₹${value.toLocaleString("en-IN")}`;
    };

    const openSalaryModal = () => {
        setSalaryInput(monthlySalary != null ? String(monthlySalary) : "");
        setSalaryModalVisible(true);
    };

    const submitSalary = async () => {
        const value = Number(salaryInput);
        if (!Number.isFinite(value) || value <= 0) {
            Alert.alert(
                "Invalid salary",
                "Enter a valid amount greater than 0.",
            );
            return;
        }
        if (!recordId) {
            Alert.alert("Salary", "Missing employee identifier.");
            return;
        }
        setSavingSalary(true);
        try {
            const res = await updateEmployeeSalary(recordId, value);
            if (!res?.success) {
                throw new Error(res?.message || "Failed to update salary.");
            }
            setSalaryModalVisible(false);
            await loadProfile(true);
            Alert.alert(
                "Salary updated",
                res.message || "Salary updated successfully.",
            );
        } catch (err: any) {
            const message =
                err?.response?.data?.message ||
                err?.message ||
                "Unable to update salary.";
            Alert.alert("Salary", message);
        } finally {
            setSavingSalary(false);
        }
    };

    const renderOverview = () => (
        <>
            <View style={styles.sectionCard}>
                <Text style={styles.sectionLabel}>Contact</Text>
                <View style={styles.infoGrid}>
                    <View style={styles.infoItem}>
                        <Text style={styles.infoLabel}>Email</Text>
                        <Text style={styles.infoValue}>
                            {profile?.email ?? params.email ?? "Not provided"}
                        </Text>
                    </View>
                    <View style={styles.infoItem}>
                        <Text style={styles.infoLabel}>Phone</Text>
                        <Text style={styles.infoValue}>
                            {profile?.phone ?? "Not provided"}
                        </Text>
                    </View>
                    <View style={styles.infoItem}>
                        <Text style={styles.infoLabel}>Department</Text>
                        <Text style={styles.infoValue}>{headerDepartment}</Text>
                    </View>
                    <View style={styles.infoItem}>
                        <Text style={styles.infoLabel}>Join Date</Text>
                        <Text style={styles.infoValue}>{joinDateLabel}</Text>
                    </View>
                </View>
            </View>

            <View style={styles.sectionCard}>
                <Text style={styles.sectionLabel}>Employment</Text>
                <View style={styles.infoRow}>
                    <View>
                        <Text style={styles.infoSmall}>Employee ID</Text>
                        <Text style={styles.infoLarge}>{headerEmployeeId}</Text>
                    </View>
                    <View>
                        <Text style={styles.infoSmall}>Base Salary</Text>
                        <View style={styles.salaryValueRow}>
                            <Text style={styles.infoLarge}>
                                {salaryDisplay}
                            </Text>
                            <Pressable
                                onPress={openSalaryModal}
                                hitSlop={8}
                                style={styles.salaryEditBtn}
                                accessibilityRole="button"
                            >
                                <Feather
                                    name="edit-2"
                                    size={13}
                                    color="#D4A537"
                                />
                            </Pressable>
                        </View>
                    </View>
                </View>
                <View style={[styles.infoRow, { marginTop: 16 }]}>
                    <View>
                        <Text style={styles.infoSmall}>Status</Text>
                        <View style={styles.statusBadge}>
                            <Text style={styles.statusBadgeText}>
                                {headerStatus}
                            </Text>
                        </View>
                    </View>
                    <View>
                        <Text style={styles.infoSmall}>Role</Text>
                        <Text style={styles.infoLarge}>
                            {profile?.role?.toUpperCase() ?? "EMP"}
                        </Text>
                    </View>
                </View>
            </View>

            <View style={styles.sectionCard}>
                <Text style={styles.sectionLabel}>Leaves Taken This Year</Text>
                {leaveBalance ? (
                    <>
                        <Text style={styles.infoLarge}>
                            {leaveBalance.used}{" "}
                            {leaveBalance.used === 1 ? "day" : "days"}
                        </Text>
                        <Text style={styles.progressCaption}>
                            Approved sick, casual, and earned leaves combined
                            (excludes maternity/paternity).
                        </Text>
                    </>
                ) : (
                    <Text style={styles.infoValue}>
                        Leave data not available
                    </Text>
                )}
            </View>
        </>
    );

    const renderAttendance = () => {
        const stats = attendanceSummary
            ? [
                  {
                      label: "Present",
                      value: attendanceSummary.present,
                      color: "#22C55E",
                  },
                  {
                      label: "Absent",
                      value: attendanceSummary.absent,
                      color: "#F97316",
                  },
                  {
                      label: "Total Days",
                      value: attendanceSummary.totalDays,
                      color: "#3B82F6",
                  },
                  {
                      label: "Avg Hours",
                      value: attendanceSummary.averageWorkHours,
                      color: "#0EA5E9",
                  },
              ]
            : [];

        return (
            <View style={styles.attendanceGrid}>
                {/* Monthly attendance grid first - admin can view history and edit past days */}
                <View style={{ width: "100%" }}>
                    <MonthlyAttendanceGrid
                        employeeId={headerEmployeeId}
                        onChange={() => loadProfile(true)}
                    />
                </View>
                {stats.map((item) => (
                    <View key={item.label} style={styles.attendanceCard}>
                        <Text
                            style={[
                                styles.attendanceLabel,
                                { color: item.color },
                            ]}
                        >
                            {item.label}
                        </Text>
                        <Text style={styles.attendanceValue}>
                            {typeof item.value === "number" ||
                            typeof item.value === "string"
                                ? item.label === "Avg Hours"
                                    ? formatHours(item.value as any)
                                    : item.value
                                : "--"}
                        </Text>
                    </View>
                ))}
            </View>
        );
    };

    const renderSalary = () => {
        const annualSalary = monthlySalary ? monthlySalary * 12 : null;
        const latestPayslip = profile?.Payslips?.[0];

        return (
            <>
                {profile?.id ? (
                    <SalaryProgressBar
                        userId={profile.id}
                        style={{ marginBottom: 14 }}
                    />
                ) : null}

                <View style={styles.sectionCard}>
                    <Text style={styles.sectionLabel}>Salary Overview</Text>
                    <View style={styles.infoRow}>
                        <View>
                            <Text style={styles.infoSmall}>Monthly Base</Text>
                            <Text style={styles.infoLarge}>
                                {formatCurrency(monthlySalary)}
                            </Text>
                        </View>
                        <View>
                            <Text style={styles.infoSmall}>Annualized</Text>
                            <Text style={styles.infoLarge}>
                                {formatCurrency(annualSalary)}
                            </Text>
                        </View>
                    </View>
                    <View style={[styles.infoRow, { marginTop: 16 }]}>
                        <View>
                            <Text style={styles.infoSmall}>Latest Payslip</Text>
                            <Text style={styles.infoLarge}>
                                {latestPayslip?.month ?? "Not issued"}
                            </Text>
                        </View>
                        <View>
                            <Text style={styles.infoSmall}>Status</Text>
                            <View style={styles.salaryTag}>
                                <Text style={styles.salaryTagText}>
                                    {latestPayslip?.status ?? "Pending"}
                                </Text>
                            </View>
                        </View>
                    </View>
                    <Text style={styles.salaryNote}>
                        Figures sourced from employee detail API. Update actual
                        payouts from payroll.
                    </Text>
                </View>

                <View style={styles.sectionCard}>
                    <Text style={styles.sectionLabel}>Salary History</Text>
                    {sortedPayslips.length === 0 ? (
                        <Text style={styles.infoValue}>
                            No previous payroll on record yet.
                        </Text>
                    ) : (
                        sortedPayslips.map((payslip, index) => {
                            const key = payslipKey(payslip, index);
                            const isRowDownloading =
                                downloadingPayslipKey === key;
                            const amount =
                                typeof payslip.netSalary === "number"
                                    ? payslip.netSalary
                                    : typeof payslip.amount === "number"
                                      ? payslip.amount
                                      : null;
                            return (
                                <View
                                    key={key}
                                    style={[
                                        styles.salaryHistoryRow,
                                        index !== sortedPayslips.length - 1 &&
                                            styles.salaryHistoryDivider,
                                    ]}
                                >
                                    <View style={styles.salaryHistoryLeft}>
                                        <Text
                                            style={styles.salaryHistoryPeriod}
                                        >
                                            {formatPayslipPeriod(payslip)}
                                        </Text>
                                        <View style={styles.salaryTag}>
                                            <Text style={styles.salaryTagText}>
                                                {payslip.status ?? "pending"}
                                            </Text>
                                        </View>
                                    </View>
                                    <View style={styles.salaryHistoryRight}>
                                        <Text
                                            style={styles.salaryHistoryAmount}
                                        >
                                            {formatCurrency(amount)}
                                        </Text>
                                        <Pressable
                                            style={[
                                                styles.salaryHistoryDownload,
                                                payslipDownloading &&
                                                    !isRowDownloading &&
                                                    styles.salaryHistoryDownloadDisabled,
                                            ]}
                                            disabled={payslipDownloading}
                                            onPress={() =>
                                                downloadPayslip(payslip, key)
                                            }
                                            accessibilityRole="button"
                                            hitSlop={8}
                                        >
                                            {isRowDownloading ? (
                                                <ActivityIndicator
                                                    size="small"
                                                    color="#D4A537"
                                                />
                                            ) : (
                                                <Feather
                                                    name="download"
                                                    size={14}
                                                    color={
                                                        payslipDownloading
                                                            ? "#9CA3AF"
                                                            : "#D4A537"
                                                    }
                                                />
                                            )}
                                        </Pressable>
                                    </View>
                                </View>
                            );
                        })
                    )}
                </View>

                <View style={styles.sectionCard}>
                    <Text style={styles.sectionLabel}>Payout Schedule</Text>
                    <View style={styles.salaryRow}>
                        <Text style={styles.salaryRowLabel}>Pay Cycle</Text>
                        <View style={styles.salaryRowValueWrap}>
                            <Text style={styles.salaryRowValue}>
                                Last working day of month
                            </Text>
                        </View>
                    </View>
                    <View style={styles.salaryRow}>
                        <Text style={styles.salaryRowLabel}>Disbursement</Text>
                        <View style={styles.salaryRowValueWrap}>
                            <Text style={styles.salaryRowValue}>
                                Bank Transfer
                            </Text>
                        </View>
                    </View>
                    <View style={styles.salaryRow}>
                        <Text style={styles.salaryRowLabel}>Next Payroll</Text>
                        <View style={styles.salaryRowValueWrap}>
                            <Text style={styles.salaryRowValue}>
                                Auto-generates after attendance closure
                            </Text>
                        </View>
                    </View>
                </View>
            </>
        );
    };

    const renderBonus = () => {
        const bonuses = profile?.Bonuses ?? [];

        const formatBonusMonthYear = (
            month?: number | string,
            year?: number | string,
        ) => {
            const parsedMonth =
                typeof month === "number" ? month : Number(month);
            const parsedYear = typeof year === "number" ? year : Number(year);
            if (!Number.isFinite(parsedMonth) || !Number.isFinite(parsedYear)) {
                return "Month/Year not set";
            }
            if (parsedMonth < 1 || parsedMonth > 12) {
                return `Year ${parsedYear}`;
            }
            const date = new Date(parsedYear, parsedMonth - 1, 1);
            const monthLabel = date.toLocaleDateString(undefined, {
                month: "short",
            });
            return `${monthLabel} ${parsedYear}`;
        };

        const formatBonusDate = (value?: string) => {
            if (!value) return "—";
            const parsed = new Date(value);
            if (Number.isNaN(parsed.getTime())) return value;
            return parsed.toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
            });
        };

        if (bonuses.length === 0) {
            return (
                <View style={styles.emptyCard}>
                    <Text style={styles.emptyTitle}>No bonus entries yet</Text>
                    <Text style={styles.emptySubtitle}>
                        Bonuses added from admin will appear here.
                    </Text>
                </View>
            );
        }

        const totalApproved = bonuses
            .filter((item) => (item.status || "").toLowerCase() === "approved")
            .reduce(
                (sum, item) =>
                    sum + (typeof item.amount === "number" ? item.amount : 0),
                0,
            );

        return (
            <>
                {profile?.id ? (
                    <BonusProgressBar
                        userId={profile.id}
                        style={{ marginBottom: 14 }}
                    />
                ) : null}

                <View style={styles.sectionCard}>
                    <Text style={styles.sectionLabel}>
                        Manual Bonus Summary
                    </Text>
                    <View style={styles.infoRow}>
                        <View>
                            <Text style={styles.infoSmall}>Total Entries</Text>
                            <Text style={styles.infoLarge}>
                                {bonuses.length}
                            </Text>
                        </View>
                        <View>
                            <Text style={styles.infoSmall}>Approved Total</Text>
                            <Text style={styles.infoLarge}>
                                {formatCurrency(totalApproved)}
                            </Text>
                        </View>
                    </View>
                </View>

                <View style={styles.sectionCard}>
                    <Text style={styles.sectionLabel}>Bonus History</Text>
                    {bonuses.map((bonus, index) => (
                        <View
                            key={
                                bonus.id || `${bonus.type || "bonus"}-${index}`
                            }
                            style={[
                                styles.bonusRow,
                                index !== bonuses.length - 1 &&
                                    styles.bonusRowDivider,
                            ]}
                        >
                            <View style={styles.bonusLeft}>
                                <Text style={styles.bonusType}>
                                    {(bonus.type || "bonus").toUpperCase()}
                                </Text>
                                <Text style={styles.bonusMetaText}>
                                    Bonus Month:{" "}
                                    {formatBonusMonthYear(
                                        bonus.month,
                                        bonus.year,
                                    )}
                                </Text>
                                <Text style={styles.bonusNote}>
                                    {bonus.notes || "No notes provided"}
                                </Text>
                                <Text style={styles.bonusMetaText}>
                                    {formatBonusDate(bonus.awardedAt)} •{" "}
                                    {bonus.awardedBy || "Admin"}
                                </Text>
                            </View>
                            <View style={styles.bonusRight}>
                                <Text style={styles.bonusAmount}>
                                    {formatCurrency(bonus.amount)}
                                </Text>
                                <View style={styles.salaryTag}>
                                    <Text style={styles.salaryTagText}>
                                        {bonus.status || "pending"}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    ))}
                </View>
            </>
        );
    };

    const renderPayslips = () => {
        if (!hasPayslips) {
            return (
                <View style={styles.emptyCard}>
                    <Text style={styles.emptyTitle}>No payslips yet</Text>
                    <Text style={styles.emptySubtitle}>
                        Payroll has not issued any payslips for this employee.
                    </Text>
                </View>
            );
        }

        return (
            <View style={styles.payslipCard}>
                {profile?.Payslips?.map((payslip, index) => (
                    <View
                        key={payslip.id || payslip.month || index}
                        style={styles.payslipRow}
                    >
                        <View style={styles.payslipIcon}>
                            <Feather
                                name="file-text"
                                size={16}
                                color="#D4A537"
                            />
                        </View>
                        <View style={styles.payslipInfo}>
                            <Text style={styles.payslipTitle}>
                                {payslip.month ?? "Pending period"}
                            </Text>
                            <Text style={styles.payslipSub}>
                                {payslip.status ?? "Draft"}
                            </Text>
                        </View>
                        <View style={styles.downloadIcon}>
                            <Feather
                                name="download"
                                size={14}
                                color="#D4A537"
                            />
                        </View>
                    </View>
                ))}
            </View>
        );
    };

    const renderTabContent = () => {
        switch (activeTab) {
            case "Overview":
                return renderOverview();
            case "Attendance":
                return renderAttendance();
            case "Salary":
                return renderSalary();
            case "Bonus":
                return renderBonus();
            case "Payslips":
                return renderPayslips();
            default:
                return null;
        }
    };

    if (loading && !profile) {
        return (
            <View style={styles.loadingState}>
                <View style={[styles.profileCard, { alignItems: "center" }]}>
                    <View style={styles.avatarRing}>
                        <SkeletonBlock
                            width={74}
                            height={74}
                            borderRadius={37}
                        />
                    </View>
                    <SkeletonBlock
                        style={{ marginTop: 12 }}
                        width={140}
                        height={18}
                        borderRadius={8}
                    />
                    <SkeletonBlock
                        style={{ marginTop: 8 }}
                        width={100}
                        height={12}
                        borderRadius={8}
                    />
                    <SkeletonBlock
                        style={{ marginTop: 8 }}
                        width={180}
                        height={10}
                        borderRadius={8}
                    />
                </View>

                <View
                    style={{
                        width: "100%",
                        paddingHorizontal: 20,
                        marginTop: 20,
                    }}
                >
                    <SkeletonBlock
                        height={14}
                        width="60%"
                        style={{ marginBottom: 12 }}
                    />
                    <SkeletonBlock
                        height={14}
                        width="80%"
                        style={{ marginBottom: 12 }}
                    />
                    <SkeletonBlock
                        height={14}
                        width="40%"
                        style={{ marginBottom: 12 }}
                    />
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.headerRow}>
                <Pressable
                    style={styles.backButton}
                    onPress={() => router.back()}
                >
                    <Feather name="chevron-left" size={20} color="#111111" />
                </Pressable>
                <Text style={styles.headerTitle}>EMPLOYEE PROFILE</Text>
                <Pressable
                    style={styles.moreButton}
                    onPress={() => loadProfile(true)}
                >
                    <Feather name="refresh-cw" size={18} color="#111111" />
                </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.profileCard}>
                    <View style={styles.avatarRing}>
                        {profile?.profilePicture ? (
                            <Image
                                source={{ uri: profile.profilePicture }}
                                style={styles.avatar}
                            />
                        ) : (
                            <View style={styles.placeholderInitials}>
                                <Text style={styles.placeholderInitialsText}>
                                    {getInitials(headerName)}
                                </Text>
                            </View>
                        )}
                    </View>
                    <Text style={styles.name}>{headerName}</Text>
                    <Text style={styles.role}>{headerRole}</Text>
                    <Text style={styles.meta}>
                        ID: {headerEmployeeId} • {headerDepartment}
                    </Text>

                    <View style={styles.tabsRow}>
                        {TABS.map((tab) => {
                            const isActive = tab === activeTab;
                            return (
                                <Pressable
                                    key={tab}
                                    style={styles.tabItem}
                                    onPress={() => setActiveTab(tab)}
                                >
                                    <Text
                                        style={[
                                            styles.tabText,
                                            isActive && styles.tabTextActive,
                                        ]}
                                    >
                                        {tab}
                                    </Text>
                                    {isActive ? (
                                        <View style={styles.tabUnderline} />
                                    ) : null}
                                </Pressable>
                            );
                        })}
                    </View>
                </View>

                {error && (
                    <View style={styles.errorBanner}>
                        <Text style={styles.errorText}>{error}</Text>
                        <Pressable onPress={() => loadProfile(true)}>
                            <Text style={styles.errorAction}>Retry</Text>
                        </Pressable>
                    </View>
                )}

                {loading && profile ? (
                    <View style={styles.inlineLoader}>
                        <ActivityIndicator size="small" color="#D4A537" />
                        <Text style={styles.inlineLoaderText}>
                            Refreshing...
                        </Text>
                    </View>
                ) : null}

                {renderTabContent()}
            </ScrollView>

            <Pressable
                style={[
                    styles.bottomButton,
                    (!hasPayslips || payslipDownloading) &&
                        styles.bottomButtonDisabled,
                ]}
                disabled={!hasPayslips || payslipDownloading}
                onPress={handleDownloadLatestPayslip}
            >
                {payslipDownloading ? (
                    <ActivityIndicator size="small" color="#111111" />
                ) : (
                    <Feather
                        name="download"
                        size={16}
                        color={hasPayslips ? "#D4A537" : "#9CA3AF"}
                    />
                )}
                <Text
                    style={[
                        styles.bottomButtonText,
                        (!hasPayslips || payslipDownloading) &&
                            styles.bottomButtonTextDisabled,
                    ]}
                >
                    {!hasPayslips
                        ? "NO PAYSLIPS TO DOWNLOAD"
                        : payslipDownloading
                          ? "PREPARING DOWNLOAD..."
                          : "DOWNLOAD LATEST PAYSLIP"}
                </Text>
            </Pressable>

            <Modal
                visible={salaryModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() =>
                    !savingSalary && setSalaryModalVisible(false)
                }
            >
                <View style={styles.salaryModalRoot}>
                    <Pressable
                        style={styles.salaryBackdrop}
                        onPress={() =>
                            !savingSalary && setSalaryModalVisible(false)
                        }
                    />
                    <View style={styles.salaryModalCard}>
                        <Text style={styles.salaryModalTitle}>Edit Salary</Text>
                        <Text style={styles.salaryModalSub}>
                            Monthly base salary for {headerName}
                        </Text>
                        <View style={styles.salaryInputRow}>
                            <Text style={styles.salaryCurrency}>₹</Text>
                            <TextInput
                                style={styles.salaryInput}
                                value={salaryInput}
                                onChangeText={setSalaryInput}
                                keyboardType="number-pad"
                                placeholder="0"
                                placeholderTextColor="#9CA3AF"
                                editable={!savingSalary}
                                autoFocus
                            />
                        </View>
                        <Pressable
                            style={[
                                styles.salarySaveBtn,
                                savingSalary && { opacity: 0.6 },
                            ]}
                            onPress={submitSalary}
                            disabled={savingSalary}
                            accessibilityRole="button"
                        >
                            {savingSalary ? (
                                <ActivityIndicator color="#111111" />
                            ) : (
                                <Text style={styles.salarySaveText}>
                                    Save Salary
                                </Text>
                            )}
                        </Pressable>
                        <Pressable
                            style={styles.salaryCancelBtn}
                            onPress={() => setSalaryModalVisible(false)}
                            disabled={savingSalary}
                            accessibilityRole="button"
                        >
                            <Text style={styles.salaryCancelText}>Cancel</Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F8F6F2",
    },
    headerRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 20,
        paddingTop: 52,
        paddingBottom: 12,
    },
    backButton: {
        height: 36,
        width: 36,
        borderRadius: 18,
        backgroundColor: "#FFFFFF",
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#000",
        shadowOpacity: 0.08,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 6 },
        elevation: 2,
    },
    moreButton: {
        height: 36,
        width: 36,
        borderRadius: 18,
        backgroundColor: "#FFFFFF",
        alignItems: "center",
        justifyContent: "center",
    },
    headerTitle: {
        color: "#111111",
        fontWeight: "600",
        letterSpacing: 1,
        fontSize: 12,
    },
    content: {
        paddingHorizontal: 20,
        paddingBottom: 120,
    },
    profileCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 26,
        padding: 20,
        alignItems: "center",
        marginBottom: 20,
        shadowColor: "#000",
        shadowOpacity: 0.08,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
        elevation: 3,
    },
    avatarRing: {
        height: 86,
        width: 86,
        borderRadius: 43,
        borderWidth: 2,
        borderColor: "#D4A537",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 12,
    },
    avatar: {
        height: 74,
        width: 74,
        borderRadius: 37,
    },
    name: {
        fontSize: 16,
        fontWeight: "600",
        color: "#111111",
    },
    role: {
        fontSize: 11,
        color: "#D4A537",
        marginTop: 4,
        letterSpacing: 1,
    },
    meta: {
        fontSize: 10,
        color: "#9CA3AF",
        marginTop: 4,
    },
    tabsRow: {
        flexDirection: "row",
        marginTop: 16,
        gap: 18,
    },
    tabItem: {
        alignItems: "center",
    },
    tabText: {
        fontSize: 11,
        color: "#9CA3AF",
    },
    tabTextActive: {
        color: "#111111",
        fontWeight: "600",
    },
    tabUnderline: {
        marginTop: 6,
        height: 2,
        width: 36,
        backgroundColor: "#D4A537",
        borderRadius: 999,
    },
    sectionCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 18,
        padding: 18,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: "#F2E7C2",
    },
    sectionLabel: {
        fontSize: 12,
        fontWeight: "600",
        color: "#111111",
        marginBottom: 12,
    },
    infoGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 12,
    },
    infoItem: {
        width: "48%",
    },
    infoLabel: {
        fontSize: 10,
        color: "#9CA3AF",
        letterSpacing: 1,
    },
    infoValue: {
        fontSize: 14,
        fontWeight: "600",
        color: "#111111",
        marginTop: 4,
        wordWrap: "break-word",
    },
    infoRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    infoSmall: {
        fontSize: 10,
        color: "#9CA3AF",
        letterSpacing: 0.5,
    },
    infoLarge: {
        fontSize: 16,
        fontWeight: "600",
        color: "#111111",
        marginTop: 2,
    },
    statusBadge: {
        marginTop: 4,
        backgroundColor: "#DCFCE7",
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 4,
    },
    statusBadgeText: {
        fontSize: 11,
        color: "#15803D",
        fontWeight: "600",
    },
    progressCaption: {
        marginTop: 8,
        fontSize: 11,
        color: "#6B7280",
    },
    attendanceGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 12,
    },
    attendanceCard: {
        width: "47%",
        borderRadius: 16,
        padding: 14,
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "#F3F4F6",
    },
    attendanceLabel: {
        fontSize: 11,
        fontWeight: "600",
    },
    attendanceValue: {
        marginTop: 6,
        fontSize: 20,
        fontWeight: "700",
        color: "#111111",
    },
    salaryNote: {
        marginTop: 10,
        fontSize: 11,
        color: "#6B7280",
    },
    salaryRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginTop: 12,
        gap: 12,
    },
    salaryRowLabel: {
        fontSize: 10,
        color: "#9CA3AF",
        letterSpacing: 1,
        flexShrink: 0,
        paddingTop: 2,
    },
    salaryRowValueWrap: {
        flex: 1,
        minWidth: 0,
        alignItems: "flex-end",
    },
    salaryRowValue: {
        fontSize: 14,
        fontWeight: "600",
        color: "#111111",
        textAlign: "right",
        flexShrink: 1,
    },
    salaryTag: {
        marginTop: 4,
        backgroundColor: "#F3F4F6",
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 4,
    },
    salaryHistoryRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 12,
    },
    salaryHistoryDivider: {
        borderBottomWidth: 1,
        borderColor: "#F3F4F6",
    },
    salaryHistoryLeft: {
        flex: 1,
        paddingRight: 12,
        gap: 6,
    },
    salaryHistoryPeriod: {
        fontSize: 13,
        fontWeight: "600",
        color: "#111111",
    },
    salaryHistoryRight: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    salaryHistoryAmount: {
        fontSize: 14,
        fontWeight: "700",
        color: "#111111",
    },
    salaryHistoryDownload: {
        height: 30,
        width: 30,
        borderRadius: 15,
        backgroundColor: "#FFF6DC",
        alignItems: "center",
        justifyContent: "center",
    },
    salaryHistoryDownloadDisabled: {
        backgroundColor: "#F3F4F6",
    },
    salaryTagText: {
        fontSize: 11,
        color: "#374151",
        fontWeight: "600",
    },
    bonusRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        paddingVertical: 10,
    },
    bonusRowDivider: {
        borderBottomWidth: 1,
        borderColor: "#F3F4F6",
    },
    bonusLeft: {
        flex: 1,
        paddingRight: 10,
    },
    bonusRight: {
        alignItems: "flex-end",
    },
    bonusType: {
        fontSize: 11,
        color: "#D4A537",
        fontWeight: "700",
        letterSpacing: 0.6,
    },
    bonusNote: {
        marginTop: 4,
        fontSize: 13,
        color: "#111827",
        fontWeight: "600",
    },
    bonusMetaText: {
        marginTop: 4,
        fontSize: 11,
        color: "#6B7280",
    },
    bonusAmount: {
        fontSize: 15,
        fontWeight: "700",
        color: "#111827",
        marginBottom: 6,
    },
    emptyCard: {
        padding: 18,
        borderRadius: 18,
        backgroundColor: "#FFF7ED",
        borderWidth: 1,
        borderColor: "#FED7AA",
    },
    emptyTitle: {
        fontSize: 13,
        fontWeight: "600",
        color: "#7C2D12",
    },
    emptySubtitle: {
        fontSize: 11,
        color: "#9A3412",
        marginTop: 6,
    },
    payslipCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 18,
        padding: 12,
        borderWidth: 1,
        borderColor: "#F2E7C2",
        gap: 10,
    },
    payslipRow: {
        flexDirection: "row",
        alignItems: "center",
    },
    payslipIcon: {
        height: 30,
        width: 30,
        borderRadius: 15,
        backgroundColor: "#FFF6DC",
        alignItems: "center",
        justifyContent: "center",
    },
    payslipInfo: {
        flex: 1,
        marginLeft: 10,
    },
    payslipTitle: {
        fontSize: 12,
        fontWeight: "600",
        color: "#111111",
    },
    payslipSub: {
        fontSize: 9,
        color: "#9CA3AF",
        marginTop: 2,
    },
    downloadIcon: {
        height: 26,
        width: 26,
        borderRadius: 13,
        backgroundColor: "#FFF6DC",
        alignItems: "center",
        justifyContent: "center",
    },
    errorBanner: {
        backgroundColor: "#FEF2F2",
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: "#FECACA",
        marginBottom: 16,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
    },
    errorText: {
        flex: 1,
        color: "#7F1D1D",
        fontSize: 12,
    },
    errorAction: {
        color: "#B91C1C",
        fontWeight: "600",
    },
    inlineLoader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginBottom: 16,
    },
    inlineLoaderText: {
        color: "#6B7280",
        fontSize: 12,
    },
    bottomButton: {
        position: "absolute",
        bottom: 24,
        left: 20,
        right: 20,
        backgroundColor: "#0B0B0B",
        borderRadius: 18,
        paddingVertical: 16,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        shadowColor: "#000",
        shadowOpacity: 0.14,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 10 },
        elevation: 4,
    },
    bottomButtonDisabled: {
        backgroundColor: "#E5E7EB",
    },
    bottomButtonText: {
        color: "#D4A537",
        fontSize: 11,
        fontWeight: "600",
        letterSpacing: 1,
    },
    bottomButtonTextDisabled: {
        color: "#6B7280",
    },
    loadingState: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#F8F6F2",
    },
    loadingLabel: {
        marginTop: 12,
        color: "#6B7280",
    },
    placeholderInitials: {
        height: 74,
        width: 74,
        borderRadius: 37,
        backgroundColor: "#F3F4F6",
        alignItems: "center",
        justifyContent: "center",
    },
    placeholderInitialsText: {
        fontSize: 24,
        fontWeight: "600",
        color: "#111111",
    },
    salaryValueRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    salaryEditBtn: {
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: "#FFF6DC",
        alignItems: "center",
        justifyContent: "center",
    },
    salaryModalRoot: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 32,
    },
    salaryBackdrop: {
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,0.35)",
    },
    salaryModalCard: {
        width: "100%",
        maxWidth: 360,
        backgroundColor: "#FFFFFF",
        borderRadius: 18,
        padding: 20,
    },
    salaryModalTitle: {
        fontSize: 16,
        fontWeight: "800",
        color: "#111827",
    },
    salaryModalSub: {
        fontSize: 12,
        color: "#6B7280",
        marginTop: 2,
        marginBottom: 14,
    },
    salaryInputRow: {
        flexDirection: "row",
        alignItems: "center",
        borderWidth: 1,
        borderColor: "#E5E7EB",
        borderRadius: 12,
        paddingHorizontal: 12,
    },
    salaryCurrency: {
        fontSize: 16,
        fontWeight: "700",
        color: "#111827",
        marginRight: 4,
    },
    salaryInput: {
        flex: 1,
        height: 48,
        fontSize: 16,
        color: "#111827",
    },
    salarySaveBtn: {
        marginTop: 16,
        backgroundColor: "#D4A537",
        borderRadius: 14,
        paddingVertical: 14,
        alignItems: "center",
        justifyContent: "center",
    },
    salarySaveText: {
        color: "#111111",
        fontWeight: "700",
        fontSize: 14,
    },
    salaryCancelBtn: {
        marginTop: 8,
        paddingVertical: 12,
        alignItems: "center",
    },
    salaryCancelText: {
        color: "#6B7280",
        fontWeight: "600",
    },
});
