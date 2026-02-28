import {
    DarkTheme,
    DefaultTheme,
    ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";

import { AuthProvider } from "@/contexts/AuthContext";
import { useColorScheme } from "@/hooks/use-color-scheme";

export default function RootLayout() {
    const colorScheme = useColorScheme();

    return (
        <ThemeProvider
            value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
        >
            <AuthProvider>
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
            </AuthProvider>
            <StatusBar style="auto" />
        </ThemeProvider>
    );
}
