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

export default function RegisterScreen() {
    const [form, setForm] = useState({
        name: "",
        email: "",
        phone: "",
        passcode: "",
    });
    const [loading, setLoading] = useState(false);
    const [otp, setOtp] = useState("");
    const [otpPendingEmail, setOtpPendingEmail] = useState("");
    const [otpStepVisible, setOtpStepVisible] = useState(false);
    const [otpLoading, setOtpLoading] = useState(false);
    const { width } = useWindowDimensions();
    const cardWidth = Math.min(440, width - 48);

    const handleChange = (field: keyof typeof form, value: string) => {
        setForm((prev) => ({ ...prev, [field]: value }));
    };

    const resetFlow = () => {
        setForm({ name: "", email: "", phone: "", passcode: "" });
        setOtp("");
        setOtpStepVisible(false);
        setOtpPendingEmail("");
    };

    const handleRegister = async () => {
        const { name, email, phone, passcode } = form;
        if (!name.trim() || !email.trim() || !phone.trim() || !passcode.trim()) {
            Alert.alert("Error", "Please fill out every field");
            return;
        }

        setLoading(true);
        try {
            const response = await auth.registerUser({
                name: name.trim(),
                email: email.trim(),
                phone: phone.trim(),
                passcode: passcode.trim(),
            });

            if (response.success) {
                Alert.alert("Registration", response.message || "OTP sent to your email");
                setOtpStepVisible(true);
                setOtpPendingEmail(email.trim());
            } else {
                Alert.alert("Registration Failed", response.message || "Unable to register");
            }
        } catch (error: any) {
            console.error("Registration error:", error);
            const message =
                error.response?.data?.message || error.message || "Unable to register right now.";
            Alert.alert("Registration Error", message);
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async () => {
        if (!otpPendingEmail || !otp.trim()) {
            Alert.alert("Error", "Enter the OTP before verifying");
            return;
        }

        setOtpLoading(true);
        try {
            const response = await auth.verifyOtp({
                email: otpPendingEmail,
                otp: otp.trim(),
            });

            if (response.success) {
                Alert.alert("Verification", response.message || "OTP verified");
                resetFlow();
                router.replace("/");
            } else {
                Alert.alert("Verification Failed", response.message || "OTP invalid");
            }
        } catch (error: any) {
            console.error("OTP verification error:", error);
            const message = error.response?.data?.message || error.message || "Unable to verify OTP.";
            Alert.alert("Verification Error", message);
        } finally {
            setOtpLoading(false);
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
                        <Text style={styles.welcome}>REGISTER</Text>
                        <Text style={styles.title}>Create Account</Text>
                        <Text style={styles.subtitle}>Set up your attendance access</Text>
                    </View>

                    <View style={[styles.card, { width: cardWidth }]}> 
                        <Text style={styles.label}>NAME</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="John Doe"
                            value={form.name}
                            onChangeText={(value) => handleChange("name", value)}
                            autoCapitalize="words"
                        />

                        <Text style={[styles.label, styles.labelTop]}>EMAIL</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="email@example.com"
                            keyboardType="email-address"
                            autoCapitalize="none"
                            value={form.email}
                            onChangeText={(value) => handleChange("email", value)}
                        />

                        <Text style={[styles.label, styles.labelTop]}>PHONE</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="9876543210"
                            keyboardType="phone-pad"
                            value={form.phone}
                            onChangeText={(value) => handleChange("phone", value)}
                        />

                        <Text style={[styles.label, styles.labelTop]}>PASSCODE</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="5678"
                            secureTextEntry
                            value={form.passcode}
                            onChangeText={(value) => handleChange("passcode", value)}
                        />

                        <Pressable
                            style={[
                                styles.registerButton,
                                loading && styles.loginButtonDisabled,
                            ]}
                            onPress={handleRegister}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#FFFFFF" />
                            ) : (
                                <Text style={styles.registerButtonText}>Register</Text>
                            )}
                        </Pressable>

                        <Pressable
                            style={styles.secondaryLink}
                            onPress={() => router.replace("/")}
                        >
                            <Text style={styles.secondaryText}>Back to login</Text>
                        </Pressable>

                        {otpStepVisible && (
                            <View style={styles.otpSection}>
                                <Text style={styles.label}>ENTER OTP</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="123456"
                                    keyboardType="number-pad"
                                    value={otp}
                                    onChangeText={setOtp}
                                />
                                <Pressable
                                    style={[
                                        styles.verifyButton,
                                        otpLoading && styles.loginButtonDisabled,
                                    ]}
                                    onPress={handleVerifyOtp}
                                    disabled={otpLoading}
                                >
                                    {otpLoading ? (
                                        <ActivityIndicator color="#FFFFFF" />
                                    ) : (
                                        <Text style={styles.verifyButtonText}>Verify OTP</Text>
                                    )}
                                </Pressable>
                            </View>
                        )}
                    </View>

                    <View style={styles.footer}>
                        <Text style={styles.footerText}>
                            Need help? Reach out to your administrator.
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
    loginButtonDisabled: {
        opacity: 0.6,
    },
    registerButton: {
        backgroundColor: "#4B5563",
        borderRadius: 14,
        paddingVertical: 14,
        marginTop: 18,
        alignItems: "center",
    },
    registerButtonText: {
        color: "#FFFFFF",
        fontWeight: "600",
    },
    secondaryLink: {
        marginTop: 12,
        alignItems: "center",
    },
    secondaryText: {
        color: "#6B7280",
        fontSize: 12,
    },
    otpSection: {
        marginTop: 18,
    },
    verifyButton: {
        backgroundColor: "#2563EB",
        borderRadius: 14,
        paddingVertical: 12,
        marginTop: 12,
        alignItems: "center",
    },
    verifyButtonText: {
        color: "#FFFFFF",
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
