import api from './axios';

export const login = async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
};

export const register = async (full_name, email, password) => {
    const response = await api.post('/auth/register', { full_name, email, password });
    return response.data;
};
