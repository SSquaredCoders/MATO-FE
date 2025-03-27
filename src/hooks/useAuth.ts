import { useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';

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

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}; 