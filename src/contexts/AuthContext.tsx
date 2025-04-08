import React, { createContext, useState, useEffect, useContext } from 'react';

interface User {
    id: number;  // Long 타입을 number로 매핑
    userId: string;
    nickname: string;
    role: string;
}

interface AuthContextType {
    user: User | null;
    accessToken: string | null;
    login: (user: User, token: string) => void;
    logout: () => void;
}

export const AuthContext = createContext<AuthContextType | null>(null);

// useAuth 훅 추가
export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth는 AuthProvider 내부에서 사용해야 합니다");
    }
    return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [accessToken, setAccessToken] = useState<string | null>(null);

    useEffect(() => {
        // 로컬 스토리지에서 토큰과 사용자 정보 불러오기
        const storedToken = localStorage.getItem('accessToken');
        const storedUser = localStorage.getItem('user');
        
        if (storedToken && storedUser) {
            try {
                setAccessToken(storedToken);
                setUser(JSON.parse(storedUser));
            } catch (error) {
                console.error("사용자 정보 파싱 중 오류 발생:", error);
                localStorage.removeItem('accessToken');
                localStorage.removeItem('user');
            }
        }
    }, []);

    const login = (user: User, token: string) => {
        localStorage.setItem('accessToken', token);
        localStorage.setItem('user', JSON.stringify(user));
        setUser(user);
        setAccessToken(token);
    };

    const logout = () => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('user');
        setUser(null);
        setAccessToken(null);
    };

    return (
        <AuthContext.Provider value={{ user, accessToken, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}; 