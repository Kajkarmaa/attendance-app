import React, { createContext, useContext, useEffect, useState } from "react";
import {
    User,
    login as authLogin,
    logout as authLogout,
    getUser,
} from "../services/auth";

interface AuthContextType {
    user: User | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    login: (email: string, passcode: string) => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadUser();
    }, []);

    const loadUser = async () => {
        try {
            const storedUser = await getUser();
            setUser(storedUser);
        } finally {
            setIsLoading(false);
        }
    };

    const login = async (email: string, passcode: string) => {
        const response = await authLogin({ email, passcode });
        if (response.success) {
            setUser(response.data.user);
        }
    };

    const logout = async () => {
        await authLogout();
        setUser(null);
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                isLoading,
                isAuthenticated: !!user,
                login,
                logout,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within AuthProvider");
    }
    return context;
};
