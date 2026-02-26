import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Container, Row, Col } from 'react-bootstrap';
import Navbar from '../../components/Navbar';
import { getDashboardStats } from '../../api/dashboardApi';
import { getAssessmentDetail } from '../../api/assessmentApi';
import { getInterviewDetail } from '../../api/interviewApi';
import HistoryModal from '../../components/HistoryModal';
import { uploadResume } from '../../api/resumeApi';
import { toast, loader, closeLoader, alert as swalAlert } from '../../utils/swal';

export default function DashboardPage() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [uploadLoading, setUploadLoading] = useState(false);
    const fileInputRef = useRef(null);

    const [modalShow, setModalShow] = useState(false);
    const [modalType, setModalType] = useState('assessment');
    const [modalData, setModalData] = useState(null);

    const fetchStats = async () => {
        try {
            setLoading(true);
            const stats = await getDashboardStats();
            setData(stats);
        } catch {
            swalAlert('error', 'Failed to Load', 'Could not load dashboard data. Please refresh the page.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchStats(); }, []);

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.type !== 'application/pdf') {
            toast('error', 'Please upload a PDF file only', 4000);
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            toast('error', 'File too large. Maximum size is 10MB', 4000);
            return;
        }

        setUploadLoading(true);
        loader('Uploading & analyzing your resume...');
        try {
            const res = await uploadResume(file);
            closeLoader();
            toast('success', `Resume uploaded! ${res.skills.length} skills found 🎉`, 4000);
            fetchStats();
        } catch (err) {
            closeLoader();
            toast('error', err.response?.data?.detail || 'Upload failed. Please try again.', 4000);
        } finally {
            setUploadLoading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const openHistoryDetail = async (id, type) => {
        loader('Fetching history details...');
        try {
            if (type === 'assessment') {
                const detail = await getAssessmentDetail(id);
                setModalData(detail);
                setModalType('assessment');
            } else {
                const detail = await getInterviewDetail(id);
                setModalData(detail);
                setModalType('interview');
            }
            closeLoader();
            setModalShow(true);
        } catch (err) {
            closeLoader();
            console.error("Failed to fetch detailed data:", err);
            toast('error', 'Failed to load detailed history.');
        }
    };

    if (loading && !data) {
        return (
            <div className="app-bg" style={{ minHeight: '100vh' }}>
                <Navbar />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: '1rem' }}>
                    <div className="spinner-border" style={{ color: '#6366f1', width: '3rem', height: '3rem' }} />
                    <p style={{ color: '#64748b' }}>Loading your dashboard...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="app-bg" style={{ minHeight: '100vh' }}>
            <Navbar />
            <Container className="pb-5">

                {data && (
                    <>
                        {/* Welcome header */}
                        <div className="fade-in" style={{ marginBottom: '2rem' }}>
                            <h2 style={{ fontWeight: 800, fontSize: '1.8rem' }}>
                                Welcome back, <span className="text-gradient">{data.user.full_name}</span>! 👋
                            </h2>
                            <p style={{ color: '#64748b' }}>Here's your performance overview</p>
                        </div>

                        {/* Stat cards */}
                        <Row className="g-3 mb-4">
                            <Col md={4} className="fade-in">
                                <div className="stat-card">
                                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📄</div>
                                    <div className="stat-number">{data.resume.skill_count || '—'}</div>
                                    <div style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '0.25rem' }}>Skills Extracted</div>
                                </div>
                            </Col>
                            <Col md={4} className="fade-in-delay-1">
                                <div className="stat-card green">
                                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🧠</div>
                                    <div className="stat-number" style={{ background: 'linear-gradient(135deg, #fff, #6ee7b7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                                        {data.assessments.average_score || '—'}{data.assessments.average_score ? '/10' : ''}
                                    </div>
                                    <div style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '0.25rem' }}>Avg Assessment Score</div>
                                </div>
                            </Col>
                            <Col md={4} className="fade-in-delay-2">
                                <div className="stat-card blue">
                                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🎤</div>
                                    <div className="stat-number" style={{ background: 'linear-gradient(135deg, #fff, #7dd3fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                                        {data.interviews.average_score || '—'}{data.interviews.average_score ? '/10' : ''}
                                    </div>
                                    <div style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '0.25rem' }}>Avg Interview Score</div>
                                </div>
                            </Col>
                        </Row>

                        <Row className="g-4 mb-4">
                            {/* Resume section */}
                            <Col md={6}>
                                <div className="card p-4 h-100">
                                    <h5 style={{ fontWeight: 700, marginBottom: '1.25rem' }}>📄 Resume</h5>

                                    <div className="upload-zone" onClick={() => fileInputRef.current.click()}>
                                        {uploadLoading
                                            ? <><div className="spinner-border spinner-border-sm" style={{ color: '#6366f1' }} /><p style={{ marginTop: '0.5rem', color: '#64748b' }}>Uploading...</p></>
                                            : <>
                                                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📁</div>
                                                <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
                                                    {data.resume.uploaded ? 'Click to re-upload your resume' : 'Click to upload your resume'}
                                                </p>
                                                <small style={{ color: '#64748b' }}>PDF only · Max 10MB</small>
                                            </>
                                        }
                                    </div>
                                    <input type="file" ref={fileInputRef} style={{ display: 'none' }}
                                        accept=".pdf" onChange={handleFileChange} />

                                    <h6 style={{ marginTop: '1.25rem', marginBottom: '0.75rem', color: '#94a3b8', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Extracted Skills
                                    </h6>
                                    <div>
                                        {data.resume.skills && data.resume.skills.length > 0
                                            ? data.resume.skills.map((skill, i) => (
                                                <span key={i} className="skill-badge">{skill}</span>
                                            ))
                                            : <p style={{ color: '#475569', fontSize: '0.9rem' }}>Upload your resume to extract skills automatically.</p>
                                        }
                                    </div>

                                    <h6 style={{ marginTop: '1.25rem', marginBottom: '0.75rem', color: '#94a3b8', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Experience
                                    </h6>
                                    <div>
                                        {data.resume.experience && data.resume.experience.length > 0
                                            ? <ul style={{ paddingLeft: '1.2rem', color: '#cbd5e1', fontSize: '0.9rem', marginBottom: 0 }}>
                                                {data.resume.experience.map((exp, i) => (
                                                    <li key={i} style={{ marginBottom: '0.4rem' }}>{exp}</li>
                                                ))}
                                            </ul>
                                            : <p style={{ color: '#475569', fontSize: '0.9rem' }}>No experience extracted.</p>
                                        }
                                    </div>

                                    <h6 style={{ marginTop: '1.25rem', marginBottom: '0.75rem', color: '#94a3b8', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Education
                                    </h6>
                                    <div>
                                        {data.resume.education && data.resume.education.length > 0
                                            ? <ul style={{ paddingLeft: '1.2rem', color: '#cbd5e1', fontSize: '0.9rem', marginBottom: 0 }}>
                                                {data.resume.education.map((edu, i) => (
                                                    <li key={i} style={{ marginBottom: '0.4rem' }}>{edu}</li>
                                                ))}
                                            </ul>
                                            : <p style={{ color: '#475569', fontSize: '0.9rem' }}>No education extracted.</p>
                                        }
                                    </div>
                                </div>
                            </Col>

                            {/* Recent activity */}
                            <Col md={6}>
                                <div className="card p-4 h-100">
                                    <h5 style={{ fontWeight: 700, marginBottom: '1.25rem' }}>📊 Recent Activity</h5>

                                    <h6 style={{ color: '#94a3b8', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                                        Assessment History
                                    </h6>
                                    {data.assessments.history.length > 0 ? (
                                        <div style={{ marginBottom: '1.5rem' }}>
                                            {data.assessments.history.slice(0, 5).map((a, i) => (
                                                <div key={i} className="history-item-hover"
                                                    onClick={() => openHistoryDetail(a.id, 'assessment')}
                                                    style={{
                                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                        padding: '0.6rem 0', borderBottom: '1px solid #1e293b', cursor: 'pointer'
                                                    }}>
                                                    <span style={{ color: '#cbd5e1' }}>{a.skill}</span>
                                                    <span style={{
                                                        color: a.score >= 7 ? '#10b981' : a.score >= 4 ? '#f59e0b' : '#ef4444',
                                                        fontWeight: 700
                                                    }}>{a.score}/10</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p style={{ color: '#475569', fontSize: '0.85rem', marginBottom: '1.5rem' }}>No assessments yet.</p>
                                    )}

                                    <h6 style={{ color: '#94a3b8', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                                        Interview History
                                    </h6>
                                    {data.interviews.history.length > 0 ? (
                                        data.interviews.history.slice(0, 5).map((item, i) => (
                                            <div key={i} className="history-item-hover"
                                                onClick={() => openHistoryDetail(item.id, 'interview')}
                                                style={{
                                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                    padding: '0.6rem 0', borderBottom: '1px solid #1e293b', cursor: 'pointer'
                                                }}>
                                                <span style={{ color: '#cbd5e1' }}>{new Date(item.conducted_at).toLocaleDateString()}</span>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                    {item.video_url && (
                                                        <span style={{ fontSize: '0.75rem', color: '#38bdf8', padding: '2px 8px', borderRadius: '12px', border: '1px solid rgba(56,189,248,0.3)' }}>
                                                            🎞️ View Replay
                                                        </span>
                                                    )}
                                                    <span style={{
                                                        color: item.overall_score >= 7 ? '#10b981' : item.overall_score >= 4 ? '#f59e0b' : '#ef4444',
                                                        fontWeight: 700
                                                    }}>{item.overall_score}/10</span>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <p style={{ color: '#475569', fontSize: '0.85rem' }}>No interviews yet.</p>
                                    )}
                                </div>
                            </Col>
                        </Row>

                        {/* Action CTAs */}
                        <Row className="g-3">
                            <Col md={6}>
                                <Link to="/assessment" className="action-card">
                                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🧠</div>
                                    <h5 style={{ fontWeight: 700, marginBottom: '0.25rem' }}>Skill Assessment</h5>
                                    <p style={{ color: '#64748b', marginBottom: 0, fontSize: '0.9rem' }}>
                                        Test your knowledge with AI-generated MCQs
                                    </p>
                                </Link>
                            </Col>
                            <Col md={6}>
                                <Link to="/interview" className="action-card">
                                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🎤</div>
                                    <h5 style={{ fontWeight: 700, marginBottom: '0.25rem' }}>Mock Interview</h5>
                                    <p style={{ color: '#64748b', marginBottom: 0, fontSize: '0.9rem' }}>
                                        AI-powered interview based on your resume
                                    </p>
                                </Link>
                            </Col>
                        </Row>
                    </>
                )}
            </Container>
            {/* History Details Modal */}
            <HistoryModal
                show={modalShow}
                onHide={() => setModalShow(false)}
                type={modalType}
                data={modalData}
            />

        </div>
    );
}
