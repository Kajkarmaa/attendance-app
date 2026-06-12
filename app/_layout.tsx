import AuthLoader from "@/components/AuthLoader";
import ErrorBoundary from "@/components/ErrorBoundary";
import {
    DarkTheme,
    DefaultTheme,
    ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";

import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { useColorScheme } from "@/hooks/use-color-scheme";

SplashScreen.preventAutoHideAsync().catch(() => {});

function SplashGate({ children }: { children: React.ReactNode }) {
    const { isLoading } = useAuth();

    if (isLoading) return <AuthLoader />;
    return <>{children}</>;
}

export default function RootLayout() {
    const colorScheme = useColorScheme();

    return (
        <ThemeProvider
            value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
        >
            <ErrorBoundary>
                <AuthProvider>
                    <SplashGate>
                        <Stack>
                            <Stack.Screen
                                name="index"
                                options={{ headerShown: false }}
                            />
                            <Stack.Screen
                                name="admin"
                                options={{ headerShown: false }}
                            />
                            <Stack.Screen
                                name="admin-leaves"
                                options={{ headerShown: false }}
                            />
                            <Stack.Screen
                                name="admin-attendance"
                                options={{ headerShown: false }}
                            />
                            <Stack.Screen
                                name="admin-settings"
                                options={{ headerShown: false }}
                            />
                            <Stack.Screen
                                name="employee"
                                options={{ headerShown: false, gestureEnabled: false }}
                            />
                            <Stack.Screen
                                name="leave"
                                options={{ headerShown: false, gestureEnabled: false }}
                            />
                            <Stack.Screen
                                name="leave-request"
                                options={{ headerShown: false, gestureEnabled: false }}
                            />
                            <Stack.Screen
                                name="profile-setting"
                                options={{ headerShown: false }}
                            />

                            <Stack.Screen
                                name="add-employee"
                                options={{ headerShown: false }}
                            />
                            <Stack.Screen
                                name="employee-profile"
                                options={{ headerShown: false }}
                            />
                            <Stack.Screen
                                name="modal"
                                options={{ presentation: "modal", title: "Modal" }}
                            />
                        </Stack>
                    </SplashGate>
                </AuthProvider>
            </ErrorBoundary>
            <StatusBar style="auto" />
        </ThemeProvider>
    );
}
