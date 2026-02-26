import api from './axios';

export const login = async (email, password) => {
    try {
        const response = await api.post('/auth/login', { email, password });
        return response.data;
    } catch (err) {
        // Re-throw with clean message from backend
        const detail = err.response?.data?.detail;
        const error = new Error(detail || 'Login failed. Please try again.');
        error.status = err.response?.status;
        throw error;
    }
};

export const register = async (full_name, email, password, face_image = null) => {
    try {
        const response = await api.post('/auth/register', { full_name, email, password, face_image });
        return response.data;
    } catch (err) {
        const detail = err.response?.data?.detail;
        const error = new Error(detail || 'Registration failed. Please try again.');
        error.status = err.response?.status;
        throw error;
    }
};

export const resetPassword = async (email, newPassword) => {
    try {
        const response = await api.post('/auth/reset-password', { email, new_password: newPassword });
        return response.data;
    } catch (err) {
        const detail = err.response?.data?.detail;
        const error = new Error(detail || 'Password reset failed.');
        error.status = err.response?.status;
        throw error;
    }
};
