import React, {
    createContext,
    useContext,
    useEffect,
    useRef,
    useState,
} from "react";
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
    login: (email: string, passcode: string) => Promise<User>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const hasLoggedIn = useRef(false);

    useEffect(() => {
        loadUser();
    }, []);

    const loadUser = async () => {
        try {
            const storedUser = await getUser();
            // Don't overwrite user if a login() call already set it
            if (!hasLoggedIn.current) {
                setUser(storedUser);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const login = async (email: string, passcode: string): Promise<User> => {
        const response = await authLogin({ email, passcode });
        if (response.success) {
            hasLoggedIn.current = true;
            setUser(response.data.user);
            return response.data.user;
        }
        throw new Error(response.message || "Login failed");
    };

    const logout = async () => {
        try {
            await authLogout();
        } finally {
            hasLoggedIn.current = false;
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
