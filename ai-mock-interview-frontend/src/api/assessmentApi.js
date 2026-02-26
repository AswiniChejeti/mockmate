import api from './axios';

export const getResumeSkills = async () => {
    const response = await api.get('/resume/skills');
    return response.data;
};

export const generateAssessment = async (skill, num_questions, level = 'Medium') => {
    const response = await api.post('/assessment/generate', { skill, num_questions, level });
    return response.data;
};

export const submitAssessment = async (assessment_id, answers) => {
    const response = await api.post('/assessment/submit', { assessment_id, answers });
    return response.data;
};

export const getAssessmentDetail = async (id) => {
    const response = await api.get(`/assessment/${id}`);
    return response.data;
};
