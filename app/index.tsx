import { router } from "expo-router";
import { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
    useWindowDimensions,
} from "react-native";
import * as auth from "../services/auth";

export default function LoginScreen() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const { width } = useWindowDimensions();
    const cardWidth = Math.min(420, width - 48);

    const handleLogin = async () => {
        if (!email.trim() || !password.trim()) {
            Alert.alert("Error", "Please enter both email and password");
            return;
        }

        setLoading(true);
        try {
            const response = await auth.login({
                email: email.trim(),
                passcode: password,
            });

            if (response.success) {
                const targetRoute =
                    response.data.user.role === "emp"
                        ? "/employee-profile"
                        : "/(tabs)";
                router.replace(targetRoute);
            } else {
                Alert.alert(
                    "Login Failed",
                    response.message || "Invalid credentials",
                );
            }
        } catch (error: any) {
            console.error("Login error:", error);
            const errorMessage =
                error.response?.data?.message ||
                error.message ||
                "Network error. Please try again.";
            Alert.alert("Login Error", errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                style={styles.flex}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={styles.headerBlock}>
                        <Text style={styles.welcome}>WELCOME</Text>
                        <Text style={styles.title}>Attendance</Text>
                        <Text style={styles.subtitle}>Sign in to continue</Text>
                    </View>

                    <View style={[styles.card, { width: cardWidth }]}>
                        <Text style={styles.label}>EMAIL</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="you@email.com"
                            placeholderTextColor="#A0A0A0"
                            autoCapitalize="none"
                            keyboardType="email-address"
                            value={email}
                            onChangeText={setEmail}
                            editable={!loading}
                        />

                        <Text style={[styles.label, styles.labelTop]}>
                            PASSWORD
                        </Text>
                        <TextInput
                            style={styles.input}
                            placeholder="••••••••"
                            placeholderTextColor="#A0A0A0"
                            secureTextEntry
                            value={password}
                            onChangeText={setPassword}
                            editable={!loading}
                            onSubmitEditing={handleLogin}
                        />

                        <Pressable
                            style={[
                                styles.loginButton,
                                loading && styles.loginButtonDisabled,
                            ]}
                            onPress={handleLogin}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#FFFFFF" />
                            ) : (
                                <Text style={styles.loginText}>Login</Text>
                            )}
                        </Pressable>

                        <Text style={styles.forgot}>Forgot password?</Text>

                        <Pressable
                            style={styles.registerTrigger}
                            onPress={() => router.push("/register")}
                        >
                            <Text style={styles.registerTriggerText}>
                                Need an account? Register
                            </Text>
                        </Pressable>
                    </View>

                    <View style={styles.footer}>
                        <Text style={styles.footerText}>
                            By continuing you agree to our Terms & Privacy.
                        </Text>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#2F2F2F",
    },
    flex: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: "center",
        paddingHorizontal: 24,
        paddingVertical: 40,
    },
    headerBlock: {
        marginBottom: 32,
    },
    welcome: {
        color: "#FFFFFF",
        fontSize: 12,
        letterSpacing: 2,
    },
    title: {
        color: "#FFFFFF",
        fontSize: 30,
        fontWeight: "600",
        marginTop: 8,
    },
    subtitle: {
        color: "rgba(255,255,255,0.7)",
        marginTop: 8,
    },
    card: {
        alignSelf: "center",
        backgroundColor: "#FFFFFF",
        borderRadius: 24,
        padding: 24,
        borderWidth: 1,
        borderColor: "#F0F0F0",
        shadowColor: "#000",
        shadowOpacity: 0.08,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
        elevation: 3,
    },
    label: {
        color: "#2F2F2F",
        fontSize: 11,
        marginBottom: 8,
    },
    labelTop: {
        marginTop: 16,
    },
    input: {
        borderWidth: 1,
        borderColor: "#E5E7EB",
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 16,
        color: "#111827",
    },
    loginButton: {
        backgroundColor: "#D4A537",
        borderRadius: 14,
        paddingVertical: 14,
        marginTop: 24,
        alignItems: "center",
    },
    loginButtonDisabled: {
        opacity: 0.6,
    },
    loginText: {
        color: "#FFFFFF",
        fontWeight: "600",
    },
    forgot: {
        textAlign: "center",
        color: "#6B7280",
        fontSize: 12,
        marginTop: 16,
    },
    registerTrigger: {
        marginTop: 12,
        alignItems: "center",
    },
    registerTriggerText: {
        color: "#D4A537",
        fontSize: 13,
        fontWeight: "600",
    },
    footer: {
        marginTop: 32,
        alignItems: "center",
    },
    footerText: {
        color: "rgba(255,255,255,0.6)",
        fontSize: 12,
        textAlign: "center",
    },
});
