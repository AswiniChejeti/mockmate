import { useState, useEffect, useRef, useCallback } from 'react';
import { Container } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import { startInterview, submitInterview, verifyFace, uploadVideo } from '../../api/interviewApi';
import { getDashboardStats } from '../../api/dashboardApi';
import { toast, loader, closeLoader, confirm } from '../../utils/swal';

const SERVER_ROOT = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1').replace('/api/v1', '');
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const scoreColor = s => s >= 7 ? '#10b981' : s >= 4 ? '#f59e0b' : '#ef4444';
const fmt = secs => {
    if (secs === null || secs === undefined) return '--:--';
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
};

export default function InterviewPage() {
    const [step, setStep] = useState(1); // 1=Setup  2=FaceVerify  3=Interview  4=Results

    const [sessionId, setSessionId] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [answers, setAnswers] = useState({});  // { [qIndex]: string }
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);

    // ── Setup ─────────────────────────────────────────────────────────────────
    const [difficulty, setDifficulty] = useState('Medium');
    const [numQuestions, setNumQuestions] = useState(5);
    const [availableSkills, setAvailableSkills] = useState([]);
    const [selectedSkills, setSelectedSkills] = useState([]);
    const [fetchingSkills, setFetchingSkills] = useState(false);

    // ── Interview session ─────────────────────────────────────────────────────
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const mediaRecorderRef = useRef(null);
    const recordedChunksRef = useRef([]);

    // ── Camera refs ───────────────────────────────────────────────────────────
    const [cameraOn, setCameraOn] = useState(false);
    const [verifyResult, setVerifyResult] = useState(null);
    const [verifying, setVerifying] = useState(false);
    const videoRef = useRef(null); // visible ONLY in Step 2 (face verify)
    const hiddenVideoRef = useRef(null); // 1×1 invisible — bg face checks + recording
    const streamRef = useRef(null);

    // ── Security monitoring ───────────────────────────────────────────────────
    const [faceWarnings, setFaceWarnings] = useState(0);
    const faceWarningsRef = useRef(0);
    const faceCheckIntervalRef = useRef(null);
    const handleSubmitRef = useRef(null); // always latest handleSubmit
    const handleStartInterviewRef = useRef(null); // always latest handleStartInterview

    // ── Timer ─────────────────────────────────────────────────────────────────
    const [timeLeft, setTimeLeft] = useState(null);
    const [totalTime, setTotalTime] = useState(null);
    const timerRef = useRef(null);

    // ── Voice (ONLY way to answer) ─────────────────────────────────────────────
    const [isListening, setIsListening] = useState(false);
    const [speechSupported] = useState(!!SpeechRecognition);
    const recognitionRef = useRef(null);
    const finalTranscriptRef = useRef(''); // accumulates across pauses

    // ── Load skills on mount ───────────────────────────────────────────────────
    useEffect(() => {
        const load = async () => {
            setFetchingSkills(true);
            try {
                const stats = await getDashboardStats();
                if (stats?.resume?.skills) {
                    setAvailableSkills(stats.resume.skills);
                    setSelectedSkills(stats.resume.skills.slice(0, 5));
                }
            } catch (e) { console.error('skill load:', e); }
            finally { setFetchingSkills(false); }
        };
        load();
        return () => {
            recognitionRef.current?.stop();
            streamRef.current?.getTracks().forEach(t => t.stop());
            clearInterval(faceCheckIntervalRef.current);
            clearInterval(timerRef.current);
        };
    }, []);

    // ── Camera helpers ────────────────────────────────────────────────────────
    const startCamera = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            streamRef.current = stream;
            if (videoRef.current) videoRef.current.srcObject = stream;
            if (hiddenVideoRef.current) hiddenVideoRef.current.srcObject = stream;
            setCameraOn(true);
        } catch {
            toast('warning', 'Camera/mic unavailable. You can still proceed.', 4000);
        }
    }, []);

    const stopCamera = useCallback(() => {
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        setCameraOn(false);
    }, []);

    const captureFrame = (videoEl) => {
        if (!videoEl || videoEl.videoWidth === 0 || videoEl.videoHeight === 0) return null;
        const c = document.createElement('canvas');
        c.width = videoEl.videoWidth; c.height = videoEl.videoHeight;
        c.getContext('2d').drawImage(videoEl, 0, 0);
        return c.toDataURL('image/jpeg', 0.8);
    };

    // ── Face verification (Step 2) ─────────────────────────────────────────────
    // captureAndVerify has [] deps — it must call handleStartInterview via ref
    // so it always gets the latest selectedSkills / numQuestions values.
    const captureAndVerify = useCallback(async () => {
        const base64 = captureFrame(videoRef.current);
        if (!base64) { toast('warning', 'Camera warming up, wait a moment.'); return; }
        setVerifying(true);
        try {
            const res = await verifyFace(base64);
            setVerifyResult(res);
            if (res.verified) {
                toast('success', res.message || 'Identity verified! Starting interview…', 2500);
                setTimeout(() => handleStartInterviewRef.current?.(), 2000);
            } else {
                toast('warning', 'Face mismatch. Please try again.', 4000);
            }
        } catch {
            setVerifyResult({ verified: true, confidence: 0, message: 'Verification unavailable. Proceeding…' });
            toast('info', 'Verification unavailable. Starting interview…', 2500);
            setTimeout(() => handleStartInterviewRef.current?.(), 2000);
        } finally {
            setVerifying(false);
        }
    }, []); // safe — calls handleStartInterview via ref, not direct closure

    // ── Background security monitoring ────────────────────────────────────────
    const startBgFaceCheck = useCallback(() => {
        clearInterval(faceCheckIntervalRef.current);
        faceCheckIntervalRef.current = setInterval(async () => {
            const base64 = captureFrame(hiddenVideoRef.current);
            if (!base64) return;
            let anomaly = false;
            try {
                const res = await verifyFace(base64);
                if (!res.verified) anomaly = true;
            } catch { anomaly = true; }  // no face / hand / object = anomaly

            if (!anomaly) return;
            faceWarningsRef.current += 1;
            const count = faceWarningsRef.current;
            setFaceWarnings(count);
            if (count >= 2) {
                clearInterval(faceCheckIntervalRef.current);
                toast('error', '🚨 Security violation detected again! Interview auto-closed.', 5000);
                setTimeout(() => handleSubmitRef.current?.(true), 800);
            } else {
                toast('warning', '⚠️ Unauthorized activity detected! Interview will close if repeated.', 5000);
            }
        }, 15000);
    }, []);

    // ── Video recording (audio + video) ──────────────────────────────────────
    const startVideoRecording = useCallback(() => {
        if (!streamRef.current) return;
        recordedChunksRef.current = [];
        try {
            const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
                ? 'video/webm;codecs=vp9,opus'
                : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
                    ? 'video/webm;codecs=vp8,opus'
                    : 'video/webm';
            const mr = new MediaRecorder(streamRef.current, { mimeType });
            mr.ondataavailable = e => { if (e.data.size > 0) recordedChunksRef.current.push(e.data); };
            mr.start(1000);
            mediaRecorderRef.current = mr;
        } catch (e) { console.error('MediaRecorder:', e); }
    }, []);

    // ── Timer ─────────────────────────────────────────────────────────────────
    const questionsRef = useRef([]);
    questionsRef.current = questions;

    const startQuestionTimer = useCallback((seconds) => {
        clearInterval(timerRef.current);
        setTimeLeft(seconds);
        setTotalTime(seconds);
        timerRef.current = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timerRef.current);
                    setCurrentQuestionIndex(ci => {
                        const qs = questionsRef.current;
                        if (ci < qs.length - 1) {
                            toast('info', "⏰ Time's up! Moving to next question.", 2000);
                            setTimeout(() => startQuestionTimer(qs[ci + 1]?.average_time || 90), 100);
                            return ci + 1;
                        } else {
                            toast('warning', "⏰ Time's up! Auto-submitting interview.", 3000);
                            setTimeout(() => handleSubmitRef.current?.(true), 500);
                            return ci;
                        }
                    });
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    }, []);

    // ── Start interview ───────────────────────────────────────────────────────
    const handleStartInterview = useCallback(async () => {
        setLoading(true);
        loader('🤖 Generating your personalized interview…');
        try {
            const payload = { level: difficulty, skills: selectedSkills, num_questions: numQuestions };
            const data = await startInterview(payload);
            closeLoader();
            setSessionId(data.session_id);
            setQuestions(data.questions);
            setCurrentQuestionIndex(0);
            setAnswers({});
            finalTranscriptRef.current = '';
            faceWarningsRef.current = 0;
            setFaceWarnings(0);
            setStep(3);
            setTimeout(() => {
                startVideoRecording();
                startBgFaceCheck();
                startQuestionTimer(data.questions[0]?.average_time || 90);
            }, 600);
            toast('success', `Live interview started! Answer by speaking 🎤`, 2000);
        } catch (err) {
            closeLoader();
            toast('error', err.response?.data?.detail || 'Please upload your resume first.', 4000);
        } finally {
            setLoading(false);
        }
    }, [difficulty, selectedSkills, numQuestions, startVideoRecording, startBgFaceCheck, startQuestionTimer]);
    // Keep ref in sync so captureAndVerify (empty deps) always calls latest version
    handleStartInterviewRef.current = handleStartInterview;


    // ── Voice dictation — ONLY way to answer ─────────────────────────────────
    const startListening = useCallback((qIndex) => {
        if (!SpeechRecognition) { toast('error', 'Speech recognition not supported. Use Chrome/Edge.'); return; }
        recognitionRef.current?.stop();

        // Load any existing answer into final transcript
        finalTranscriptRef.current = answers[qIndex] || '';

        const rec = new SpeechRecognition();
        rec.lang = 'en-US';
        rec.continuous = true;
        rec.interimResults = true;

        rec.onresult = e => {
            let interim = '';
            for (let i = e.resultIndex; i < e.results.length; i++) {
                if (e.results[i].isFinal) {
                    finalTranscriptRef.current += e.results[i][0].transcript + ' ';
                } else {
                    interim = e.results[i][0].transcript;
                }
            }
            setAnswers(prev => ({ ...prev, [qIndex]: finalTranscriptRef.current + interim }));
        };

        rec.onerror = e => {
            setIsListening(false);
            if (e.error === 'not-allowed') toast('error', 'Microphone access denied.', 3000);
            else if (e.error !== 'aborted') toast('warning', `Mic error: ${e.error}`, 2000);
        };

        rec.onend = () => {
            setAnswers(prev => ({ ...prev, [qIndex]: finalTranscriptRef.current.trim() }));
            setIsListening(false);
        };

        recognitionRef.current = rec;
        rec.start();
        setIsListening(true);
    }, [answers]);

    const stopListening = useCallback(() => {
        recognitionRef.current?.stop();
        recognitionRef.current = null;
        setIsListening(false);
    }, []);

    // ── Navigate questions ────────────────────────────────────────────────────
    const getAnsweredCount = () => Object.keys(answers).filter(k => (answers[k] || '').trim() !== '').length;

    const goToQuestion = useCallback((idx) => {
        stopListening();
        clearInterval(timerRef.current);
        setCurrentQuestionIndex(idx);
        finalTranscriptRef.current = '';
        startQuestionTimer(questionsRef.current[idx]?.average_time || 90);
    }, [stopListening, startQuestionTimer]);

    // ── Submit ────────────────────────────────────────────────────────────────
    const handleSubmit = useCallback(async (autoSubmit = false) => {
        stopListening();
        clearInterval(timerRef.current);
        clearInterval(faceCheckIntervalRef.current);

        if (!autoSubmit) {
            const unanswered = questions.length - getAnsweredCount();
            if (unanswered > 0) {
                const res = await confirm('Unfinished Interview', `${unanswered} question(s) not answered. Submit anyway?`, 'Submit Anyway');
                if (!res.isConfirmed) return;
            }
        }

        setLoading(true);
        loader('🤖 Compiling recording & evaluating answers…');

        const getFinalBlob = () => new Promise(resolve => {
            if (!mediaRecorderRef.current) return resolve(null);
            if (mediaRecorderRef.current.state === 'inactive') {
                resolve(new Blob(recordedChunksRef.current, { type: 'video/webm' }));
            } else {
                mediaRecorderRef.current.onstop = () => resolve(new Blob(recordedChunksRef.current, { type: 'video/webm' }));
                mediaRecorderRef.current.stop();
            }
        });

        try {
            const videoBlob = await getFinalBlob();
            stopCamera();
            const formatted = questions.map(q => ({ question_index: q.index, answer: answers[q.index] || '' }));
            const data = await submitInterview(sessionId, formatted);
            if (videoBlob) {
                await uploadVideo(sessionId, videoBlob).catch(e => {
                    console.error('Video upload:', e);
                    toast('warning', 'Video upload failed but interview was processed.');
                });
            }
            closeLoader();
            setResult(data);
            setStep(4);
            const icon = data.overall_score >= 7 ? 'success' : data.overall_score >= 4 ? 'warning' : 'error';
            toast(icon, `Interview complete! Score: ${data.overall_score}/10`, 3000);
        } catch (err) {
            closeLoader();
            const detail = err?.response?.data?.detail;
            const msg = detail ? (typeof detail === 'string' ? detail : JSON.stringify(detail)) : 'Evaluation failed. Please try again.';
            toast('error', msg, 4000);
        } finally {
            setLoading(false);
        }
    }, [questions, answers, sessionId]);

    handleSubmitRef.current = handleSubmit;


    const resetInterview = () => {
        stopListening(); stopCamera();
        clearInterval(faceCheckIntervalRef.current);
        clearInterval(timerRef.current);
        faceWarningsRef.current = 0;
        finalTranscriptRef.current = '';
        setStep(1); setResult(null); setSessionId(null); setQuestions([]);
        setAnswers({}); setVerifyResult(null); setDifficulty('Medium'); setNumQuestions(5);
        setSelectedSkills(availableSkills.slice(0, 5));
        setTimeLeft(null); setTotalTime(null); setFaceWarnings(0);
    };

    const timerPct = totalTime > 0 ? (timeLeft / totalTime) * 100 : 0;
    const timerColor = timerPct > 50 ? '#10b981' : timerPct > 25 ? '#f59e0b' : '#ef4444';

    return (
        <div className="app-bg" style={{ minHeight: '100vh' }}>
            <Navbar />

            {/* Permanently hidden — bg face check + recording stream */}
            <video ref={hiddenVideoRef} autoPlay playsInline muted
                style={{ position: 'fixed', width: 1, height: 1, opacity: 0, top: 0, left: 0, pointerEvents: 'none' }} />

            <Container className="pb-5">
                <div className="fade-in" style={{ marginBottom: '2rem' }}>
                    <h2 style={{ fontWeight: 800 }}>🎤 AI Mock Interview</h2>
                    <p style={{ color: '#64748b' }}>
                        Resume-based questions · Speak your answers · AI-evaluated
                        {speechSupported
                            ? <span style={{ color: '#10b981', marginLeft: '0.5rem' }}>🎙️ Mic ready</span>
                            : <span style={{ color: '#ef4444', marginLeft: '0.5rem' }}>❌ Speech not supported — use Chrome/Edge</span>}
                    </p>
                </div>

                {/* ── Step 1: Setup ─────────────────────────────────────── */}
                {step === 1 && (
                    <div className="card p-5 fade-in" style={{ maxWidth: 680, margin: '0 auto' }}>
                        <div className="text-center">
                            <div style={{ fontSize: '4rem', marginBottom: '0.75rem' }}>🤖</div>
                            <h3 style={{ fontWeight: 800, marginBottom: '0.5rem' }}>Customize Your Interview</h3>
                            <p style={{ color: '#64748b', marginBottom: '2rem' }}>AI generates personalized questions from your resume. Answer by speaking only.</p>
                        </div>

                        <div className="row g-3 mb-4">
                            <div className="col-md-6">
                                <label style={{ fontWeight: 600, color: '#e2e8f0', marginBottom: '0.5rem', display: 'block' }}>Difficulty</label>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    {['Easy', 'Medium', 'Hard'].map(lvl => (
                                        <button key={lvl} onClick={() => setDifficulty(lvl)}
                                            className={`btn ${difficulty === lvl ? 'btn-glow' : 'btn-glass'}`}
                                            style={{ flex: 1 }}>{lvl}</button>
                                    ))}
                                </div>
                            </div>
                            <div className="col-md-6">
                                <label style={{ fontWeight: 600, color: '#e2e8f0', marginBottom: '0.5rem', display: 'block' }}>Number of Questions</label>
                                <select className="form-select" value={numQuestions}
                                    onChange={e => setNumQuestions(Number(e.target.value))}>
                                    <option value={1}>1 Question</option>
                                    <option value={3}>3 Questions</option>
                                    <option value={5}>5 Questions</option>
                                    <option value={10}>10 Questions</option>
                                    <option value={15}>15 Questions</option>
                                </select>
                            </div>
                        </div>

                        <div style={{ marginBottom: '2.5rem' }}>
                            <label style={{ fontWeight: 600, color: '#e2e8f0', marginBottom: '0.75rem', display: 'block' }}>
                                Target Skills <span style={{ color: '#64748b', fontWeight: 400 }}>(from your resume)</span>
                            </label>
                            {fetchingSkills ? (
                                <p style={{ color: '#94a3b8' }}>Loading skills…</p>
                            ) : availableSkills.length > 0 ? (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                    {availableSkills.map((skill, idx) => {
                                        const sel = selectedSkills.includes(skill);
                                        return (
                                            <span key={idx} onClick={() => setSelectedSkills(sel
                                                ? selectedSkills.filter(s => s !== skill)
                                                : [...selectedSkills, skill])}
                                                style={{
                                                    cursor: 'pointer', userSelect: 'none',
                                                    padding: '0.35rem 0.75rem', borderRadius: 20,
                                                    fontSize: '0.82rem', fontWeight: 500, transition: 'all 0.2s',
                                                    background: sel ? 'rgba(99,102,241,0.2)' : 'rgba(51,65,85,0.5)',
                                                    border: sel ? '1px solid rgba(99,102,241,0.5)' : '1px solid #334155',
                                                    color: sel ? '#a5b4fc' : '#94a3b8',
                                                }}>
                                                {sel ? '✓ ' : '+ '}{skill}
                                            </span>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p style={{ color: '#ef4444', fontSize: '0.9rem' }}>No skills found. Upload a resume on the Dashboard first.</p>
                            )}
                        </div>

                        <div className="text-center">
                            <button className="btn btn-glow" style={{ padding: '0.85rem 3rem', fontSize: '1.1rem', fontWeight: 700 }}
                                disabled={availableSkills.length === 0}
                                onClick={() => { setStep(2); setTimeout(startCamera, 300); }}>
                                🚀 Start Interview
                            </button>
                            <p style={{ color: '#64748b', fontSize: '0.82rem', marginTop: '0.75rem', marginBottom: 0 }}>
                                🔐 Face verification required · 🎥 Camera monitored hidden · 🎙️ Speak to answer
                            </p>
                        </div>
                    </div>
                )}

                {/* ── Step 2: Face Verification ─────────────────────────── */}
                {step === 2 && (
                    <div className="card p-4 fade-in" style={{ maxWidth: 520, margin: '0 auto' }}>
                        <h4 style={{ fontWeight: 700, textAlign: 'center', marginBottom: '0.25rem' }}>🔐 Identity Verification</h4>
                        <p style={{ textAlign: 'center', color: '#64748b', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                            Look at the camera — verification is <strong style={{ color: '#f59e0b' }}>required</strong> to start
                        </p>

                        <div className={`camera-box mx-auto mb-3 ${cameraOn ? 'recording' : ''} ${verifyResult?.verified ? 'verified' : ''}`}
                            style={{ width: 320, height: 240 }}>
                            <video ref={videoRef} autoPlay playsInline muted
                                style={{ width: '100%', height: '100%', objectFit: 'cover', display: cameraOn ? 'block' : 'none' }} />
                            {!cameraOn && (
                                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                                    {verifying
                                        ? <div style={{ textAlign: 'center' }}>
                                            <div className="spinner-border" style={{ color: '#6366f1' }} />
                                            <p style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>Verifying identity…</p>
                                        </div>
                                        : verifyResult
                                            ? <div style={{ fontSize: '4rem', textAlign: 'center' }}>{verifyResult.verified ? '✅' : '❌'}</div>
                                            : <div style={{ textAlign: 'center' }}><div style={{ fontSize: '2.5rem' }}>📷</div><small>Camera off</small></div>
                                    }
                                </div>
                            )}
                            {cameraOn && !verifying && <div className="live-badge">● LIVE</div>}
                            {verifying && cameraOn && (
                                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <div className="spinner-border text-light" />
                                </div>
                            )}
                        </div>

                        {verifyResult && !verifying && (
                            <div style={{
                                background: verifyResult.verified ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                                border: `1px solid ${verifyResult.verified ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                                borderRadius: 10, padding: '0.75rem', marginBottom: '0.75rem', textAlign: 'center',
                                color: verifyResult.verified ? '#6ee7b7' : '#fca5a5', fontSize: '0.9rem',
                            }}>
                                {verifyResult.message}
                                {verifyResult.verified && <div style={{ marginTop: 4, color: '#64748b', fontSize: '0.8rem' }}>Proceeding to interview automatically…</div>}
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                            {!cameraOn && !verifying && !verifyResult && (
                                <button className="btn btn-glass" onClick={startCamera}>📷 Start Camera</button>
                            )}
                            {cameraOn && !verifying && !verifyResult && (
                                <button className="btn btn-glow btn-glow-success" onClick={captureAndVerify}>
                                    📸 Capture & Verify
                                </button>
                            )}
                            {verifyResult && !verifyResult.verified && (
                                <button className="btn btn-glass" onClick={() => { setVerifyResult(null); startCamera(); }}>
                                    🔄 Try Again
                                </button>
                            )}
                        </div>

                        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                            <button className="btn btn-link btn-sm" style={{ color: '#475569' }}
                                onClick={() => { stopCamera(); setStep(1); }}>← Back to Setup</button>
                        </div>
                    </div>
                )}

                {/* ── Step 3: Live Interview (Voice Only) ───────────────── */}
                {step === 3 && questions.length > 0 && (() => {
                    const q = questions[currentQuestionIndex];
                    const spokenAnswer = (answers[q.index] || '').trim();
                    const wordCount = spokenAnswer.split(/\s+/).filter(Boolean).length;

                    return (
                        <div className="fade-in">
                            {/* Header */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                                <div>
                                    <h4 style={{ fontWeight: 800, margin: 0 }}>
                                        Live Session
                                        {faceWarnings > 0 && (
                                            <span style={{ marginLeft: '0.75rem', fontSize: '0.82rem', color: '#f59e0b' }}>
                                                ⚠️ {faceWarnings} security warning
                                            </span>
                                        )}
                                    </h4>
                                    <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
                                        Question {currentQuestionIndex + 1} of {questions.length} · {getAnsweredCount()} answered
                                    </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '1.8rem', fontWeight: 800, fontFamily: 'monospace', color: timerColor, transition: 'color 0.3s' }}>
                                            {fmt(timeLeft)}
                                        </div>
                                        <div style={{ background: '#334155', height: 4, width: 80, borderRadius: 4, marginTop: 2 }}>
                                            <div style={{ height: '100%', borderRadius: 4, background: timerColor, width: `${timerPct}%`, transition: 'width 1s linear, background 0.3s' }} />
                                        </div>
                                    </div>
                                    <div className="live-badge" style={{ position: 'relative', top: 'auto', right: 'auto', animation: 'pulse 2s infinite' }}>● REC</div>
                                    {/* Exit interview button */}
                                    <button
                                        className="btn btn-glass btn-sm"
                                        style={{ borderColor: 'rgba(239,68,68,0.4)', color: '#fca5a5', fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                                        onClick={async () => {
                                            stopListening();
                                            const res = await confirm(
                                                '🚪 Exit Interview?',
                                                'Your progress will be lost. Are you sure you want to exit?',
                                                'Yes, Exit'
                                            );
                                            if (res.isConfirmed) resetInterview();
                                        }}>
                                        🚪 Exit
                                    </button>
                                </div>
                            </div>

                            {/* Question nav dots */}
                            <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                                {questions.map((qq, i) => {
                                    const done = (answers[qq.index] || '').trim().length > 0;
                                    const active = i === currentQuestionIndex;
                                    return (
                                        <button key={i} onClick={() => goToQuestion(i)} style={{
                                            width: 32, height: 32, borderRadius: 8, fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer',
                                            border: active ? '2px solid #6366f1' : '1px solid #334155',
                                            background: active ? 'rgba(99,102,241,0.3)' : done ? 'rgba(16,185,129,0.2)' : 'rgba(30,41,59,0.6)',
                                            color: active ? '#a5b4fc' : done ? '#6ee7b7' : '#64748b',
                                        }}>
                                            {i + 1}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Full-width Q&A card — Voice OR Code depending on question type */}
                            <div className="card p-4" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                {/* Question */}
                                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                                    <span style={{ background: '#6366f1', color: '#fff', borderRadius: 8, padding: '4px 12px', fontSize: '1.05rem', fontWeight: 800, flexShrink: 0 }}>
                                        Q{currentQuestionIndex + 1}
                                    </span>
                                    <div style={{ flex: 1 }}>
                                        <h5 style={{ margin: 0, fontWeight: 600, lineHeight: 1.7, color: '#f8fafc' }}>{q.question}</h5>
                                        {/* Answer type badge */}
                                        <span style={{
                                            display: 'inline-block', marginTop: '0.5rem',
                                            padding: '2px 10px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 700,
                                            background: q.answer_type === 'code' ? 'rgba(245,158,11,0.15)' : 'rgba(99,102,241,0.15)',
                                            color: q.answer_type === 'code' ? '#fbbf24' : '#a5b4fc',
                                            border: q.answer_type === 'code' ? '1px solid rgba(245,158,11,0.3)' : '1px solid rgba(99,102,241,0.3)',
                                        }}>
                                            {q.answer_type === 'code'
                                                ? `💻 Write Code · ${q.code_language?.toUpperCase() || 'CODE'}`
                                                : '🎙️ Speak Your Answer'}
                                        </span>
                                    </div>
                                </div>

                                {/* ── CODE answer type ── */}
                                {q.answer_type === 'code' ? (
                                    <div>
                                        <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#f59e0b', fontWeight: 700, marginBottom: '0.5rem' }}>
                                            ✏️ Write your {q.code_language || 'code'} answer below
                                        </div>
                                        <div style={{ position: 'relative' }}>
                                            {/* Language label */}
                                            <div style={{
                                                position: 'absolute', top: 0, right: 0,
                                                background: 'rgba(245,158,11,0.2)', color: '#fbbf24',
                                                padding: '2px 10px', fontSize: '0.72rem', fontWeight: 700,
                                                borderBottom: '1px solid rgba(245,158,11,0.3)', borderLeft: '1px solid rgba(245,158,11,0.3)',
                                                borderRadius: '0 8px 0 8px', zIndex: 1,
                                            }}>
                                                {q.code_language?.toUpperCase() || 'CODE'}
                                            </div>
                                            <textarea
                                                value={answers[q.index] || ''}
                                                onChange={e => setAnswers(prev => ({ ...prev, [q.index]: e.target.value }))}
                                                placeholder={`// Write your ${q.code_language || 'code'} here...\n// Take your time, indentation and syntax matter`}
                                                rows={12}
                                                style={{
                                                    width: '100%', resize: 'vertical',
                                                    background: '#0d1117',
                                                    border: '2px solid rgba(245,158,11,0.3)',
                                                    borderRadius: 10,
                                                    color: '#e6edf3',
                                                    fontFamily: "'Fira Code', 'Cascadia Code', 'Consolas', monospace",
                                                    fontSize: '0.9rem', lineHeight: 1.7,
                                                    padding: '2.25rem 1rem 1rem 1rem',  // top padding for language label
                                                    outline: 'none',
                                                    caretColor: '#fbbf24',
                                                }}
                                                spellCheck={false}
                                                autoCapitalize="off"
                                                autoCorrect="off"
                                            />
                                        </div>
                                        {answers[q.index] && (
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.4rem' }}>
                                                <span style={{ color: '#475569', fontSize: '0.8rem' }}>
                                                    {answers[q.index].split('\n').length} lines · {answers[q.index].length} chars
                                                </span>
                                                <button className="btn btn-link btn-sm" style={{ color: '#475569', fontSize: '0.8rem', padding: 0 }}
                                                    onClick={() => setAnswers(prev => ({ ...prev, [q.index]: '' }))}>
                                                    🗑️ Clear
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    /* ── VOICE answer type ── */
                                    <div>
                                        <div style={{ position: 'relative' }}>
                                            <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#475569', fontWeight: 700, marginBottom: '0.5rem' }}>
                                                {isListening ? '🎙️ Listening…' : spokenAnswer ? '✅ Your Spoken Answer' : '🎤 Speak Your Answer'}
                                            </div>
                                            <div style={{
                                                minHeight: 160, padding: '1.25rem', borderRadius: 12,
                                                background: isListening ? 'rgba(239,68,68,0.06)' : spokenAnswer ? 'rgba(16,185,129,0.06)' : 'rgba(30,41,59,0.5)',
                                                border: `2px solid ${isListening ? 'rgba(239,68,68,0.4)' : spokenAnswer ? 'rgba(16,185,129,0.3)' : '#334155'}`,
                                                transition: 'all 0.3s',
                                                color: spokenAnswer ? '#e2e8f0' : '#475569',
                                                fontSize: '1rem', lineHeight: 1.7,
                                                fontStyle: spokenAnswer ? 'normal' : 'italic',
                                            }}>
                                                {spokenAnswer || (isListening
                                                    ? 'Speak now… your voice is being captured'
                                                    : 'Press the microphone button below and speak your answer')}
                                                {isListening && (
                                                    <span style={{ display: 'inline-block', marginLeft: '0.5rem', animation: 'pulse 1s infinite' }}>●</span>
                                                )}
                                            </div>
                                            {spokenAnswer && (
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                                                    <span style={{ color: '#475569', fontSize: '0.82rem' }}>{wordCount} words spoken</span>
                                                    <button className="btn btn-link btn-sm" style={{ color: '#475569', fontSize: '0.8rem', padding: 0 }}
                                                        onClick={() => { finalTranscriptRef.current = ''; setAnswers(prev => ({ ...prev, [q.index]: '' })); }}>
                                                        🗑️ Clear & Re-speak
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {/* Big mic button */}
                                        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
                                            {!speechSupported ? (
                                                <div style={{ textAlign: 'center', color: '#ef4444' }}>
                                                    ❌ Speech recognition not supported. Please use Chrome or Edge browser.
                                                </div>
                                            ) : !isListening ? (
                                                <button onClick={() => startListening(q.index)}
                                                    style={{
                                                        width: 80, height: 80, borderRadius: '50%', border: 'none', cursor: 'pointer',
                                                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                                        boxShadow: '0 0 0 0 rgba(99,102,241,0.5)',
                                                        color: '#fff', fontSize: '1.8rem',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        transition: 'all 0.2s',
                                                    }}
                                                    title="Click to start speaking">
                                                    🎙️
                                                </button>
                                            ) : (
                                                <button onClick={stopListening}
                                                    style={{
                                                        width: 80, height: 80, borderRadius: '50%', border: 'none', cursor: 'pointer',
                                                        background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                                                        boxShadow: '0 0 0 8px rgba(239,68,68,0.3), 0 0 0 16px rgba(239,68,68,0.1)',
                                                        color: '#fff', fontSize: '1.8rem',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        animation: 'pulse 1.5s infinite',
                                                    }}
                                                    title="Click to stop">
                                                    ⏹️
                                                </button>
                                            )}
                                        </div>
                                        <p style={{ textAlign: 'center', color: '#475569', fontSize: '0.82rem', margin: '0.5rem 0 0' }}>
                                            {isListening ? 'Speaking… click ⏹️ when done' : 'Click 🎙️ to start speaking your answer'}
                                        </p>
                                    </div>
                                )}

                                {/* Nav buttons */}
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '1rem', borderTop: '1px solid #334155' }}>
                                    {currentQuestionIndex > 0 && (
                                        <button className="btn btn-glass btn-sm" onClick={() => goToQuestion(currentQuestionIndex - 1)}>← Prev</button>
                                    )}
                                    {currentQuestionIndex < questions.length - 1 ? (
                                        <button className="btn btn-glow" style={{ padding: '0.65rem 2rem' }} onClick={() => goToQuestion(currentQuestionIndex + 1)}>
                                            Next →
                                        </button>
                                    ) : (
                                        <button className="btn btn-glow btn-glow-success" style={{ padding: '0.65rem 2rem' }}
                                            onClick={() => handleSubmit(false)} disabled={loading}>
                                            {loading ? '⏳ Submitting…' : '✅ Finish Interview'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })()}

                {/* ── Step 4: Results ───────────────────────────────────── */}
                {step === 4 && result && (
                    <div className="fade-in">
                        <div className="card p-5 text-center mb-4">
                            <div style={{ fontSize: '4rem', marginBottom: '0.5rem' }}>🎉</div>
                            <h2 style={{ fontWeight: 800 }}>Interview Complete!</h2>
                            <div style={{ fontSize: '5rem', fontWeight: 900, color: scoreColor(result.overall_score), lineHeight: 1 }}>
                                {result.overall_score}
                            </div>
                            <p style={{ color: '#64748b' }}>out of 10</p>
                            <div style={{ maxWidth: 400, margin: '0.5rem auto' }}>
                                <div style={{ background: '#334155', height: 12, borderRadius: 20, overflow: 'hidden' }}>
                                    <div style={{ height: '100%', borderRadius: 20, background: scoreColor(result.overall_score), width: `${result.overall_score * 10}%`, transition: 'width 1s' }} />
                                </div>
                            </div>

                            {result.video_url && (
                                <div style={{ marginTop: '1.5rem' }}>
                                    <h6 style={{ color: '#64748b', textTransform: 'uppercase', fontSize: '0.78rem', letterSpacing: '0.06em' }}>🎵 Session Recording — Listen to Your Answers</h6>
                                    <video controls src={`${SERVER_ROOT}${result.video_url}`}
                                        style={{ width: '100%', maxWidth: 600, borderRadius: 10, border: '1px solid #334155', marginTop: '0.5rem', background: '#000' }} />
                                </div>
                            )}
                        </div>

                        <h4 style={{ fontWeight: 700, marginBottom: '1.25rem' }}>📋 Detailed Feedback</h4>
                        {result.feedback.map((f, idx) => {
                            const nlp = f.nlp_analysis;
                            return (
                                <div key={idx} className="card p-4 mb-3">
                                    <p style={{ fontWeight: 600, marginBottom: '0.75rem', color: '#e2e8f0' }}>
                                        Q{f.question_index + 1}. {f.question}
                                    </p>
                                    <div className="user-answer-box mb-3">
                                        <small style={{ textTransform: 'uppercase', fontSize: '0.7rem', color: '#475569', fontWeight: 700, display: 'block', marginBottom: 4 }}>🎙️ Your Spoken Answer</small>
                                        {f.user_answer
                                            ? `"${f.user_answer}"`
                                            : <em style={{ color: '#475569' }}>No answer given (skipped)</em>}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                                        <span style={{ fontSize: '1.5rem', fontWeight: 800, color: scoreColor(f.score) }}>
                                            {f.score}<span style={{ fontSize: '0.85rem', color: '#64748b' }}>/10</span>
                                        </span>
                                        <div style={{ flex: 1, background: '#334155', height: 8, borderRadius: 20 }}>
                                            <div style={{ height: '100%', borderRadius: 20, background: scoreColor(f.score), width: `${f.score * 10}%` }} />
                                        </div>
                                    </div>
                                    <div className="ai-feedback-box mb-3"><strong>💬 AI Feedback: </strong>{f.feedback}</div>
                                    {nlp && nlp.word_count > 0 && (
                                        <div className="nlp-panel">
                                            <strong style={{ display: 'block', marginBottom: '0.75rem', fontSize: '0.9rem' }}>🧠 Speech Analysis</strong>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '0.5rem' }}>
                                                {[
                                                    { val: nlp.word_count, label: 'Words', color: '#818cf8' },
                                                    { val: `${nlp.fluency_score}/10`, label: 'Fluency', color: scoreColor(nlp.fluency_score) },
                                                    { val: nlp.filler_count, label: 'Fillers', color: nlp.filler_count === 0 ? '#10b981' : nlp.filler_count <= 3 ? '#f59e0b' : '#ef4444' },
                                                    { val: `${(nlp.vocabulary_richness * 100).toFixed(0)}%`, label: 'Vocab', color: '#38bdf8' },
                                                ].map((m, i) => (
                                                    <div key={i} className="nlp-metric">
                                                        <span className="nlp-metric-value" style={{ color: m.color }}>{m.val}</span>
                                                        <span className="nlp-metric-label">{m.label}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        <div style={{ display: 'flex', gap: '0.75rem', paddingBottom: '3rem' }}>
                            <button className="btn btn-glow" onClick={resetInterview}>🔁 New Interview</button>
                            <Link to="/dashboard" className="btn btn-glass">← Dashboard</Link>
                        </div>
                    </div>
                )}
            </Container>
        </div>
    );
}
