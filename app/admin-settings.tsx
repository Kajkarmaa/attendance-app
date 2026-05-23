import { useAuth } from "@/contexts/AuthContext";
import {
    fetchGlobalConfig,
    updateGlobalConfig,
    type GlobalConfig,
} from "@/services/globalConfig";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
    useWindowDimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

const DEFAULT_CONFIG: GlobalConfig = {
    minCheckoutDuration: 4,
    amountDeductionAfter10am: 2000,
};

export default function AdminSettingsScreen() {
    const { user, isLoading } = useAuth();
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const isWide = width >= 720;

    const BOTTOM_BAR_BASE_HEIGHT = 76;

    const [config, setConfig] = useState<GlobalConfig>(DEFAULT_CONFIG);
    const [minCheckoutText, setMinCheckoutText] = useState<string>(
        String(DEFAULT_CONFIG.minCheckoutDuration),
    );
    const [deductionText, setDeductionText] = useState<string>(
        String(DEFAULT_CONFIG.amountDeductionAfter10am),
    );

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    const loadConfig = async () => {
        try {
            setError(null);
            const response = await fetchGlobalConfig();
            if (response?.success && response.data) {
                setConfig(response.data);
                setMinCheckoutText(String(response.data.minCheckoutDuration));
                setDeductionText(String(response.data.amountDeductionAfter10am));
            }
        } catch (e: any) {
            setError(e?.response?.data?.message || e?.message || "Failed to load settings.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadConfig();
    }, []);

    const onRefresh = async () => {
        setRefreshing(true);
        await loadConfig();
        setRefreshing(false);
    };

    const onSave = async () => {
        setError(null);
        setSuccessMsg(null);

        const minCheckout = Number(minCheckoutText);
        const deduction = Number(deductionText);

        if (!Number.isFinite(minCheckout) || minCheckout < 0.5) {
            setError("Min checkout duration must be a number ≥ 0.5");
            return;
        }
        if (!Number.isFinite(deduction) || deduction < 0) {
            setError("Deduction amount must be a number ≥ 0");
            return;
        }

        try {
            setSaving(true);
            const response = await updateGlobalConfig({
                minCheckoutDuration: minCheckout,
                amountDeductionAfter10am: deduction,
            });
            if (response?.success && response.data) {
                setConfig(response.data);
                setMinCheckoutText(String(response.data.minCheckoutDuration));
                setDeductionText(String(response.data.amountDeductionAfter10am));
                setSuccessMsg(response.message || "Settings updated successfully.");
            }
        } catch (e: any) {
            setError(e?.response?.data?.message || e?.message || "Failed to update settings.");
        } finally {
            setSaving(false);
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
            <View style={styles.headerRow}>
                <Pressable style={styles.backBtn} onPress={() => router.back()}>
                    <Ionicons name="chevron-back" size={22} color="#111827" />
                </Pressable>
                <Text style={styles.headerTitle}>Settings</Text>
                <View style={{ width: 38 }} />
            </View>

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
                <Text style={styles.headerSubTitle}>
                    Configure attendance and payroll rules.
                </Text>

                {loading ? (
                    <View style={{ marginTop: 24, alignItems: "center" }}>
                        <ActivityIndicator color="#D4A537" />
                    </View>
                ) : (
                    <View style={panelStyle}>
                        {successMsg ? (
                            <Text style={styles.successText}>{successMsg}</Text>
                        ) : null}
                        {error ? (
                            <Text style={styles.errorText}>{error}</Text>
                        ) : null}

                        <Text style={styles.fieldLabel}>
                            Minimum checkout duration (hours)
                        </Text>
                        <Text style={styles.fieldHelp}>
                            Employees can only check out after this many net working hours
                            (excluding break time).
                        </Text>
                        <TextInput
                            style={styles.input}
                            value={minCheckoutText}
                            onChangeText={setMinCheckoutText}
                            keyboardType="decimal-pad"
                            placeholder="e.g. 4"
                            placeholderTextColor="#9CA3AF"
                        />

                        <Text style={styles.fieldLabel}>
                            Late check-in deduction (₹)
                        </Text>
                        <Text style={styles.fieldHelp}>
                            Amount subtracted from monthly salary before computing the
                            per-day wage for any day the employee checks in at or after
                            10:00 AM.
                        </Text>
                        <TextInput
                            style={styles.input}
                            value={deductionText}
                            onChangeText={setDeductionText}
                            keyboardType="number-pad"
                            placeholder="e.g. 2000"
                            placeholderTextColor="#9CA3AF"
                        />

                        <Pressable
                            style={[
                                styles.primaryButton,
                                saving && { opacity: 0.6 },
                            ]}
                            onPress={onSave}
                            disabled={saving}
                        >
                            {saving ? (
                                <ActivityIndicator color="#FFFFFF" />
                            ) : (
                                <Text style={styles.primaryButtonText}>
                                    Save Settings
                                </Text>
                            )}
                        </Pressable>
                    </View>
                )}
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
                    <Ionicons
                        name="document-text-outline"
                        size={22}
                        color="#9CA3AF"
                    />
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
        backgroundColor: "#FFFFFF",
        paddingTop: 10,
        paddingHorizontal: 12,
    },
    loadingContainer: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#F3F4F6",
    },
    content: {
        paddingTop: 8,
        paddingBottom: 120,
        gap: 14,
    },
    headerRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 24,
    },
    backBtn: {
        width: 38,
        height: 38,
        alignItems: "center",
        justifyContent: "center",
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
    fieldLabel: {
        fontSize: 14,
        fontWeight: "700",
        color: "#111827",
        marginBottom: 4,
        marginTop: 6,
    },
    fieldHelp: {
        fontSize: 12,
        color: "#6B7280",
        marginBottom: 8,
    },
    input: {
        borderWidth: 1,
        borderColor: "#E5E7EB",
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 16,
        color: "#111827",
        backgroundColor: "#FFFFFF",
    },
    primaryButton: {
        borderRadius: 12,
        paddingVertical: 12,
        alignItems: "center",
        backgroundColor: "#111827",
        marginTop: 6,
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
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: "center",
        justifyContent: "center",
    },
    bottomIconActive: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#FEF8EF",
    },
});
