import { useState, useEffect } from 'react';
import { Container, Card, Form, Button, Alert, Badge, ProgressBar } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import { getResumeSkills, generateAssessment, submitAssessment } from '../../api/assessmentApi';

export default function AssessmentPage() {
    const [step, setStep] = useState(1); // 1: Setup, 2: Test, 3: Results

    // Setup State
    const [skills, setSkills] = useState([]);
    const [selectedSkill, setSelectedSkill] = useState('');
    const [numQuestions, setNumQuestions] = useState(10);
    const [level, setLevel] = useState('Medium');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Test State
    const [assessmentId, setAssessmentId] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [answers, setAnswers] = useState({});
    const [testSkill, setTestSkill] = useState('');
    const [testLevel, setTestLevel] = useState('');

    // Result State
    const [result, setResult] = useState(null);

    useEffect(() => {
        const fetchSkills = async () => {
            try {
                const data = await getResumeSkills();
                setSkills(data.skills || []);
                if (data.skills && data.skills.length > 0) {
                    setSelectedSkill(data.skills[0]);
                }
            } catch (err) {
                // Fallback or just empty
            }
        };
        fetchSkills();
    }, []);

    const handleGenerate = async () => {
        if (!selectedSkill) {
            setError('Please select a skill');
            return;
        }
        setLoading(true);
        setError('');
        try {
            const data = await generateAssessment(selectedSkill, numQuestions, level);
            setAssessmentId(data.assessment_id);
            setQuestions(data.questions);
            setTestSkill(data.skill);
            setTestLevel(data.level);
            setAnswers({});
            setStep(2);
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to generate assessment');
        } finally {
            setLoading(false);
        }
    };

    const handleAnswerChange = (qIndex, answerValue) => {
        setAnswers({ ...answers, [qIndex]: answerValue });
    };

    const answeredCount = Object.keys(answers).length;
    const progress = questions.length > 0 ? Math.round((answeredCount / questions.length) * 100) : 0;

    const handleSubmit = async () => {
        if (answeredCount < questions.length) {
            setError(`Please answer all questions. You have answered ${answeredCount} of ${questions.length}.`);
            return;
        }
        setLoading(true);
        setError('');

        const formattedAnswers = questions.map((_, i) => ({
            question_index: i,
            selected_answer: answers[i] || ''
        }));

        try {
            const data = await submitAssessment(assessmentId, formattedAnswers);
            setResult(data);
            setStep(3);
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to submit assessment');
        } finally {
            setLoading(false);
        }
    };

    const resetAssessment = () => {
        setStep(1);
        setResult(null);
        setAssessmentId(null);
        setQuestions([]);
        setAnswers({});
        setTestSkill('');
        setTestLevel('');
        setError('');
    };

    const getLevelBadgeColor = (lvl) => {
        if (lvl === 'Easy') return 'success';
        if (lvl === 'Medium') return 'warning';
        if (lvl === 'Hard') return 'danger';
        return 'secondary';
    };

    const getScoreColor = (score) => {
        if (score >= 7) return 'text-success';
        if (score >= 4) return 'text-warning';
        return 'text-danger';
    };

    const getScoreEmoji = (score) => {
        if (score >= 9) return '🏆';
        if (score >= 7) return '🎉';
        if (score >= 4) return '👍';
        return '📚';
    };

    return (
        <>
            <Navbar />
            <Container className="py-4">
                <div className="mb-4">
                    <h2>🧠 Skill Assessment</h2>
                    <p className="text-muted">Test your knowledge with AI-generated questions</p>
                </div>

                {error && <Alert variant="danger" dismissible onClose={() => setError('')}>{error}</Alert>}

                {/* Step 1: Setup */}
                {step === 1 && (
                    <Card className="shadow-sm border-0">
                        <Card.Body className="p-4">
                            <h4 className="mb-4">⚙️ Configure Your Test</h4>

                            <div className="row g-3 mb-4">
                                <div className="col-md-4">
                                    <Form.Group>
                                        <Form.Label><strong>Select Skill</strong></Form.Label>
                                        <Form.Select
                                            value={selectedSkill}
                                            onChange={(e) => setSelectedSkill(e.target.value)}
                                        >
                                            <option value="">-- Select a skill --</option>
                                            {skills.map((s, idx) => (
                                                <option key={idx} value={s}>{s}</option>
                                            ))}
                                        </Form.Select>
                                    </Form.Group>
                                </div>

                                <div className="col-md-4">
                                    <Form.Group>
                                        <Form.Label><strong>Number of Questions</strong></Form.Label>
                                        <Form.Select
                                            value={numQuestions}
                                            onChange={(e) => setNumQuestions(Number(e.target.value))}
                                        >
                                            <option value={5}>5 Questions</option>
                                            <option value={10}>10 Questions</option>
                                            <option value={15}>15 Questions</option>
                                            <option value={20}>20 Questions</option>
                                        </Form.Select>
                                    </Form.Group>
                                </div>

                                <div className="col-md-4">
                                    <Form.Group>
                                        <Form.Label><strong>Difficulty Level</strong></Form.Label>
                                        <Form.Select
                                            value={level}
                                            onChange={(e) => setLevel(e.target.value)}
                                        >
                                            <option value="Easy">🟢 Easy — Basic concepts</option>
                                            <option value="Medium">🟡 Medium — Applied knowledge</option>
                                            <option value="Hard">🔴 Hard — Advanced topics</option>
                                        </Form.Select>
                                    </Form.Group>
                                </div>
                            </div>

                            {selectedSkill && (
                                <Alert variant="info" className="py-2">
                                    You will be tested on <strong>{selectedSkill}</strong> with{' '}
                                    <strong>{numQuestions} questions</strong> at{' '}
                                    <strong>{level}</strong> difficulty.
                                </Alert>
                            )}

                            <Button
                                variant="primary"
                                size="lg"
                                onClick={handleGenerate}
                                disabled={loading || !selectedSkill}
                            >
                                {loading ? '⏳ Generating questions...' : '⚡ Generate Test'}
                            </Button>
                        </Card.Body>
                    </Card>
                )}

                {/* Step 2: Test */}
                {step === 2 && (
                    <div className="test-section">
                        {/* Header */}
                        <div className="d-flex justify-content-between align-items-center mb-3">
                            <div>
                                <h4 className="mb-1">📝 {testSkill} Assessment</h4>
                                <div className="d-flex gap-2">
                                    <Badge bg={getLevelBadgeColor(testLevel)}>{testLevel}</Badge>
                                    <Badge bg="secondary">{questions.length} Questions</Badge>
                                </div>
                            </div>
                            <div className="text-end">
                                <small className="text-muted d-block">
                                    Answered {answeredCount} / {questions.length}
                                </small>
                            </div>
                        </div>

                        {/* Progress Bar */}
                        <ProgressBar
                            now={progress}
                            label={`${progress}%`}
                            variant={progress === 100 ? 'success' : 'primary'}
                            className="mb-4"
                            style={{ height: '8px' }}
                        />

                        {/* Questions */}
                        {questions.map((q, qIndex) => (
                            <Card key={qIndex} className={`shadow-sm border-0 mb-4 ${answers[qIndex] ? 'border-start border-success border-3' : ''}`}>
                                <Card.Body>
                                    <div className="d-flex align-items-start gap-2">
                                        <Badge bg={answers[qIndex] ? 'success' : 'secondary'} className="mt-1">
                                            Q{qIndex + 1}
                                        </Badge>
                                        <h6 className="mb-3">{q.question}</h6>
                                    </div>
                                    <div className="mt-2 ps-4">
                                        {q.options.map((opt, oIndex) => (
                                            <Form.Check
                                                key={oIndex}
                                                type="radio"
                                                id={`q${qIndex}-opt${oIndex}`}
                                                name={`question-${qIndex}`}
                                                label={<span><strong>{opt.key}.</strong> {opt.value}</span>}
                                                value={opt.key}
                                                checked={answers[qIndex] === opt.key}
                                                onChange={(e) => handleAnswerChange(qIndex, e.target.value)}
                                                className="mb-2"
                                            />
                                        ))}
                                    </div>
                                </Card.Body>
                            </Card>
                        ))}

                        {/* Submit */}
                        <div className="d-flex gap-3 mt-3 mb-5">
                            <Button
                                variant="success"
                                size="lg"
                                onClick={handleSubmit}
                                disabled={loading}
                            >
                                {loading ? '⏳ Evaluating...' : `✅ Submit Answers (${answeredCount}/${questions.length})`}
                            </Button>
                            <Button variant="outline-secondary" size="lg" onClick={resetAssessment}>
                                ← Start Over
                            </Button>
                        </div>
                    </div>
                )}

                {/* Step 3: Result */}
                {step === 3 && result && (
                    <Card className="shadow-sm border-0 text-center py-5">
                        <Card.Body>
                            <div className="display-1 mb-3">{getScoreEmoji(result.score)}</div>
                            <h1 className={getScoreColor(result.score)}>
                                {result.score}/10
                            </h1>

                            <div className="d-flex justify-content-center gap-2 mt-2 mb-3">
                                <Badge bg={getLevelBadgeColor(testLevel)} className="fs-6">{testLevel}</Badge>
                                <Badge bg="secondary" className="fs-6">{result.skill}</Badge>
                            </div>

                            <p className="fs-5 text-muted">
                                You answered <strong>{result.correct_count}</strong> out of{' '}
                                <strong>{result.total_questions}</strong> questions correctly.
                            </p>

                            <div className="my-4 mx-auto" style={{ maxWidth: '400px' }}>
                                <ProgressBar
                                    now={(result.correct_count / result.total_questions) * 100}
                                    variant={result.score >= 7 ? 'success' : result.score >= 4 ? 'warning' : 'danger'}
                                    style={{ height: '20px', borderRadius: '10px' }}
                                    label={`${result.correct_count}/${result.total_questions} correct`}
                                />
                            </div>

                            <p className="text-muted fst-italic">
                                {result.score >= 9 && "Outstanding! You're an expert! 🌟"}
                                {result.score >= 7 && result.score < 9 && "Great job! Keep up the good work! 💪"}
                                {result.score >= 4 && result.score < 7 && "Good effort! More practice will help. 📖"}
                                {result.score < 4 && "Keep studying! Review the fundamentals. 📚"}
                            </p>

                            <div className="mt-4 d-flex justify-content-center gap-3">
                                <Button variant="primary" onClick={resetAssessment}>🔁 Take Another Test</Button>
                                <Button variant="outline-secondary" as={Link} to="/dashboard">← Dashboard</Button>
                            </div>
                        </Card.Body>
                    </Card>
                )}
            </Container>
        </>
    );
}
