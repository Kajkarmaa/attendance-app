import { useAuth } from "@/contexts/AuthContext";
import { changePassword, fetchEmployeeProfile, updateProfileImage, type EmployeeProfile } from "@/services/profile";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

export default function ProfileSettingScreen() {
    const { user, logout } = useAuth();
    const [profile, setProfile] = useState<EmployeeProfile | null>(null);
    const [loading, setLoading] = useState(false);
    const [photoUri, setPhotoUri] = useState<string | null>(null);

    useEffect(() => {
        load();
    }, []);

    const load = async () => {
        setLoading(true);
        try {
            const data = await fetchEmployeeProfile();
            setProfile(data);
            setPhotoUri(data?.profilePicture ?? null);
        } catch (err: any) {
            console.log("profile load failed", err?.message || err);
        } finally {
            setLoading(false);
        }
    };

    const [uploadingPhoto, setUploadingPhoto] = useState(false);

    const getInitials = (name?: string | null) => {
        if (!name) return "";
        const parts = name.trim().split(/\s+/);
        if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
        return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    };

    const handlePickImage = async () => {
        const takePhoto = async () => {
            try {
                const permission = await ImagePicker.requestCameraPermissionsAsync();
                if (permission.status !== "granted") {
                    Alert.alert("Permission required", "Camera permission is required to update profile photo.");
                    return;
                }
                const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.7, cameraType: ImagePicker.CameraType.front });
                if (result.canceled) return;
                const asset = (result as any).assets?.[0];
                const uri = asset?.uri ?? (result as any).uri;
                if (uri) {
                    setPhotoUri(uri);
                    // upload to server
                    setUploadingPhoto(true);
                    try {
                        const name = asset?.fileName ?? uri.split("/").pop();
                        const type = asset?.type ?? "image/jpeg";
                        await updateProfileImage({ uri, name, type });
                        Alert.alert("Uploaded", "Profile photo uploaded.");
                        // refresh profile from server
                        await load();
                    } catch (err: any) {
                        console.log("upload failed", err?.message || err);
                        Alert.alert("Upload failed", err?.message || "Could not upload photo.");
                    } finally {
                        setUploadingPhoto(false);
                    }
                }
            } catch (err: any) {
                Alert.alert("Photo error", err?.message || "Unable to update photo.");
            }
        };

        const pickFromLibrary = async () => {
            try {
                const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (permission.status !== "granted") {
                    Alert.alert("Permission required", "Media library permission is required to choose a photo.");
                    return;
                }
                const result = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, quality: 0.7 });
                if (result.canceled) return;
                const asset = (result as any).assets?.[0];
                const uri = asset?.uri ?? (result as any).uri;
                if (uri) {
                    setPhotoUri(uri);
                    // upload to server
                    setUploadingPhoto(true);
                    try {
                        const name = asset?.fileName ?? uri.split("/").pop();
                        const type = asset?.type ?? "image/jpeg";
                        await updateProfileImage({ uri, name, type });
                        Alert.alert("Uploaded", "Profile photo uploaded.");
                        await load();
                    } catch (err: any) {
                        console.log("upload failed", err?.message || err);
                        Alert.alert("Upload failed", err?.message || "Could not upload photo.");
                    } finally {
                        setUploadingPhoto(false);
                    }
                }
            } catch (err: any) {
                Alert.alert("Photo error", err?.message || "Unable to choose photo.");
            }
        };

        Alert.alert("Update Photo", "Choose a photo source", [
            { text: "Cancel", style: "cancel" },
            { text: "Take Photo", onPress: takePhoto },
            { text: "Choose from Library", onPress: pickFromLibrary },
        ]);
    };

    const handleLogout = async () => {
        try {
            await logout();
        } finally {
            router.replace("/");
        }
    };

    const [changePwdVisible, setChangePwdVisible] = useState(false);
    const [currentPwd, setCurrentPwd] = useState("");
    const [newPwd, setNewPwd] = useState("");
    const [confirmPwd, setConfirmPwd] = useState("");
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [submittingPwd, setSubmittingPwd] = useState(false);

    const submitChangePassword = async () => {
        if (!currentPwd || !newPwd || !confirmPwd) {
            Alert.alert("Validation", "Please fill all fields.");
            return;
        }
        if (newPwd !== confirmPwd) {
            Alert.alert("Validation", "New password and confirm password do not match.");
            return;
        }
        setSubmittingPwd(true);
        try {
            const email = profile?.email ?? user?.email;
            if (!email) throw new Error("Email not available for this user.");
            const resp = await changePassword({ email, oldPasscode: currentPwd, newPasscode: newPwd });
            if (resp?.success) {
                Alert.alert("Success", resp.message || "Password updated successfully.");
                setChangePwdVisible(false);
                setCurrentPwd("");
                setNewPwd("");
                setConfirmPwd("");
            } else {
                const msg = resp?.message || "Unable to update password.";
                Alert.alert("Failed", msg);
            }
        } catch (err: any) {
            const msg = err?.response?.data?.message || err?.message || "Unable to update password.";
            Alert.alert("Error", msg);
        } finally {
            setSubmittingPwd(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.loading}><ActivityIndicator color="#D4A537" /></View>
        );
    }

    return (
        <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
            <View style={styles.topRow}>
                <Pressable onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={20} color="#111827" />
                </Pressable>
                <Text style={styles.headerTitle}>My Profile</Text>
            </View>

            <View style={styles.avatarWrap}>
                <Pressable onPress={handlePickImage} accessibilityRole="imagebutton">
                    <View style={styles.avatarCircle}>
                        {photoUri ? (
                            <Image source={{ uri: photoUri }} style={styles.avatarImage} />
                        ) : (
                            <View style={styles.avatarPlaceholder}>
                                <Text style={styles.avatarInitials}>{getInitials(profile?.name ?? user?.name)}</Text>
                            </View>
                        )}
                    </View>
                </Pressable>
                {uploadingPhoto && (
                    <View style={styles.avatarSpinnerOverlay} pointerEvents="none">
                        <ActivityIndicator size="large" color="#D4A537" />
                    </View>
                )}
                <Pressable onPress={handlePickImage} style={styles.cameraBadge} accessibilityRole="button">
                    <Ionicons name="camera" size={16} color="#fff" />
                </Pressable>
                <Text style={styles.nameText}>{profile?.name ?? user?.name ?? "Employee"}</Text>
                <Text style={styles.emailText}>{profile?.email ?? user?.email ?? ""}</Text>
            </View>

            <View style={styles.card}>
                <View style={styles.rowItem}>
                    <Text style={styles.rowLabel}>Employee ID</Text>
                    <View style={styles.badge}><Text style={styles.badgeText}>{profile?.employeeId ?? "--"}</Text></View>
                </View>
                <View style={styles.separator} />
                <View style={styles.rowItem}>
                    <Text style={styles.rowLabel}>Designation</Text>
                    <Text style={styles.rowValue}>{profile?.designation ?? "--"}</Text>
                </View>
                <View style={styles.separator} />
                <View style={styles.rowItem}>
                    <Text style={styles.rowLabel}>Department</Text>
                    <Text style={styles.rowValue}>{profile?.department ?? "--"}</Text>
                </View>

            </View>
            
            <Pressable style={styles.changePasswordRow} onPress={() => setChangePwdVisible(true)} accessibilityRole="button">
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <View style={styles.rowIcon}><Ionicons name="lock-closed" size={16} color="#F2C94C" /></View>
                    <Text style={styles.changePasswordText}>Change Password</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
            </Pressable>

            <Pressable style={styles.logoutButton} onPress={handleLogout} accessibilityRole="button">
                <Ionicons name="log-out-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.logoutText}>Logout</Text>
            </Pressable>



        </ScrollView>
                        <View style={styles.bottomBar}>
                            <Pressable
                                style={styles.bottomIcon}
                                onPress={() => router.replace("/employee")}
                                accessibilityRole="button"
                            >
                                <Ionicons name="home-outline" size={22} color="#9CA3AF" />
                            </Pressable>
                            <Pressable
                                style={styles.bottomIcon}
                                onPress={() => router.replace("/leave")}
                                accessibilityRole="button"
                            >
                                <Ionicons name="calendar-outline" size={22} color="#9CA3AF" />
                            </Pressable>
                            <Pressable
                                style={styles.bottomIconActive}
                                onPress={() => router.replace("/profile-setting")}
                                accessibilityRole="button"
                            >
                                <Ionicons name="person-outline" size={22} color="#D4A537" />
                            </Pressable>
                        </View>
                             <Modal visible={changePwdVisible} transparent animationType="fade" onRequestClose={() => setChangePwdVisible(false)}>
                <Pressable style={styles.modalBackdrop} onPress={() => setChangePwdVisible(false)} accessibilityRole="button">
                    <View />
                </Pressable>
                <View style={styles.modalCard}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Change Password</Text>
                        <Pressable onPress={() => setChangePwdVisible(false)} style={styles.modalClose}><Ionicons name="close" size={18} color="#6B7280" /></Pressable>
                    </View>
                    <View style={{ paddingHorizontal: 16, paddingBottom: 18 }}>
                        <Text style={styles.fieldLabel}>Current Password</Text>
                        <View style={styles.inputRow}>
                            <TextInput style={styles.input} placeholder="Enter Current Password" secureTextEntry={!showCurrent} value={currentPwd} onChangeText={setCurrentPwd} />
                            <Pressable onPress={() => setShowCurrent(!showCurrent)} style={styles.inputRight}><Ionicons name={showCurrent ? "eye" : "eye-off"} size={18} color="#6B7280" /></Pressable>
                        </View>

                        <Text style={[styles.fieldLabel, { marginTop: 12 }]}>New Password</Text>
                        <View style={styles.inputRow}>
                            <TextInput style={styles.input} placeholder="Enter New Password" secureTextEntry={!showNew} value={newPwd} onChangeText={setNewPwd} />
                            <Pressable onPress={() => setShowNew(!showNew)} style={styles.inputRight}><Ionicons name={showNew ? "eye" : "eye-off"} size={18} color="#6B7280" /></Pressable>
                        </View>

                        <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Confirm Password</Text>
                        <View style={styles.inputRow}>
                            <TextInput style={styles.input} placeholder="Confirm Password" secureTextEntry={!showConfirm} value={confirmPwd} onChangeText={setConfirmPwd} />
                            <Pressable onPress={() => setShowConfirm(!showConfirm)} style={styles.inputRight}><Ionicons name={showConfirm ? "eye" : "eye-off"} size={18} color="#6B7280" /></Pressable>
                        </View>

                        <View style={{ marginTop: 18 }}>
                            <Pressable style={styles.btnPrimary} onPress={submitChangePassword} disabled={submittingPwd} accessibilityRole="button">
                                {submittingPwd ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>Update Password</Text>}
                            </Pressable>
                            <Pressable style={styles.btnSecondary} onPress={() => setChangePwdVisible(false)} accessibilityRole="button">
                                <Text style={styles.btnSecondaryText}>Cancel</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>
                    </View>
            
       
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: "#FDFCF8" },
    container: {
        paddingHorizontal: 24,
        paddingTop: 24,
        paddingBottom: 40,
        backgroundColor: "#FDFCF8",
    },
    loading: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" },
    topRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
    backButton: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#F1F5F9", backgroundColor: "#fff" },
    headerTitle: { fontSize: 18, fontWeight: "700", color: "#111827", marginLeft: 8 },
    avatarWrap: { alignItems: "center", marginTop: 12, marginBottom: 18 },
    avatarCircle: { width: 160, height: 160, borderRadius: 80, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", borderWidth: 6, borderColor: "#F2C94C", overflow: "hidden" },
    avatarImage: { width: "100%", height: "100%", resizeMode: "cover" },
    cameraBadge: { position: "absolute", right: 56, top: 148, width: 40, height: 40, borderRadius: 20, backgroundColor: "#6B7280", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#fff" },
    nameText: { fontSize: 22, fontWeight: "800", color: "#111827", marginTop: 12 },
    emailText: { color: "#6B7280", marginTop: 6 },
    card: { backgroundColor: "#fff", borderRadius: 16, padding: 16, marginTop: 18, shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, borderWidth: 1, borderColor: "#F3E9D4" },
    rowItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12 },
    rowLabel: { color: "#9CA3AF", fontSize: 13 },
    rowValue: { color: "#111827", fontWeight: "700" },
    badge: { backgroundColor: "#F2C94C", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
    badgeText: { color: "#111827", fontWeight: "700" },
    separator: { height: 1, backgroundColor: "#F1F5F9" },
    logoutButton: { marginTop: 28, backgroundColor: "#F2C94C", paddingVertical: 16, borderRadius: 28, flexDirection: "row", alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 12 },
    logoutText: { color: "#111827", fontSize: 16, fontWeight: "700" },
    changePasswordRow: { marginTop: 18, backgroundColor: "#fff", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderColor: "#F1F5F9", shadowColor: "#000", shadowOpacity: 0.02, shadowRadius: 6, shadowOffset: { width: 0, height: 4 } },
    changePasswordText: { color: "#111827", fontWeight: "700", marginLeft: 8 },
    rowIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#FFF7EB", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#FAEFD6" },

    /* Change password modal */
    modalBackdrop: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.3)" },
    modalCard: { marginTop: 140, marginHorizontal: 18, backgroundColor: "#fff", borderRadius: 16, overflow: "hidden", elevation: 8 },
    modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 14, borderBottomWidth: 1, borderColor: "#F1F5F9" },
    modalTitle: { fontSize: 18, fontWeight: "800", color: "#111827" },
    modalClose: { position: "absolute", right: 12, top: 10, width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
    fieldLabel: { color: "#6B7280", marginBottom: 8 },
    inputRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 10, borderWidth: 1, borderColor: "#EAEAEA", paddingHorizontal: 12 },
    input: { flex: 1, height: 44, color: "#111827" },
    inputRight: { padding: 8 },
    btnPrimary: { marginTop: 8, backgroundColor: "#F2C94C", paddingVertical: 14, borderRadius: 28, alignItems: "center", justifyContent: "center" },
    btnPrimaryText: { color: "#111827", fontWeight: "700", fontSize: 16 },
    btnSecondary: { marginTop: 12, paddingVertical: 14, borderRadius: 28, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#EFEFEF" },
    btnSecondaryText: { color: "#6B7280", fontSize: 16 },
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
        justifyContent: "space-evenly",
        alignItems: "center",
        shadowColor: "#000",
        shadowOpacity: 0.08,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: -4 },
        elevation: 6,
        paddingHorizontal: 12,
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
    avatarSpinnerOverlay: {
        position: "absolute",
        top: 24, // aligns to avatarWrap center (avatarCircle top position)
        width: 160,
        height: 160,
        borderRadius: 80,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(255,255,255,0.7)",
    },
    avatarPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F8FAFC" },
    avatarInitials: { fontSize: 40, fontWeight: "800", color: "#111827" },
});
