import { memo, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

const MONTHS = [
    { label: "Jan", value: 1 },
    { label: "Feb", value: 2 },
    { label: "Mar", value: 3 },
    { label: "Apr", value: 4 },
    { label: "May", value: 5 },
    { label: "Jun", value: 6 },
    { label: "Jul", value: 7 },
    { label: "Aug", value: 8 },
    { label: "Sep", value: 9 },
    { label: "Oct", value: 10 },
    { label: "Nov", value: 11 },
    { label: "Dec", value: 12 },
];

const currentYear = new Date().getFullYear();

interface MonthYearPickerProps {
    month: number;
    year: number;
    onMonthChange: (month: number) => void;
    onYearChange: (year: number) => void;
    minYear?: number;
    maxYear?: number;
}

function MonthYearPicker({
    month,
    year,
    onMonthChange,
    onYearChange,
    minYear = currentYear - 5,
    maxYear = currentYear + 1,
}: MonthYearPickerProps) {
    const years = useMemo(() => {
        const list: number[] = [];
        for (let value = maxYear; value >= minYear; value -= 1) {
            list.push(value);
        }
        return list;
    }, [minYear, maxYear]);

    return (
        <View>
            <Text style={styles.sectionLabel}>Select Month</Text>
            <View style={styles.monthGrid}>
                {MONTHS.map((item) => {
                    const isActive = item.value === month;
                    return (
                        <Pressable
                            key={item.value}
                            onPress={() => onMonthChange(item.value)}
                            style={[styles.monthButton, isActive && styles.monthButtonActive]}
                        >
                            <Text style={isActive ? styles.monthTextActive : styles.monthText}>
                                {item.label}
                            </Text>
                        </Pressable>
                    );
                })}
            </View>

            <Text style={[styles.sectionLabel, styles.sectionSpacing]}>Select Year</Text>
            <View style={styles.yearRow}>
                {years.map((item) => {
                    const isActive = item === year;
                    return (
                        <Pressable
                            key={item}
                            onPress={() => onYearChange(item)}
                            style={[styles.yearButton, isActive && styles.yearButtonActive]}
                        >
                            <Text style={isActive ? styles.yearTextActive : styles.yearText}>{item}</Text>
                        </Pressable>
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    sectionLabel: {
        fontSize: 12,
        fontWeight: "600",
        color: "#6B7280",
        letterSpacing: 1,
        textTransform: "uppercase",
    },
    sectionSpacing: {
        marginTop: 16,
    },
    monthGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        marginTop: 12,
        gap: 8,
    },
    monthButton: {
        width: "22%",
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#E5E7EB",
        paddingVertical: 10,
        alignItems: "center",
        backgroundColor: "#FFFFFF",
    },
    monthButtonActive: {
        backgroundColor: "#D4A537",
        borderColor: "#D4A537",
    },
    monthText: {
        color: "#374151",
        fontWeight: "600",
        fontSize: 13,
    },
    monthTextActive: {
        color: "#FFFFFF",
        fontWeight: "700",
        fontSize: 13,
    },
    yearRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
        marginTop: 12,
    },
    yearButton: {
        flexGrow: 1,
        minWidth: 64,
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#E5E7EB",
        backgroundColor: "#FFFFFF",
        alignItems: "center",
    },
    yearButtonActive: {
        backgroundColor: "#111827",
        borderColor: "#111827",
    },
    yearText: {
        color: "#374151",
        fontWeight: "600",
    },
    yearTextActive: {
        color: "#FFFFFF",
        fontWeight: "700",
    },
});

export default memo(MonthYearPicker);
