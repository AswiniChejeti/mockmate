import { useState, useEffect, useRef } from 'react';
import { Container, Row, Col, Card, Badge, Alert, Spinner, Button, ListGroup } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import { getDashboardStats } from '../../api/dashboardApi';
import { uploadResume } from '../../api/resumeApi';

export default function DashboardPage() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [uploadLoading, setUploadLoading] = useState(false);
    const [uploadMsg, setUploadMsg] = useState({ type: '', text: '' });
    const fileInputRef = useRef(null);

    const fetchStats = async () => {
        try {
            setLoading(true);
            const stats = await getDashboardStats();
            setData(stats);
            setError('');
        } catch (err) {
            setError('Failed to load dashboard data. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
    }, []);

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.type !== 'application/pdf') {
            setUploadMsg({ type: 'danger', text: 'Please upload a valid PDF file.' });
            return;
        }

        try {
            setUploadLoading(true);
            setUploadMsg({ type: '', text: '' });
            const res = await uploadResume(file);
            setUploadMsg({ type: 'success', text: `Resume uploaded! ${res.skills.length} skills found.` });
            // Refresh stats
            fetchStats();
        } catch (err) {
            setUploadMsg({ type: 'danger', text: err.response?.data?.detail || 'Upload failed' });
        } finally {
            setUploadLoading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    if (loading && !data) {
        return (
            <>
                <Navbar />
                <Container className="text-center mt-5">
                    <Spinner animation="border" />
                    <p className="mt-2">Loading dashboard...</p>
                </Container>
            </>
        );
    }

    return (
        <>
            <Navbar />
            <Container>
                {error && <Alert variant="danger">{error}</Alert>}

                {data && (
                    <>
                        <div className="mb-4">
                            <h2>Welcome back, {data.user.full_name}! 👋</h2>
                            <p className="text-muted">Here's your performance overview</p>
                        </div>

                        <Row className="mb-4 g-3">
                            <Col md={4}>
                                <Card className="shadow-sm border-0 h-100">
                                    <Card.Body className="text-center">
                                        <div className="fs-1 mb-2">📄</div>
                                        <h6 className="text-muted mb-2">Skills Extracted</h6>
                                        <h3 className="mb-0">{data.resume.skill_count || '—'}</h3>
                                    </Card.Body>
                                </Card>
                            </Col>
                            <Col md={4}>
                                <Card className="shadow-sm border-0 h-100">
                                    <Card.Body className="text-center">
                                        <div className="fs-1 mb-2">🧠</div>
                                        <h6 className="text-muted mb-2">Avg Assessment Score</h6>
                                        <h3 className="mb-0 text-success">{data.assessments.average_score || '—'}/10</h3>
                                    </Card.Body>
                                </Card>
                            </Col>
                            <Col md={4}>
                                <Card className="shadow-sm border-0 h-100">
                                    <Card.Body className="text-center">
                                        <div className="fs-1 mb-2">🎤</div>
                                        <h6 className="text-muted mb-2">Avg Interview Score</h6>
                                        <h3 className="mb-0 text-primary">{data.interviews.average_score || '—'}/10</h3>
                                    </Card.Body>
                                </Card>
                            </Col>
                        </Row>

                        <Row className="g-4 mb-4">
                            <Col md={6}>
                                <Card className="shadow-sm border-0 h-100">
                                    <Card.Body>
                                        <h5 className="mb-4">📄 Resume</h5>

                                        <div
                                            className="border border-2 border-dashed rounded p-4 text-center cursor-pointer bg-light mb-3"
                                            style={{ cursor: 'pointer' }}
                                            onClick={() => fileInputRef.current.click()}
                                        >
                                            <div className="fs-2 mb-2">📁</div>
                                            <p className="fw-bold mb-1">Click to upload your resume</p>
                                            <small className="text-muted">PDF files only</small>
                                        </div>
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            style={{ display: 'none' }}
                                            accept=".pdf"
                                            onChange={handleFileChange}
                                        />

                                        {uploadLoading && (
                                            <div className="text-center my-3">
                                                <Spinner animation="border" size="sm" /> <span>Uploading...</span>
                                            </div>
                                        )}

                                        {uploadMsg.text && (
                                            <Alert variant={uploadMsg.type} className="py-2">
                                                {uploadMsg.text}
                                            </Alert>
                                        )}

                                        <h6 className="mt-4 mb-3">Extracted Skills</h6>
                                        <div>
                                            {data.resume.skills.length > 0 ? (
                                                data.resume.skills.map((skill, idx) => (
                                                    <Badge bg="secondary" className="me-2 mb-2 p-2" key={idx}>
                                                        {skill}
                                                    </Badge>
                                                ))
                                            ) : (
                                                <p className="text-muted small">Upload your resume to see skills.</p>
                                            )}
                                        </div>
                                    </Card.Body>
                                </Card>
                            </Col>

                            <Col md={6}>
                                <Card className="shadow-sm border-0 h-100">
                                    <Card.Body>
                                        <h5 className="mb-4">📊 Recent Activity</h5>

                                        <h6 className="mb-3">Assessment History</h6>
                                        {data.assessments.history.length > 0 ? (
                                            <ListGroup variant="flush" className="mb-4">
                                                {data.assessments.history.slice(0, 5).map((a, i) => (
                                                    <ListGroup.Item key={i} className="d-flex justify-content-between px-0">
                                                        <span>{a.skill}</span>
                                                        <strong className="text-success">{a.score}/10</strong>
                                                    </ListGroup.Item>
                                                ))}
                                            </ListGroup>
                                        ) : (
                                            <p className="text-muted small mb-4">No assessments yet.</p>
                                        )}

                                        <h6 className="mb-3">Interview History</h6>
                                        {data.interviews.history.length > 0 ? (
                                            <ListGroup variant="flush">
                                                {data.interviews.history.slice(0, 5).map((i, idx) => (
                                                    <ListGroup.Item key={idx} className="d-flex justify-content-between px-0">
                                                        <span>{new Date(i.conducted_at).toLocaleDateString()}</span>
                                                        <strong className="text-primary">{i.overall_score}/10</strong>
                                                    </ListGroup.Item>
                                                ))}
                                            </ListGroup>
                                        ) : (
                                            <p className="text-muted small">No interviews yet.</p>
                                        )}
                                    </Card.Body>
                                </Card>
                            </Col>
                        </Row>

                        <div className="d-flex gap-3 flex-wrap">
                            <Button as={Link} to="/assessment" variant="primary">🧠 Take Skill Assessment</Button>
                            <Button as={Link} to="/interview" variant="success">🎤 Start Mock Interview</Button>
                        </div>
                    </>
                )}
            </Container>
        </>
    );
}
