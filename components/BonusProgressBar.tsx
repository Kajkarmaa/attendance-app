import {
    fetchYearlyBonusAccumulator,
    fetchYearlyBonusAccumulatorForUser,
    type YearlyBonusAccumulator,
} from "@/services/bonus";
import { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    View,
    ViewStyle,
} from "react-native";

interface Props {
    /** If set, fetches the year accumulator for this user (admin route). Omit for self. */
    userId?: string;
    style?: ViewStyle;
    /** Bump this when the parent wants the bar to refetch (e.g. after a check-in). */
    refreshKey?: unknown;
}

const formatINR = (n: number): string => {
    if (!Number.isFinite(n)) return "—";
    return `₹${n.toLocaleString("en-IN", {
        maximumFractionDigits: 2,
        minimumFractionDigits: n % 1 === 0 ? 0 : 2,
    })}`;
};

export default function BonusProgressBar({ userId, style, refreshKey }: Props) {
    const [data, setData] = useState<YearlyBonusAccumulator | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setError(null);
        try {
            const result = userId
                ? await fetchYearlyBonusAccumulatorForUser(userId)
                : await fetchYearlyBonusAccumulator();
            setData(result);
        } catch (e: any) {
            setError(
                e?.response?.data?.message ||
                    e?.message ||
                    "Failed to load bonus progress.",
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
                <ActivityIndicator color="#16A34A" />
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

    if (!data) return null;

    const pctClamped = Math.max(0, Math.min(100, data.percent));

    return (
        <View style={[styles.card, style]}>
            <View style={styles.headerRow}>
                <Text style={styles.title}>This Year's Bonus</Text>
                <Text style={styles.yearChip}>{data.year}</Text>
            </View>

            <View style={styles.amountRow}>
                <Text style={styles.amountLarge}>
                    {formatINR(data.accumulated)}
                </Text>
                <Text style={styles.amountSmall}>
                    {" / "}
                    {formatINR(data.nominalYearlyPool)}
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
                    {data.presentDays} present days
                    {data.manualBonusTotal > 0
                        ? ` · +${formatINR(data.manualBonusTotal)} manual`
                        : ""}
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
    yearChip: {
        fontSize: 11,
        fontWeight: "600",
        color: "#16A34A",
        backgroundColor: "#ECFDF5",
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
        backgroundColor: "#16A34A",
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
