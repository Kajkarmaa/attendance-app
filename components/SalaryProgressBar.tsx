import { Feather } from "@expo/vector-icons";
import {
    fetchMonthlyAccumulator,
    fetchMonthlyAccumulatorForUser,
    type MonthlyAccumulator,
} from "@/services/attendance";
import type { EmployeePayslip } from "@/services/users";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
    ViewStyle,
} from "react-native";

interface Props {
    /**
     * If set, fetches the accumulator for this user via the admin route.
     * Omit for the employee's own running total.
     */
    userId?: string;
    /** Container style override (margin etc). */
    style?: ViewStyle;
    /**
     * Refresh tick — pass a value that changes whenever the parent wants the
     * bar to re-fetch (e.g. after a check-in completes).
     */
    refreshKey?: unknown;
    /**
     * Prior-month payslip snapshots (any order — we sort internally). When
     * provided, the month chip becomes a picker that lets the user browse
     * frozen data for any prior month.
     */
    history?: EmployeePayslip[];
    /**
     * If set, past-month rows expose a Payslip download button that invokes
     * this. Parent owns the actual download flow (signed URL + open).
     * `key` matches what parent should pass back as `downloadingPayslipKey`
     * to show a spinner on the active row.
     */
    onDownloadPayslip?: (
        payslip: EmployeePayslip,
        key: string,
    ) => void | Promise<void>;
    /**
     * Key of the payslip currently downloading (matches `payslipKey(p)`).
     * Used to show a spinner on the active download button.
     */
    downloadingPayslipKey?: string | null;
}

const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

const formatINR = (n: number): string => {
    if (!Number.isFinite(n)) return "—";
    return `₹${n.toLocaleString("en-IN", {
        maximumFractionDigits: 2,
        minimumFractionDigits: n % 1 === 0 ? 0 : 2,
    })}`;
};

const monthLabel = (m: number, y: number): string => {
    return `${MONTH_NAMES[m - 1] ?? m} ${y}`;
};

const shortMonthLabel = (m: number, y: number): string => {
    const short = MONTH_NAMES[m - 1]?.slice(0, 3) ?? String(m);
    return `${short} ${y}`;
};

const payslipMonthYear = (
    p: EmployeePayslip,
): { month: number; year: number } | null => {
    const rawMonth = p.month;
    const rawYear = p.year;
    const m = typeof rawMonth === "number" ? rawMonth : Number(rawMonth);
    const y = typeof rawYear === "number" ? rawYear : Number(rawYear);
    if (
        Number.isFinite(m) && m >= 1 && m <= 12 &&
        Number.isFinite(y) && y >= 2000
    ) {
        return { month: m, year: y };
    }
    return null;
};

export const payslipKey = (p: EmployeePayslip, index: number = 0): string => {
    return (
        p.payrollId ||
        p.id ||
        `${p.year ?? ""}-${p.month ?? ""}-${index}`
    );
};

const LIVE_KEY = "__live__";

interface DisplayData {
    monthLabel: string;
    accumulated: number;
    fullSalary: number;
    percent: number;
    footerRight: string;
    statusPill: string | null;
    isLive: boolean;
    payslip?: EmployeePayslip;
    payslipKey?: string;
}

