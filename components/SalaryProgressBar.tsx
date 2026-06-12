import {
    fetchMonthlyAccumulator,
    fetchMonthlyAccumulatorForUser,
    type MonthlyAccumulator,
} from "@/services/attendance";
import { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
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
}

const formatINR = (n: number): string => {
    if (!Number.isFinite(n)) return "—";
    return `₹${n.toLocaleString("en-IN", {
        maximumFractionDigits: 2,
        minimumFractionDigits: n % 1 === 0 ? 0 : 2,
    })}`;
};

const monthLabel = (m: number, y: number): string => {
    const names = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December",
    ];
    return `${names[m - 1] ?? m} ${y}`;
};

export default function SalaryProgressBar({ userId, style, refreshKey }: Props) {
    const [data, setData] = useState<MonthlyAccumulator | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setError(null);
        try {
            const result = userId
                ? await fetchMonthlyAccumulatorForUser(userId)
                : await fetchMonthlyAccumulator();
            setData(result);
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

    if (loading) {
        return (
            <View style={[styles.card, style, styles.centered]}>
                <ActivityIndicator color="#D4A537" />
            </View>
        );
    }

    if (error) {
        return (
            <View style={[styles.card, style]}>
                <Text style={styles.errorText}>{error}</Text>
            </View>
        );
    }

    if (!data) {
        return null;
    }

    // Clamp displayed percent to [0, 100] (over-runs are theoretically possible
    // if salary changes mid-month or the deduction config flips negative).
    const pctClamped = Math.max(0, Math.min(100, data.percent));

    return (
        <View style={[styles.card, style]}>
            <View style={styles.headerRow}>
                <Text style={styles.title}>This Month's Earnings</Text>
                <Text style={styles.monthChip}>
                    {monthLabel(data.month, data.year)}
                </Text>
            </View>

            <View style={styles.amountRow}>
                <Text style={styles.amountLarge}>
                    {formatINR(data.accumulated)}
                </Text>
                <Text style={styles.amountSmall}>
                    {" / "}
                    {formatINR(data.fullSalary)}
                </Text>
            </View>

            <View style={styles.barTrack}>
                <View
                    style={[
                        styles.barFill,
                        { width: `${pctClamped}%` },
                    ]}
                />
            </View>

            <View style={styles.footerRow}>
                <Text style={styles.percentText}>{pctClamped.toFixed(1)}%</Text>
                <Text style={styles.breakdownText}>
                    {data.daysBefore10} before 10 · {data.daysAfter10} 10–12 · {data.daysAfter12} after 12
                </Text>
            </View>
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
        fontSize: 11,
        fontWeight: "600",
        color: "#D4A537",
        backgroundColor: "#FEF8EF",
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 4,
        overflow: "hidden",
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
    },
    percentText: {
        fontSize: 12,
        fontWeight: "700",
        color: "#111827",
    },
    breakdownText: {
        fontSize: 11,
        color: "#6B7280",
    },
    errorText: {
        color: "#DC2626",
        fontSize: 13,
        fontWeight: "600",
    },
});
