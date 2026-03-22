import { logger } from "@/utils/logger";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import * as SecureStore from "expo-secure-store";

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL

type UnauthorizedHandler = (() => void | Promise<void>) | null;

let unauthorizedHandler: UnauthorizedHandler = null;
let unauthorizedRequest: Promise<void> | null = null;

export async function getStoredAuthToken(): Promise<string | null> {
    return SecureStore.getItemAsync("authToken");
}

export async function clearStoredAuthState(): Promise<void> {
    await Promise.all([
        SecureStore.deleteItemAsync("authToken"),
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

// Response interceptor for error handling
apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        if (error.response?.status === 401) {
            await handleUnauthorizedResponse();
        }
        return Promise.reject(error);
    },
);

if (!API_BASE_URL) {
    logger.warn("API base URL is not configured.");
}

export default apiClient;
