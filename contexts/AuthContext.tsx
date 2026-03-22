import React, {
    createContext,
    useContext,
    useEffect,
    useRef,
    useState,
} from "react";
import { clearStoredAuthState, setUnauthorizedHandler } from "../services/api";
import {
    User,
    login as authLogin,
    logout as authLogout,
    getToken,
    getUser,
} from "../services/auth";

interface AuthContextType {
    user: User | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    login: (email: string, passcode: string) => Promise<User>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const authVersionRef = useRef(0);

    useEffect(() => {
        setUnauthorizedHandler(async () => {
            authVersionRef.current += 1;
            setUser(null);
            setIsLoading(false);
        });

        loadUser();

        return () => {
            setUnauthorizedHandler(null);
        };
    }, []);

    const loadUser = async () => {
        const versionAtStart = authVersionRef.current;
        try {
            const [storedUser, storedToken] = await Promise.all([
                getUser(),
                getToken(),
            ]);

            if (!storedToken) {
                if (storedUser) {
                    await clearStoredAuthState();
                }
                if (authVersionRef.current === versionAtStart) {
                    setUser(null);
                }
                return;
            }

            // Ignore stale hydration results if auth changed while loading.
            if (authVersionRef.current === versionAtStart) {
                setUser(storedUser);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const login = async (email: string, passcode: string): Promise<User> => {
        authVersionRef.current += 1;
        const response = await authLogin({ email, passcode });
        if (response.success) {
            setUser(response.data.user);
            return response.data.user;
        }
        throw new Error(response.message || "Login failed");
    };

    const logout = async () => {
        authVersionRef.current += 1;
        try {
            await authLogout();
        } finally {
            setUser(null);
        }
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
