import { createContext, useContext, useState } from 'react';
import { saveToken, getToken, removeToken } from '../utils/tokenStorage';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [token, setToken] = useState(() => getToken());

    const loginUser = (access_token) => {
        saveToken(access_token);
        setToken(access_token);
    };

    const logoutUser = () => {
        removeToken();
        setToken(null);
    };

    return (
        <AuthContext.Provider value={{ token, loginUser, logoutUser, isLoggedIn: !!token }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
