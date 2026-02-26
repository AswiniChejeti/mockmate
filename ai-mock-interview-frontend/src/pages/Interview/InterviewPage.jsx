import { useState } from 'react';
import { Container, Card, Form, Button, Alert, ProgressBar, Badge } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import { startInterview, submitInterview } from '../../api/interviewApi';

export default function InterviewPage() {
    const [step, setStep] = useState(1); // 1: Setup, 2: Interview, 3: Results

    // Setup State
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Interview State
    const [sessionId, setSessionId] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [answers, setAnswers] = useState({});

    // Result State
    const [result, setResult] = useState(null);

    const handleStart = async () => {
        setLoading(true);
        setError('');
        try {
            const data = await startInterview();
            setSessionId(data.session_id);
            setQuestions(data.questions);
            setAnswers({});
            setStep(2);
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to start interview. Ensure you have uploaded a resume.');
        } finally {
            setLoading(false);
        }
    };

    const handleAnswerChange = (qIndex, value) => {
        setAnswers({ ...answers, [qIndex]: value });
    };

    const getProgress = () => {
        if (questions.length === 0) return 0;
        const answeredCount = Object.keys(answers).filter(k => answers[k].trim() !== '').length;
        return (answeredCount / questions.length) * 100;
    };

    const handleSubmit = async () => {
        const answeredCount = Object.keys(answers).filter(k => answers[k].trim() !== '').length;
        if (answeredCount < questions.length) {
            if (!window.confirm(`You have ${questions.length - answeredCount} unanswered question(s). Submit anyway?`)) {
                return;
            }
        }

        setLoading(true);
        setError('');

        const formattedAnswers = questions.map((q) => ({
            question_index: q.index,
            answer: answers[q.index] || ''
        }));

        try {
            const data = await submitInterview(sessionId, formattedAnswers);
            setResult(data);
            setStep(3);
        } catch (err) {
            document.documentElement.scrollTop = 0;
            setError(err.response?.data?.detail || 'Failed to evaluate interview answers');
        } finally {
            setLoading(false);
        }
    };

    const resetInterview = () => {
        setStep(1);
        setResult(null);
        setSessionId(null);
        setQuestions([]);
        setAnswers({});
    };

    return (
        <>
            <Navbar />
            <Container>
                <div className="mb-4">
                    <h2>🎤 AI Mock Interview</h2>
                    <p className="text-muted">Answer resume-based questions and get instant AI feedback</p>
                </div>

                {error && <Alert variant="danger">{error}</Alert>}

                {/* Step 1: Setup */}
                {step === 1 && (
                    <Card className="shadow-sm border-0 text-center py-5">
                        <Card.Body>
                            <div className="display-1 mb-3">🤖</div>
                            <h3 className="mb-3">Ready for your Interview?</h3>
                            <p className="text-muted mb-4 mx-auto" style={{ maxWidth: '600px' }}>
                                AI will generate personalized questions based on your uploaded resume.
                                Make sure you have uploaded your resume first.
                            </p>

                            <Button
                                variant="primary"
                                size="lg"
                                onClick={handleStart}
                                disabled={loading}
                            >
                                {loading ? '⏳ Generating questions...' : '🚀 Start Interview'}
                            </Button>
                        </Card.Body>
                    </Card>
                )}

                {/* Step 2: Interview */}
                {step === 2 && (
                    <div className="interview-section">
                        <Card className="shadow-sm border-0 mb-4 sticky-top text-bg-light" style={{ top: '20px', zIndex: 1000 }}>
                            <Card.Body className="d-flex justify-content-between align-items-center flex-wrap gap-3">
                                <div className="fw-bold">
                                    Progress <Badge bg="primary" className="ms-2">{Math.round(getProgress())}%</Badge>
                                </div>
                                <div style={{ flex: '1', minWidth: '200px', maxWidth: '400px' }}>
                                    <ProgressBar now={getProgress()} />
                                </div>
                            </Card.Body>
                        </Card>

                        {questions.map((q, i) => (
                            <Card key={q.index} className="shadow-sm border-0 mb-4">
                                <Card.Body>
                                    <h5 className="mb-3">Q{i + 1}. {q.question}</h5>
                                    <Form.Group>
                                        <Form.Control
                                            as="textarea"
                                            rows={5}
                                            placeholder="Type your answer here... Be detailed and specific."
                                            value={answers[q.index] || ''}
                                            onChange={(e) => handleAnswerChange(q.index, e.target.value)}
                                        />
                                    </Form.Group>
                                </Card.Body>
                            </Card>
                        ))}

                        <div className="d-flex gap-3 mb-5 pb-5">
                            <Button
                                variant="success"
                                size="lg"
                                onClick={handleSubmit}
                                disabled={loading}
                            >
                                {loading ? '⏳ AI is evaluating your answers...' : '✅ Submit All Answers'}
                            </Button>
                            <Button variant="outline-secondary" size="lg" onClick={() => setStep(1)}>
                                Cancel
                            </Button>
                        </div>
                    </div>
                )}

                {/* Step 3: Result */}
                {step === 3 && result && (
                    <div className="results-section">
                        <Card className="shadow-sm border-0 text-center py-5 mb-4">
                            <Card.Body>
                                <div className="display-1 mb-3">🎉</div>
                                <h2 className="mb-2">Interview Complete!</h2>
                                <h1 className={result.overall_score >= 7 ? 'text-success display-2 fw-bold' : result.overall_score >= 4 ? 'text-warning display-2 fw-bold' : 'text-danger display-2 fw-bold'}>
                                    {result.overall_score}/10
                                </h1>
                                <p className="text-muted fs-5">Overall Score</p>
                            </Card.Body>
                        </Card>

                        <h3 className="mb-4">📋 Detailed Feedback</h3>

                        {result.feedback.map((f, idx) => (
                            <Card key={idx} className="shadow-sm border-0 mb-4">
                                <Card.Body>
                                    <h5 className="mb-3">Q{f.question_index + 1}. {f.question}</h5>

                                    <div className="border border-light bg-light p-3 rounded mb-3 text-muted fst-italic">
                                        "{f.user_answer || 'No answer provided'}"
                                    </div>

                                    <div className="d-flex align-items-center gap-3 mb-3">
                                        <div className="fs-4 fw-bold">
                                            {f.score}<span className="fs-6 text-muted">/10</span>
                                        </div>
                                        <div className="flex-grow-1">
                                            <ProgressBar
                                                now={f.score * 10}
                                                variant={f.score >= 7 ? 'success' : f.score >= 4 ? 'warning' : 'danger'}
                                            />
                                        </div>
                                    </div>

                                    <div className="bg-primary bg-opacity-10 p-3 rounded">
                                        <strong>💬 Feedback:</strong> {f.feedback}
                                    </div>
                                </Card.Body>
                            </Card>
                        ))}

                        <div className="mt-5 d-flex gap-3 mb-5 pb-5">
                            <Button variant="primary" onClick={resetInterview}>🔁 New Interview</Button>
                            <Button variant="outline-secondary" as={Link} to="/dashboard">← Dashboard</Button>
                        </div>
                    </div>
                )}
            </Container>
        </>
    );
}
