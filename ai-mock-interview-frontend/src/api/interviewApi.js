import api from './axios';

export const startInterview = async (options = {}) => {
    const response = await api.post('/interview/start', options);
    return response.data;
};

export const verifyFace = async (face_image) => {
    const response = await api.post('/interview/verify-face', { face_image });
    return response.data;
};

export const submitInterview = async (session_id, answers) => {
    const response = await api.post('/interview/submit', { session_id, answers });
    return response.data;
};

export const uploadVideo = async (session_id, videoBlob) => {
    const formData = new FormData();
    formData.append('video', videoBlob, 'interview.webm');
    const response = await api.post(`/interview/${session_id}/video`, formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });
    return response.data;
};

export const getInterviewDetail = async (id) => {
    const response = await api.get(`/interview/${id}`);
    return response.data;
};
