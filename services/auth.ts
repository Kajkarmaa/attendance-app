import { logger } from "@/utils/logger";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import * as SecureStore from "expo-secure-store";
import apiClient, { API_BASE_URL, setCachedAccessToken } from "./api";

const ACCESS_TOKEN_KEY = "authToken";
const REFRESH_TOKEN_KEY = "refreshToken";

export interface LoginCredentials {
    email: string;
    passcode: string;
}

export interface User {
    _id: string;
    name: string;
    email: string;
    phone: string;
    employeeId: string;
    designation: string;
    role: string;
    status: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface LoginResponse {
    success: boolean;
    message: string;
    data: {
        user: User;
        token?: string;
        refreshToken?: string;
    };
}

export interface RefreshTokenResponse {
    success: boolean;
    message: string;
    data: {
        token: string;
        refreshToken: string;
    };
}

export interface RegisterPayload {
    name: string;
    email: string;
    phone: string;
    passcode: string;
}

export interface RegisterResponse {
    success: boolean;
    message: string;
    data?: Record<string, unknown>;
}

export interface VerifyOtpPayload {
    email: string;
    otp: string;
}

export interface VerifyOtpResponse {
    success: boolean;
    message: string;
}

export interface SendOtpPayload {
    email: string;
}

export interface SendOtpResponse {
    success: boolean;
    message: string;
}

const normalizeEmail = (email: string) => email.trim().toLowerCase();
const normalizePasscode = (passcode: string) => passcode.trim();

export async function login(
    credentials: LoginCredentials,
): Promise<LoginResponse> {
    const response = await apiClient.post<LoginResponse>("/users/login", {
        email: normalizeEmail(credentials.email),
        passcode: normalizePasscode(credentials.passcode),
    });
    console.log(apiClient.defaults.baseURL);
    if (response.data.success) {
        const token = response.data.data.token;
        const refreshToken = response.data.data.refreshToken;

        if (!token) {
            throw new Error("Login response did not include an auth token.");
        }

        await storeToken(token);
        if (refreshToken) {
            await storeRefreshToken(refreshToken);
        }

        await storeUser(response.data.data.user);
    }

    return response.data;
}

export async function registerUser(
    payload: RegisterPayload,
): Promise<RegisterResponse> {
    const response = await apiClient.post<RegisterResponse>("/users/register", {
        ...payload,
        name: payload.name.trim(),
        email: normalizeEmail(payload.email),
        phone: payload.phone.trim(),
        passcode: normalizePasscode(payload.passcode),
    });

    return response.data;
}

export async function verifyOtp(
    payload: VerifyOtpPayload,
): Promise<VerifyOtpResponse> {
    const response = await apiClient.post<VerifyOtpResponse>(
        "/users/verify-otp",
        { email: normalizeEmail(payload.email), otp: payload.otp.trim() },
    );

    return response.data;
}

export async function sendOtp(
    payload: SendOtpPayload,
): Promise<SendOtpResponse> {
    const response = await apiClient.post<SendOtpResponse>("/users/send-otp", {
        email: normalizeEmail(payload.email),
    });

    return response.data;
}

export async function resetPasswordWithOtp(payload: {
    email: string;
    otp: string;
    newPasscode: string;
}) {
    const response = await apiClient.post<{
        success: boolean;
        message: string;
    }>("/users/reset-password", {
        email: normalizeEmail(payload.email),
        otp: payload.otp.trim(),
        newPasscode: normalizePasscode(payload.newPasscode),
    });
    return response.data;
}

export async function storeToken(token: string): Promise<void> {
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token);
    setCachedAccessToken(token);
}

export async function storeRefreshToken(token: string): Promise<void> {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
}

export async function storeUser(user: User): Promise<void> {
    await AsyncStorage.setItem("user", JSON.stringify(user));
}

export async function getToken(): Promise<string | null> {
    return await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
    return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function getUser(): Promise<User | null> {
    const userStr = await AsyncStorage.getItem("user");
    return userStr ? JSON.parse(userStr) : null;
}

export async function clearStoredTokens(): Promise<void> {
    setCachedAccessToken(null);
    await Promise.all([
        SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
        SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
    ]);
}

/**
 * Exchange the stored refresh token for a new access + refresh token pair.
 * Uses a bare axios instance to avoid recursing through apiClient's interceptor.
 * Throws if no refresh token is stored or the server rejects it.
 */
export async function refreshAuthTokens(): Promise<string> {
    const refreshToken = await getRefreshToken();
    if (!refreshToken) {
        throw new Error("No refresh token available");
    }

    const response = await axios.post<RefreshTokenResponse>(
        `${API_BASE_URL}/users/refresh-token`,
        { refreshToken },
        { timeout: 10000, headers: { "Content-Type": "application/json" } },
    );

    const newAccess = response.data?.data?.token;
    const newRefresh = response.data?.data?.refreshToken;

    if (!newAccess || !newRefresh) {
        throw new Error("Refresh response missing tokens");
    }

    await Promise.all([storeToken(newAccess), storeRefreshToken(newRefresh)]);
    return newAccess;
}

export async function logout(): Promise<void> {
    try {
        const refreshToken = await getRefreshToken();
        await apiClient.post(
            "/users/logout",
            refreshToken ? { refreshToken } : {},
        );
    } catch (error) {
        // Best-effort logout; continue clearing local state
        logger.warn("logout api failed", (error as any)?.message);
    } finally {
        await clearStoredTokens();
        await AsyncStorage.removeItem("user");
    }
}

export async function isAuthenticated(): Promise<boolean> {
    const token = await getToken();
    return !!token;
}
