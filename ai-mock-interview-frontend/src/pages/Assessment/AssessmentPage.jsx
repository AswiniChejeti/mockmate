import { useState, useEffect, useRef, useCallback } from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import { getResumeSkills, generateAssessment, submitAssessment } from '../../api/assessmentApi';
import { verifyFace } from '../../api/interviewApi';
import { toast, loader, closeLoader, confirm } from '../../utils/swal';

const LEVEL_CONFIG = {
    Easy: { color: '#10b981', bg: 'rgba(16,185,129,0.15)', label: '🟢 Easy', desc: 'Basic concepts' },
    Medium: { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', label: '🟡 Medium', desc: 'Applied knowledge' },
    Hard: { color: '#ef4444', bg: 'rgba(239,68,68,0.15)', label: '🔴 Hard', desc: 'Advanced topics' },
};

const scoreColor = s => s >= 7 ? '#10b981' : s >= 4 ? '#f59e0b' : '#ef4444';
const scoreEmoji = s => s >= 9 ? '🏆' : s >= 7 ? '🎉' : s >= 4 ? '👍' : '📚';
const scoreMsg = s => s >= 9 ? "Outstanding! You're an expert! 🌟"
    : s >= 7 ? 'Great job! Keep it up! 💪'
        : s >= 4 ? 'Good effort! More practice will help. 📖'
            : 'Keep studying! Review the fundamentals. 📚';

const fmt = secs => {
    if (secs === null || secs === undefined) return '--:--';
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
};

export default function AssessmentPage() {
    const [step, setStep] = useState(1);

    const [skills, setSkills] = useState([]);
    const [selectedSkill, setSelectedSkill] = useState('');
    const [numQuestions, setNumQuestions] = useState(10);
    const [level, setLevel] = useState('Medium');
    const [loading, setLoading] = useState(false);

    const [assessmentId, setAssessmentId] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [answers, setAnswers] = useState({});
    const [testSkill, setTestSkill] = useState('');
    const [testLevel, setTestLevel] = useState('');

    const [result, setResult] = useState(null);

    // ── Timer state ───────────────────────────────────────────────────────────
    const [timeLeft, setTimeLeft] = useState(null);
    const [totalTime, setTotalTime] = useState(null);
    const timerRef = useRef(null);

    // ── Hidden camera for bg face checks ─────────────────────────────────────
    const hiddenVideoRef = useRef(null);
    const hiddenStreamRef = useRef(null);
    const faceCheckIntervalRef = useRef(null);
    const [faceWarnings, setFaceWarnings] = useState(0);

    useEffect(() => {
        (async () => {
            try {
                const data = await getResumeSkills();
                setSkills(data.skills || []);
                if (data.skills?.length) setSelectedSkill(data.skills[0]);
            } catch {
                toast('warning', 'Upload your resume first to get skill suggestions', 4000);
            }
        })();
        return () => {
            clearInterval(timerRef.current);
            clearInterval(faceCheckIntervalRef.current);
            hiddenStreamRef.current?.getTracks().forEach(t => t.stop());
        };
    }, []);

    // ── Background camera + face detection ───────────────────────────────────
    const startBgCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            hiddenStreamRef.current = stream;
            if (hiddenVideoRef.current) hiddenVideoRef.current.srcObject = stream;
        } catch { /* camera unavailable – face checks will be skipped */ }
    };

    const stopBgCamera = () => {
        clearInterval(faceCheckIntervalRef.current);
        hiddenStreamRef.current?.getTracks().forEach(t => t.stop());
        hiddenStreamRef.current = null;
    };

    const captureFrame = () => {
        const v = hiddenVideoRef.current;
        if (!v || v.videoWidth === 0) return null;
        const c = document.createElement('canvas');
        c.width = v.videoWidth; c.height = v.videoHeight;
        c.getContext('2d').drawImage(v, 0, 0);
        return c.toDataURL('image/jpeg', 0.8);
    };

    const startBgFaceCheck = useCallback((autoSubmitFn) => {
        clearInterval(faceCheckIntervalRef.current);
        faceCheckIntervalRef.current = setInterval(async () => {
            const base64 = captureFrame();
            if (!base64) return;
            try {
                const res = await verifyFace(base64);
                if (!res.verified) {
                    setFaceWarnings(prev => {
                        const next = prev + 1;
                        if (next >= 2) {
                            toast('error', '⚠️ Unauthorized person detected! Assessment auto-submitted.', 5000);
                            clearInterval(faceCheckIntervalRef.current);
                            autoSubmitFn();
                        } else {
                            toast('warning', `⚠️ Face mismatch detected (Warning ${next}/2). Assessment will auto-close if repeated.`, 4000);
                        }
                        return next;
                    });
                }
            } catch { /* silent */ }
        }, 15000);
    }, []);

    // ── Timer ─────────────────────────────────────────────────────────────────
    const startTimer = useCallback((totalSecs, autoSubmitFn) => {
        clearInterval(timerRef.current);
        setTimeLeft(totalSecs);
        setTotalTime(totalSecs);
        timerRef.current = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timerRef.current);
                    toast('warning', "⏰ Time's up! Submitting your assessment now.", 3000);
                    setTimeout(() => autoSubmitFn(), 500);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    }, []);

    // ── Generate ──────────────────────────────────────────────────────────────
    const handleGenerate = async () => {
        if (!selectedSkill) { toast('warning', 'Please select a skill first'); return; }
        loader('⚡ Generating your assessment...');
        setLoading(true);
        try {
            const data = await generateAssessment(selectedSkill, numQuestions, level);
            closeLoader();
            setAssessmentId(data.assessment_id);
            setQuestions(data.questions);
            setTestSkill(data.skill);
            setTestLevel(data.level);
            setAnswers({});
            setFaceWarnings(0);
            setStep(2);
            toast('success', `${data.questions.length} questions ready! Timer starting…`, 2000);

            // Calculate total time from average_time per question
            const total = data.questions.reduce((sum, q) => sum + (q.average_time || 60), 0);

            // Start hidden camera + bg face detection
            await startBgCamera();

            // Start timer
            setTimeout(() => {
                startTimer(total, () => doSubmit(true));
                startBgFaceCheck(() => doSubmit(true));
            }, 500);
        } catch (err) {
            closeLoader();
            toast('error', err.response?.data?.detail || 'Failed to generate assessment. Try again.', 4000);
        } finally {
            setLoading(false);
        }
    };

    const answeredCount = Object.keys(answers).length;
    const progress = questions.length > 0 ? Math.round((answeredCount / questions.length) * 100) : 0;
    const timerPct = totalTime > 0 ? (timeLeft / totalTime) * 100 : 0;
    const timerColor = timerPct > 50 ? '#10b981' : timerPct > 25 ? '#f59e0b' : '#ef4444';

    // ── Submit ─────────────────────────────────────────────────────────────────
    const doSubmit = useCallback(async (autoSubmit = false) => {
        clearInterval(timerRef.current);
        clearInterval(faceCheckIntervalRef.current);
        stopBgCamera();

        loader('📊 Evaluating your answers...');
        setLoading(true);

        const formattedAnswers = questions.map((_, i) => ({
            question_index: i,
            selected_answer: answers[i] || '',
        }));

        try {
            const data = await submitAssessment(assessmentId, formattedAnswers);
            closeLoader();
            setResult(data);
            setStep(3);
            const icon = data.score >= 7 ? 'success' : data.score >= 4 ? 'warning' : 'error';
            toast(icon, `You scored ${data.score}/10!`, 2000);
        } catch (err) {
            closeLoader();
            const detail = err?.response?.data?.detail;
            const msg = detail
                ? (typeof detail === 'string' ? detail : JSON.stringify(detail))
                : 'Submission failed. Try again.';
            toast('error', msg, 4000);
        } finally {
            setLoading(false);
        }
    }, [questions, answers, assessmentId]);

    const handleSubmit = async () => {
        if (answeredCount < questions.length) {
            const res = await confirm('Unanswered Questions',
                `You haven't answered ${questions.length - answeredCount} question(s). Submit anyway?`,
                'Submit Anyway');
            if (!res.isConfirmed) return;
        }
        doSubmit(false);
    };

    const resetAssessment = () => {
        clearInterval(timerRef.current);
        clearInterval(faceCheckIntervalRef.current);
        stopBgCamera();
        setStep(1); setResult(null); setAssessmentId(null);
        setQuestions([]); setAnswers({}); setTestSkill(''); setTestLevel('');
        setTimeLeft(null); setTotalTime(null); setFaceWarnings(0);
    };

    const lvlCfg = LEVEL_CONFIG[testLevel] || LEVEL_CONFIG.Medium;

    return (
        <div className="app-bg" style={{ minHeight: '100vh' }}>
            <Navbar />
            {/* Hidden camera feed — completely invisible, purely for bg face checks */}
            <video ref={hiddenVideoRef} autoPlay playsInline muted
                style={{ position: 'fixed', width: 1, height: 1, opacity: 0, pointerEvents: 'none', top: 0, left: 0 }} />

            <Container className="pb-5">
                <div className="fade-in" style={{ marginBottom: '2rem' }}>
                    <h2 style={{ fontWeight: 800 }}>🧠 Skill Assessment</h2>
                    <p style={{ color: '#64748b' }}>Test your knowledge with AI-generated questions</p>
                </div>

                {/* ── Step 1: Setup ──────────────────────────────────────── */}
                {step === 1 && (
                    <div className="card p-4 fade-in">
                        <h5 style={{ fontWeight: 700, marginBottom: '1.5rem' }}>⚙️ Configure Your Test</h5>

                        <Row className="g-3 mb-4">
                            <Col md={4}>
                                <label className="form-label">Select Skill</label>
                                <select className="form-select" value={selectedSkill}
                                    onChange={e => setSelectedSkill(e.target.value)}>
                                    <option value="">-- Select a skill --</option>
                                    {skills.map((s, i) => <option key={i} value={s}>{s}</option>)}
                                </select>
                            </Col>
                            <Col md={4}>
                                <label className="form-label">Number of Questions</label>
                                <select className="form-select" value={numQuestions}
                                    onChange={e => setNumQuestions(Number(e.target.value))}>
                                    <option value={5}>5 Questions</option>
                                    <option value={10}>10 Questions</option>
                                    <option value={15}>15 Questions</option>
                                    <option value={20}>20 Questions</option>
                                </select>
                            </Col>
                            <Col md={4}>
                                <label className="form-label">Difficulty Level</label>
                                <select className="form-select" value={level}
                                    onChange={e => setLevel(e.target.value)}>
                                    <option value="Easy">🟢 Easy — Basic concepts</option>
                                    <option value="Medium">🟡 Medium — Applied knowledge</option>
                                    <option value="Hard">🔴 Hard — Advanced topics</option>
                                </select>
                            </Col>
                        </Row>

                        {selectedSkill && (
                            <div style={{
                                background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)',
                                borderRadius: 10, padding: '0.75rem 1rem', marginBottom: '1.25rem',
                                color: '#a5b4fc', fontSize: '0.9rem'
                            }}>
                                📌 You will be tested on <strong>{selectedSkill}</strong> with{' '}
                                <strong>{numQuestions} {LEVEL_CONFIG[level].label}</strong> difficulty questions.
                                <br />
                                <span style={{ color: '#64748b', fontSize: '0.82rem' }}>
                                    ⏱️ AI will set a per-question timer. Camera monitors for unauthorized persons (hidden).
                                </span>
                            </div>
                        )}

                        <button className="btn btn-glow" style={{ padding: '0.75rem 2rem', fontSize: '1rem' }}
                            onClick={handleGenerate} disabled={loading || !selectedSkill}>
                            {loading ? '⏳ Generating...' : '⚡ Generate Test'}
                        </button>
                    </div>
                )}

                {/* ── Step 2: Test ────────────────────────────────────────── */}
                {step === 2 && (
                    <div>
                        {/* Sticky progress + timer */}
                        <div className="sticky-progress fade-in">
                            <Container>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: 8 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <span style={{ fontWeight: 700 }}>{testSkill}</span>
                                        <span style={{ background: lvlCfg.bg, color: lvlCfg.color, padding: '2px 10px', borderRadius: 20, fontSize: '0.78rem', fontWeight: 600 }}>
                                            {lvlCfg.label}
                                        </span>
                                        {faceWarnings > 0 && (
                                            <span style={{ background: 'rgba(245,158,11,0.2)', color: '#f59e0b', padding: '2px 10px', borderRadius: 20, fontSize: '0.78rem', fontWeight: 600 }}>
                                                ⚠️ {faceWarnings} warning(s)
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>{answeredCount}/{questions.length} answered</span>
                                        {/* countdown timer */}
                                        <span style={{
                                            fontFamily: 'monospace', fontWeight: 800, fontSize: '1.2rem',
                                            color: timerColor, transition: 'color 0.3s'
                                        }}>
                                            ⏱ {fmt(timeLeft)}
                                        </span>
                                    </div>
                                </div>
                                {/* Answer progress bar */}
                                <div style={{ background: '#334155', height: 4, borderRadius: 20, marginBottom: 3 }}>
                                    <div style={{ height: '100%', borderRadius: 20, transition: 'width 0.3s', background: progress === 100 ? '#10b981' : 'linear-gradient(90deg,#6366f1,#0ea5e9)', width: `${progress}%` }} />
                                </div>
                                {/* Time remaining bar */}
                                <div style={{ background: '#1e293b', height: 3, borderRadius: 20 }}>
                                    <div style={{ height: '100%', borderRadius: 20, transition: 'width 1s linear, background 0.3s', background: timerColor, width: `${timerPct}%` }} />
                                </div>
                            </Container>
                        </div>

                        {/* Questions */}
                        {questions.map((q, qIndex) => (
                            <div key={qIndex} className={`card p-4 mb-3 answer-card fade-in ${answers[qIndex] ? 'answered' : ''}`}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '1rem' }}>
                                    <span style={{ background: answers[qIndex] ? '#10b981' : '#334155', color: '#fff', borderRadius: 8, padding: '2px 10px', fontSize: '0.8rem', fontWeight: 700, flexShrink: 0 }}>
                                        Q{qIndex + 1}
                                    </span>
                                    <p style={{ margin: 0, fontWeight: 500, lineHeight: 1.5 }}>{q.question}</p>
                                </div>
                                <div style={{ paddingLeft: '0.5rem' }}>
                                    {q.options.map((opt, oIndex) => {
                                        const isSelected = answers[qIndex] === opt.key;
                                        return (
                                            <label key={oIndex} style={{
                                                display: 'flex', alignItems: 'center', gap: '0.75rem',
                                                padding: '0.65rem 1rem', borderRadius: 10, cursor: 'pointer',
                                                marginBottom: '0.4rem', transition: 'all 0.15s',
                                                border: `1px solid ${isSelected ? '#6366f1' : '#334155'}`,
                                                background: isSelected ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.02)',
                                            }}>
                                                <input type="radio" name={`q-${qIndex}`} value={opt.key} checked={isSelected}
                                                    onChange={() => setAnswers(a => ({ ...a, [qIndex]: opt.key }))}
                                                    style={{ display: 'none' }} />
                                                <span style={{
                                                    width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                                                    border: `2px solid ${isSelected ? '#6366f1' : '#475569'}`,
                                                    background: isSelected ? '#6366f1' : 'transparent',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontSize: '0.7rem', color: '#fff', fontWeight: 700,
                                                }}>
                                                    {isSelected && '✓'}
                                                </span>
                                                <span><strong style={{ color: '#94a3b8' }}>{opt.key}.</strong> {opt.value}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}

                        <div style={{ display: 'flex', gap: '0.75rem', paddingBottom: '3rem', marginTop: '0.5rem' }}>
                            <button className="btn btn-glow btn-glow-success" style={{ padding: '0.75rem 2rem' }}
                                onClick={handleSubmit} disabled={loading}>
                                {loading ? '⏳ Evaluating...' : `✅ Submit (${answeredCount}/${questions.length})`}
                            </button>
                            <button className="btn btn-glass" onClick={resetAssessment}>← Start Over</button>
                        </div>
                    </div>
                )}

                {/* ── Step 3: Result ──────────────────────────────────────── */}
                {step === 3 && result && (
                    <div className="card p-5 text-center fade-in">
                        <div style={{ fontSize: '4rem', marginBottom: '0.5rem' }}>{scoreEmoji(result.score)}</div>
                        <h1 style={{ fontSize: '4rem', fontWeight: 900, color: scoreColor(result.score), textShadow: `0 0 30px ${scoreColor(result.score)}66` }}>
                            {result.score}/10
                        </h1>

                        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', margin: '0.75rem 0 1rem' }}>
                            <span style={{ background: LEVEL_CONFIG[testLevel]?.bg || 'rgba(99,102,241,0.15)', color: LEVEL_CONFIG[testLevel]?.color || '#818cf8', padding: '4px 14px', borderRadius: 20, fontSize: '0.85rem', fontWeight: 600 }}>
                                {LEVEL_CONFIG[testLevel]?.label}
                            </span>
                            <span style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8', padding: '4px 14px', borderRadius: 20, fontSize: '0.85rem', fontWeight: 600 }}>
                                {result.skill}
                            </span>
                        </div>

                        <p style={{ color: '#94a3b8', fontSize: '1.1rem', marginBottom: '1.5rem' }}>
                            You answered <strong style={{ color: '#e2e8f0' }}>{result.correct_count}</strong> out of{' '}
                            <strong style={{ color: '#e2e8f0' }}>{result.total_questions}</strong> questions correctly.
                        </p>

                        <div style={{ maxWidth: 400, margin: '0 auto 1.5rem' }}>
                            <div style={{ background: '#334155', height: 20, borderRadius: 20, overflow: 'hidden' }}>
                                <div style={{ height: '100%', borderRadius: 20, transition: 'width 1s ease', background: scoreColor(result.score), width: `${(result.correct_count / result.total_questions) * 100}%` }} />
                            </div>
                            <small style={{ color: '#64748b' }}>{result.correct_count}/{result.total_questions} correct</small>
                        </div>

                        <p style={{ color: '#818cf8', fontStyle: 'italic', marginBottom: '2rem' }}>{scoreMsg(result.score)}</p>

                        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
                            <button className="btn btn-glow" onClick={resetAssessment}>🔁 Take Another Test</button>
                            <Link to="/dashboard" className="btn btn-glass">← Dashboard</Link>
                        </div>
                    </div>
                )}
            </Container>
        </div>
    );
}
