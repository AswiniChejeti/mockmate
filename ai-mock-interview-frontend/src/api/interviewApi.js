import api from './axios';

export const startInterview = async () => {
    const response = await api.post('/interview/start');
    return response.data;
};

export const submitInterview = async (session_id, answers) => {
    const response = await api.post('/interview/submit', { session_id, answers });
    return response.data;
};
