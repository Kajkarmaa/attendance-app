import { resetPasswordWithOtp, sendOtp } from "@/services/auth";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    useWindowDimensions,
    View,
} from "react-native";

const APP_LOGO = require("../assets/logo.jpg");

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(420, width - 48);

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);

  const handleSendOtp = async () => {
    if (!email) return Alert.alert("Validation", "Please enter your email.");
    setLoading(true);
    try {
      const resp = await sendOtp({ email });
      if (resp?.success) {
        setOtpSent(true);
        Alert.alert("OTP Sent", resp.message || "OTP has been sent to your email.");
      } else {
        Alert.alert("Failed", resp.message || "Unable to send OTP.");
      }
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.message || err?.message || "Unable to send OTP.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!email || !otp || !newPass || !confirmPass) return Alert.alert("Validation", "Please fill all fields.");
    if (newPass !== confirmPass) return Alert.alert("Validation", "Passwords do not match.");
    setLoading(true);
    try {
      const resp = await resetPasswordWithOtp({ email, otp, newPasscode: newPass });
      if (resp?.success) {
        Alert.alert("Success", resp.message || "Password reset successful.", [
          { text: "OK", onPress: () => router.back() },
        ]);
      } else {
        Alert.alert("Failed", resp.message || "Unable to reset password.");
      }
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.message || err?.message || "Unable to reset password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.headerBlock}>
            <View style={styles.logoWrap}>
              <Image source={APP_LOGO} style={styles.logoImage} />
            </View>
            <Text style={styles.welcome}>WELCOME</Text>
            <Text style={styles.title}>Attendance</Text>
            <Text style={styles.subtitle}>Reset your password</Text>
          </View>

          <View style={[styles.card, { width: cardWidth }]}>
            <Text style={[styles.label, { marginBottom: 8 }]}>EMAIL</Text>
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

            {!otpSent ? (
              <Pressable style={[styles.primaryButton, loading && styles.disabled]} onPress={handleSendOtp} disabled={loading}>
                {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>Send OTP</Text>}
              </Pressable>
            ) : (
              <>
                <Text style={[styles.label, { marginTop: 12 }]}>OTP</Text>
                <TextInput style={styles.input} value={otp} onChangeText={setOtp} keyboardType="number-pad" editable={!loading} />

                <Text style={[styles.label, { marginTop: 12 }]}>NEW PASSCODE</Text>
                <TextInput keyboardType="number-pad" style={styles.input} value={newPass} onChangeText={setNewPass} secureTextEntry editable={!loading} />

                <Text style={[styles.label, { marginTop: 12 }]}>CONFIRM PASSCODE</Text>
                <TextInput keyboardType="number-pad" style={styles.input} value={confirmPass} onChangeText={setConfirmPass} secureTextEntry editable={!loading} />

                <Pressable style={[styles.primaryButton, loading && styles.disabled]} onPress={handleReset} disabled={loading}>
                  {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>Submit</Text>}
                </Pressable>
              </>
            )}

            <Pressable style={styles.registerTrigger} onPress={() => router.back()}>
              <Text style={styles.registerTriggerText}>Back to Login</Text>
            </Pressable>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>By continuing you agree to our Terms & Privacy.</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#2F2F2F" },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 24, paddingVertical: 40 },
  headerBlock: { marginBottom: 24, alignItems: "center" },
  logoWrap: { height: 92, width: 92, borderRadius: 46, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", marginBottom: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  logoImage: { height: 64, width: 64, resizeMode: "contain" },
  welcome: { color: "#FFFFFF", fontSize: 12, letterSpacing: 2 },
  title: { color: "#FFFFFF", fontSize: 28, fontWeight: "600", marginTop: 8 },
  subtitle: { color: "rgba(255,255,255,0.7)", marginTop: 8 },
  card: { alignSelf: "center", backgroundColor: "#FFFFFF", borderRadius: 24, padding: 20, borderWidth: 1, borderColor: "#F0F0F0", shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 3 },
  label: { color: "#2F2F2F", fontSize: 11 },
  input: { borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: "#111827", marginTop: 8 },
  primaryButton: { backgroundColor: "#D4A537", borderRadius: 14, paddingVertical: 14, marginTop: 20, alignItems: "center" },
  primaryText: { color: "#FFFFFF", fontWeight: "600" },
  disabled: { opacity: 0.6 },
  registerTrigger: { marginTop: 12, alignItems: "center" },
  registerTriggerText: { color: "#D4A537", fontSize: 13, fontWeight: "600" },
  footer: { marginTop: 32, alignItems: "center" },
  footerText: { color: "rgba(255,255,255,0.6)", fontSize: 12, textAlign: "center" },
});
