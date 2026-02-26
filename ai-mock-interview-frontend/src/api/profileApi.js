import api from './axios';

export const getProfile = async () => {
    const response = await api.get('/profile');
    return response.data;
};

export const updateProfile = async (data) => {
    const response = await api.put('/profile', data);
    return response.data;
};
