import { logger } from "@/utils/logger";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import * as SecureStore from "expo-secure-store";
import apiClient, {
    API_BASE_URL,
    clearStoredAuthState,
    setCachedAccessToken,
} from "./api";

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

export interface RegisterImage {
    uri: string;
    name?: string;
    type?: string;
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
    image?: RegisterImage,
): Promise<RegisterResponse> {
    const fields = {
        name: payload.name.trim(),
        email: normalizeEmail(payload.email),
        phone: payload.phone.trim(),
        passcode: normalizePasscode(payload.passcode),
    };

    // Without an image we keep posting JSON — same wire format the backend
    // has always accepted via multer's optional `req.file`.
    if (!image) {
        const response = await apiClient.post<RegisterResponse>(
            "/users/register",
            fields,
        );
        return response.data;
    }

    // With an image we have to use multipart/form-data because that's what
    // multer parses on the server.
    const form = new FormData();
    form.append("name", fields.name);
    form.append("email", fields.email);
    form.append("phone", fields.phone);
    form.append("passcode", fields.passcode);

    const filename = image.name || `profile_${Date.now()}.jpg`;
    let mimeType = image.type || "image/jpeg";
    // Android sometimes returns just "image" — coerce to a real MIME.
    if (mimeType === "image" || !mimeType.includes("/")) {
        const ext = filename.split(".").pop()?.toLowerCase();
        const mimeMap: Record<string, string> = {
            jpg: "image/jpeg",
            jpeg: "image/jpeg",
            png: "image/png",
            gif: "image/gif",
            webp: "image/webp",
        };
        mimeType = mimeMap[ext || "jpg"] || "image/jpeg";
    }

    form.append("image", {
        uri: image.uri,
        name: filename,
        type: mimeType,
    } as any);

    const response = await apiClient.post<RegisterResponse>(
        "/users/register",
        form,
        { headers: { "Content-Type": "multipart/form-data" } },
    );
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
    // Delegate to the single source of truth in api.ts so the in-memory data
    // cache and the user object get wiped along with the tokens.
    await clearStoredAuthState();
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
    // Fire-and-forget the server call so the UI never blocks on a slow /
    // hung network. Local state is cleared immediately — the user is now
    // logged out from their perspective even if the request is still in
    // flight or fails.
    const refreshToken = await getRefreshToken();
    apiClient
        .post("/users/logout", refreshToken ? { refreshToken } : {})
        .catch((error) => {
            logger.warn("logout api failed", (error as any)?.message);
        });

    await clearStoredTokens();
}

export async function isAuthenticated(): Promise<boolean> {
    const token = await getToken();
    return !!token;
}

/**
 * Re-fetch the current user from the server. Used on app boot so changes
 * made by an admin while the user was offline (role bump, designation
 * change, deactivation) are reflected without forcing a logout.
 */
export async function fetchCurrentUser(): Promise<User> {
    const response = await apiClient.get<{ success: boolean; data: User }>(
        "/users/profile",
    );
    return response.data.data;
}
