import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

interface Props {
    message: string;
    onRetry?: () => void;
    onDismiss?: () => void;
}

export default function InlineErrorBanner({
    message,
    onRetry,
    onDismiss,
}: Props) {
    return (
        <View style={styles.container} accessibilityRole="alert">
            <Ionicons
                name="alert-circle"
                size={18}
                color="#B91C1C"
                style={styles.icon}
            />
            <Text style={styles.text} numberOfLines={3}>
                {message}
            </Text>
            {onRetry && (
                <Pressable
                    onPress={onRetry}
                    style={({ pressed }) => [
                        styles.retryButton,
                        pressed && styles.retryButtonPressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Retry"
                >
                    <Text style={styles.retryText}>Retry</Text>
                </Pressable>
            )}
            {onDismiss && (
                <Pressable
                    onPress={onDismiss}
                    hitSlop={10}
                    style={styles.dismissButton}
                    accessibilityRole="button"
                    accessibilityLabel="Dismiss"
                >
                    <Ionicons name="close" size={16} color="#7F1D1D" />
                </Pressable>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FEF2F2",
        borderColor: "#FCA5A5",
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 12,
    },
    icon: {
        marginRight: 8,
    },
    text: {
        flex: 1,
        color: "#7F1D1D",
        fontSize: 13,
        fontWeight: "500",
    },
    retryButton: {
        marginLeft: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: "#B91C1C",
    },
    retryButtonPressed: {
        opacity: 0.8,
    },
    retryText: {
        color: "#FFFFFF",
        fontSize: 12,
        fontWeight: "700",
    },
    dismissButton: {
        marginLeft: 8,
        padding: 4,
    },
});