export default function SalaryProgressBar({
    userId,
    style,
    refreshKey,
    history,
    onDownloadPayslip,
    downloadingPayslipKey,
}: Props) {
    const [liveData, setLiveData] = useState<MonthlyAccumulator | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedKey, setSelectedKey] = useState<string>(LIVE_KEY);
    const [pickerVisible, setPickerVisible] = useState(false);

    const load = useCallback(async () => {
        setError(null);
        try {
            const result = userId
                ? await fetchMonthlyAccumulatorForUser(userId)
                : await fetchMonthlyAccumulator();
            setLiveData(result);
        } catch (e: any) {
            setError(
                e?.response?.data?.message ||
                    e?.message ||
                    "Failed to load salary progress.",
            );
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        setLoading(true);
        load();
    }, [load, refreshKey]);

    const sortedHistory = useMemo(() => {
        if (!history || history.length === 0) return [];
        // Hide the payslip for the currently-live month — the "This Month"
        // option in the picker already covers it and swapping to a mid-month
        // frozen snapshot would be confusing.
        const liveMonth = liveData?.month;
        const liveYear = liveData?.year;
        return history
            .filter((p) => {
                const my = payslipMonthYear(p);
                if (!my) return false;
                if (liveMonth && liveYear) {
                    return !(my.month === liveMonth && my.year === liveYear);
                }
                return true;
            })
            .sort((a, b) => {
                const aMy = payslipMonthYear(a)!;
                const bMy = payslipMonthYear(b)!;
                return bMy.year - aMy.year || bMy.month - aMy.month;
            });
    }, [history, liveData?.month, liveData?.year]);

    const display = useMemo<DisplayData | null>(() => {
        const buildLive = (): DisplayData | null => {
            if (!liveData) return null;
            return {
                monthLabel: monthLabel(liveData.month, liveData.year),
                accumulated: liveData.accumulated,
                fullSalary: liveData.fullSalary,
                percent: liveData.percent,
                footerRight: `${liveData.daysBefore10} before 10 · ${liveData.daysAfter10} 10–12 · ${liveData.daysAfter12} after 12`,
                statusPill: null,
                isLive: true,
            };
        };

        if (selectedKey === LIVE_KEY) {
            return buildLive();
        }

        const idx = sortedHistory.findIndex(
            (p, i) => payslipKey(p, i) === selectedKey,
        );
        if (idx < 0) {
            // Selection went stale (history refreshed and dropped it) —
            // fall back to live so the card still renders.
            return buildLive();
        }

        const found = sortedHistory[idx];
        const my = payslipMonthYear(found);
        const full =
            typeof found.totalMonthlySalary === "number"
                ? found.totalMonthlySalary
                : 0;
        const earned =
            typeof found.monthlyPay === "number"
                ? found.monthlyPay
                : typeof found.netSalary === "number"
                  ? found.netSalary
                  : typeof found.amount === "number"
                    ? found.amount
                    : 0;
        const percent = full > 0 ? (earned / full) * 100 : 0;
        const netText =
            typeof found.netSalary === "number"
                ? ` · Net ${formatINR(found.netSalary)}`
                : "";
        const presentText =
            typeof found.totalPresentDays === "number"
                ? `${found.totalPresentDays} present days`
                : "Frozen month";
        return {
            monthLabel: my
                ? monthLabel(my.month, my.year)
                : "Prior month",
            accumulated: earned,
            fullSalary: full,
            percent,
            footerRight: `${presentText}${netText}`,
            statusPill: found.status ?? null,
            isLive: false,
            payslip: found,
            payslipKey: selectedKey,
        };
    }, [selectedKey, sortedHistory, liveData]);

    if (loading && !liveData) {
        return (
            <View style={[styles.card, style, styles.centered]}>
                <ActivityIndicator color="#D4A537" />
            </View>
        );
    }

    if (error && !liveData) {
        return (
            <View style={[styles.card, style]}>
                <Text style={styles.errorText}>{error}</Text>
            </View>
        );
    }

    if (!display) {
        return null;
    }

    const pctClamped = Math.max(0, Math.min(100, display.percent));
    const chipInteractive = sortedHistory.length > 0;

    const showDownload =
        !display.isLive &&
        !!onDownloadPayslip &&
        !!display.payslip &&
        !!display.payslipKey;
    const isRowDownloading =
        showDownload && downloadingPayslipKey === display.payslipKey;

    return (
        <View style={[styles.card, style]}>
            <View style={styles.headerRow}>
                <Text style={styles.title}>
                    {display.isLive
                        ? "This Month's Earnings"
                        : "Monthly Earnings"}
                </Text>
                <Pressable
                    style={[
                        styles.monthChip,
                        chipInteractive && styles.monthChipInteractive,
                    ]}
                    onPress={() => {
                        if (chipInteractive) setPickerVisible(true);
                    }}
                    disabled={!chipInteractive}
                    accessibilityRole={chipInteractive ? "button" : "text"}
                >
                    <Text style={styles.monthChipText}>
                        {display.monthLabel}
                    </Text>
                    {chipInteractive ? (
                        <Feather
                            name="chevron-down"
                            size={12}
                            color="#D4A537"
                            style={{ marginLeft: 4 }}
                        />
                    ) : null}
                </Pressable>
            </View>

            <View style={styles.amountRow}>
                <Text style={styles.amountLarge}>
                    {formatINR(display.accumulated)}
                </Text>
                <Text style={styles.amountSmall}>
                    {" / "}
                    {formatINR(display.fullSalary)}
                </Text>
            </View>

            <View style={styles.barTrack}>
                <View
                    style={[styles.barFill, { width: `${pctClamped}%` }]}
                />
            </View>

            <View style={styles.footerRow}>
                <Text style={styles.percentText}>
                    {pctClamped.toFixed(1)}%
                </Text>
                <Text style={styles.breakdownText}>
                    {display.footerRight}
                </Text>
            </View>

            {(!display.isLive && (display.statusPill || showDownload)) ? (
                <View style={styles.pastFooterRow}>
                    {display.statusPill ? (
                        <View style={styles.statusPill}>
                            <Text style={styles.statusPillText}>
                                {display.statusPill}
                            </Text>
                        </View>
                    ) : (
                        <View />
                    )}
                    {showDownload ? (
                        <Pressable
                            style={[
                                styles.downloadButton,
                                (downloadingPayslipKey && !isRowDownloading) &&
                                    styles.downloadButtonDisabled,
                            ]}
                            disabled={!!downloadingPayslipKey}
                            onPress={() => {
                                if (
                                    display.payslip &&
                                    display.payslipKey &&
                                    onDownloadPayslip
                                ) {
                                    onDownloadPayslip(
                                        display.payslip,
                                        display.payslipKey,
                                    );
                                }
                            }}
                            accessibilityRole="button"
                            hitSlop={8}
                        >
                            {isRowDownloading ? (
                                <ActivityIndicator
                                    size="small"
                                    color="#D4A537"
                                />
                            ) : (
                                <>
                                    <Feather
                                        name="download"
                                        size={12}
                                        color="#D4A537"
                                    />
                                    <Text style={styles.downloadButtonText}>
                                        Payslip
                                    </Text>
                                </>
                            )}
                        </Pressable>
                    ) : null}
                </View>
            ) : null}

            <Modal
                visible={pickerVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setPickerVisible(false)}
            >
                <View style={styles.pickerRoot}>
                    <Pressable
                        style={styles.pickerBackdrop}
                        onPress={() => setPickerVisible(false)}
                    />
                    <View style={styles.pickerCard}>
                        <Text style={styles.pickerTitle}>Select month</Text>
                        <ScrollView style={{ maxHeight: 360 }}>
                            {liveData ? (
                                <Pressable
                                    style={[
                                        styles.pickerRow,
                                        selectedKey === LIVE_KEY &&
                                            styles.pickerRowActive,
                                    ]}
                                    onPress={() => {
                                        setSelectedKey(LIVE_KEY);
                                        setPickerVisible(false);
                                    }}
                                >
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.pickerRowLabel}>
                                            This Month
                                        </Text>
                                        <Text style={styles.pickerRowSub}>
                                            {shortMonthLabel(
                                                liveData.month,
                                                liveData.year,
                                            )}
                                            {" · Live"}
                                        </Text>
                                    </View>
                                    <Text style={styles.pickerRowAmount}>
                                        {formatINR(liveData.accumulated)}
                                    </Text>
                                </Pressable>
                            ) : null}
                            {sortedHistory.map((p, i) => {
                                const key = payslipKey(p, i);
                                const my = payslipMonthYear(p);
                                const amount =
                                    typeof p.netSalary === "number"
                                        ? p.netSalary
                                        : typeof p.amount === "number"
                                          ? p.amount
                                          : null;
                                return (
                                    <Pressable
                                        key={key}
                                        style={[
                                            styles.pickerRow,
                                            selectedKey === key &&
                                                styles.pickerRowActive,
                                        ]}
                                        onPress={() => {
                                            setSelectedKey(key);
                                            setPickerVisible(false);
                                        }}
                                    >
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.pickerRowLabel}>
                                                {my
                                                    ? monthLabel(
                                                          my.month,
                                                          my.year,
                                                      )
                                                    : "Prior month"}
                                            </Text>
                                            {p.status ? (
                                                <Text
                                                    style={styles.pickerRowSub}
                                                >
                                                    {p.status}
                                                </Text>
                                            ) : null}
                                        </View>
                                        <Text style={styles.pickerRowAmount}>
                                            {amount != null
                                                ? formatINR(amount)
                                                : "—"}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </ScrollView>
                        <Pressable
                            style={styles.pickerClose}
                            onPress={() => setPickerVisible(false)}
                        >
                            <Text style={styles.pickerCloseText}>Close</Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: "#FFFFFF",
        borderRadius: 18,
        padding: 14,
        shadowColor: "#000",
        shadowOpacity: 0.05,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 2,
        gap: 10,
    },
    centered: {
        alignItems: "center",
        justifyContent: "center",
        minHeight: 110,
    },
    headerRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    title: {
        fontSize: 14,
        fontWeight: "700",
        color: "#111827",
    },
    monthChip: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FEF8EF",
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 4,
        overflow: "hidden",
    },
    monthChipInteractive: {
        borderWidth: 1,
        borderColor: "#F2E7C2",
    },
    monthChipText: {
        fontSize: 11,
        fontWeight: "600",
        color: "#D4A537",
    },
    amountRow: {
        flexDirection: "row",
        alignItems: "baseline",
    },
    amountLarge: {
        fontSize: 24,
        fontWeight: "700",
        color: "#111827",
    },
    amountSmall: {
        fontSize: 14,
        color: "#6B7280",
        fontWeight: "500",
    },
    barTrack: {
        height: 10,
        backgroundColor: "#F3F4F6",
        borderRadius: 999,
        overflow: "hidden",
    },
    barFill: {
        height: "100%",
        backgroundColor: "#D4A537",
        borderRadius: 999,
    },
    footerRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
    },
    percentText: {
        fontSize: 12,
        fontWeight: "700",
        color: "#111827",
    },
    breakdownText: {
        flex: 1,
        textAlign: "right",
        fontSize: 11,
        color: "#6B7280",
    },
    pastFooterRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: 4,
    },
    statusPill: {
        backgroundColor: "#F3F4F6",
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    statusPillText: {
        fontSize: 11,
        fontWeight: "600",
        color: "#374151",
    },
    downloadButton: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        backgroundColor: "#FFF6DC",
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    downloadButtonDisabled: {
        backgroundColor: "#F3F4F6",
    },
    downloadButtonText: {
        fontSize: 11,
        fontWeight: "700",
        color: "#D4A537",
    },
    errorText: {
        color: "#DC2626",
        fontSize: 13,
        fontWeight: "600",
    },
    pickerRoot: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 32,
    },
    pickerBackdrop: {
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,0.35)",
    },
    pickerCard: {
        width: "100%",
        maxWidth: 360,
        backgroundColor: "#FFFFFF",
        borderRadius: 18,
        padding: 18,
    },
    pickerTitle: {
        fontSize: 14,
        fontWeight: "700",
        color: "#111827",
        marginBottom: 8,
    },
    pickerRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 12,
        paddingHorizontal: 10,
        borderRadius: 12,
        gap: 12,
    },
    pickerRowActive: {
        backgroundColor: "#FEF8EF",
    },
    pickerRowLabel: {
        fontSize: 13,
        fontWeight: "600",
        color: "#111827",
    },
    pickerRowSub: {
        fontSize: 11,
        color: "#6B7280",
        marginTop: 2,
    },
    pickerRowAmount: {
        fontSize: 13,
        fontWeight: "700",
        color: "#111827",
    },
    pickerClose: {
        marginTop: 8,
        paddingVertical: 10,
        alignItems: "center",
    },
    pickerCloseText: {
        fontSize: 13,
        fontWeight: "600",
        color: "#6B7280",
    },
});
