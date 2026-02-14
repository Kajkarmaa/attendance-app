import AsyncStorage from "@react-native-async-storage/async-storage";
import apiClient from "./api";

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
    };
}

class AuthService {
    async login(credentials: LoginCredentials): Promise<LoginResponse> {
        const response = await apiClient.post<LoginResponse>(
            "/users/login",
            credentials,
        );

        if (response.data.success) {
            // Extract token from response headers or data
            // If backend sends token in header:
            const token =
                response.headers["authorization"]?.replace("Bearer ", "") ||
                response.headers["set-cookie"]
                    ?.find((c: string) => c.includes("authToken"))
                    ?.match(/authToken=([^;]+)/)?.[1];

            if (token) {
                await this.storeToken(token);
            }

            // Store user data
            await this.storeUser(response.data.data.user);
        }

        return response.data;
    }

    async storeToken(token: string): Promise<void> {
        await AsyncStorage.setItem("authToken", token);
    }

    async storeUser(user: User): Promise<void> {
        await AsyncStorage.setItem("user", JSON.stringify(user));
    }

    async getToken(): Promise<string | null> {
        return await AsyncStorage.getItem("authToken");
    }

    async getUser(): Promise<User | null> {
        const userStr = await AsyncStorage.getItem("user");
        return userStr ? JSON.parse(userStr) : null;
    }

    async logout(): Promise<void> {
        await AsyncStorage.removeItem("authToken");
        await AsyncStorage.removeItem("user");
    }

    async isAuthenticated(): Promise<boolean> {
        const token = await this.getToken();
        return !!token;
    }
}

export default new AuthService();
