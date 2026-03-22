import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

interface ErrorBoundaryProps {
    children: React.ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
}

export default class ErrorBoundary extends React.Component<
    ErrorBoundaryProps,
    ErrorBoundaryState
> {
    state: ErrorBoundaryState = { hasError: false };

    static getDerivedStateFromError(): ErrorBoundaryState {
        return { hasError: true };
    }

    reset = () => {
        this.setState({ hasError: false });
    };

    render() {
        if (this.state.hasError) {
            return (
                <View style={styles.container}>
                    <Text style={styles.title}>Something went wrong.</Text>
                    <Text style={styles.subtitle}>
                        Reload this screen and try again.
                    </Text>
                    <Pressable style={styles.button} onPress={this.reset}>
                        <Text style={styles.buttonText}>Retry</Text>
                    </Pressable>
                </View>
            );
        }

        return this.props.children;
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 24,
        backgroundColor: "#F8F6F2",
    },
    title: {
        fontSize: 18,
        fontWeight: "700",
        color: "#111827",
    },
    subtitle: {
        marginTop: 8,
        fontSize: 14,
        color: "#6B7280",
        textAlign: "center",
    },
    button: {
        marginTop: 16,
        paddingHorizontal: 18,
        paddingVertical: 12,
        borderRadius: 999,
        backgroundColor: "#111827",
    },
    buttonText: {
        color: "#FFFFFF",
        fontWeight: "700",
    },
});
