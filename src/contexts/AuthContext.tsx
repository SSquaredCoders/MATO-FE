import React, { createContext, useState, useEffect } from 'react';

interface User {
    id: number;  // Long 타입을 number로 매핑
    userId: string;
    nickname: string;
    role: string;
}

interface AuthContextType {
    user: User | null;
    accessToken: string | null;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [accessToken, setAccessToken] = useState<string | null>(null);

    useEffect(() => {
        // 로컬 스토리지에서 토큰과 사용자 정보 불러오기
        const storedToken = localStorage.getItem('accessToken');
        const storedUser = localStorage.getItem('user');
        
        if (storedToken && storedUser) {
            setAccessToken(storedToken);
            setUser(JSON.parse(storedUser));
        }
    }, []);

    return (
        <AuthContext.Provider value={{ user, accessToken }}>
            {children}
        </AuthContext.Provider>
    );
}; 