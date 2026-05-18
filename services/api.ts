import { logger } from "@/utils/logger";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios, { AxiosError, AxiosRequestConfig } from "axios";
import * as SecureStore from "expo-secure-store";

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

const ACCESS_TOKEN_KEY = "authToken";
const REFRESH_TOKEN_KEY = "refreshToken";

type UnauthorizedHandler = (() => void | Promise<void>) | null;

let unauthorizedHandler: UnauthorizedHandler = null;
let unauthorizedRequest: Promise<void> | null = null;

// In-memory cache of the current access token. `undefined` means "not yet read
// from SecureStore". `null` means "definitely no token". Reading from
// SecureStore on every request is slow on Android — caching avoids that.
let cachedAccessToken: string | null | undefined = undefined;

// Single-flight refresh: if multiple requests 401 concurrently, only one
// network call should hit /users/refresh-token. The rest await the same
// promise and inherit the result.
let refreshInFlight: Promise<string> | null = null;

export function setCachedAccessToken(token: string | null): void {
    cachedAccessToken = token;
}

export async function getStoredAuthToken(): Promise<string | null> {
    if (cachedAccessToken !== undefined) return cachedAccessToken;
    const token = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
    cachedAccessToken = token;
    return token;
}

export async function clearStoredAuthState(): Promise<void> {
    cachedAccessToken = null;
    await Promise.all([
        SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
        SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
        AsyncStorage.removeItem("user"),
    ]);
}

export function setUnauthorizedHandler(handler: UnauthorizedHandler) {
    unauthorizedHandler = handler;
}

async function handleUnauthorizedResponse(): Promise<void> {
    if (!unauthorizedRequest) {
        unauthorizedRequest = (async () => {
            try {
                await clearStoredAuthState();
                await unauthorizedHandler?.();
            } finally {
                unauthorizedRequest = null;
            }
        })();
    }

    return unauthorizedRequest;
}

// Create axios instance
const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        "Content-Type": "application/json",
    },
    timeout: 10000,
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
    async (config) => {
        const token = await getStoredAuthToken();
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error),
);

async function performRefresh(): Promise<string> {
    if (refreshInFlight) return refreshInFlight;

    refreshInFlight = (async () => {
        try {
            // Lazy import to avoid a circular dependency with services/auth.
            const { refreshAuthTokens } = await import("./auth");
            return await refreshAuthTokens();
        } finally {
            refreshInFlight = null;
        }
    })();

    return refreshInFlight;
}

// Response interceptor: on 401 try to refresh the access token once and
// transparently retry the original request. Falls back to logout on failure.
apiClient.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const originalRequest = error.config as
            | (AxiosRequestConfig & { _retry?: boolean; url?: string })
            | undefined;
        const status = error.response?.status;

        // Don't try to refresh on the refresh endpoint itself (defense in depth —
        // refresh uses a bare axios instance, but be safe in case that changes).
        const isRefreshCall = originalRequest?.url?.includes("/users/refresh-token");

        if (status === 401 && originalRequest && !originalRequest._retry && !isRefreshCall) {
            originalRequest._retry = true;
            try {
                const newToken = await performRefresh();
                originalRequest.headers = {
                    ...(originalRequest.headers || {}),
                    Authorization: `Bearer ${newToken}`,
                };
                return apiClient.request(originalRequest);
            } catch (refreshError) {
                logger.warn("token refresh failed", (refreshError as any)?.message);
                await handleUnauthorizedResponse();
                return Promise.reject(error);
            }
        }

        return Promise.reject(error);
    },
);

if (!API_BASE_URL) {
    logger.warn("API base URL is not configured.");
}

export default apiClient;
