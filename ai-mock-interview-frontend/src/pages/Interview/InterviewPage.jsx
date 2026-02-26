import { useState, useEffect, useRef, useCallback } from 'react';
import { Container } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import { startInterview, submitInterview, verifyFace, uploadVideo } from '../../api/interviewApi';
import { getDashboardStats } from '../../api/dashboardApi';
import { toast, loader, closeLoader, confirm } from '../../utils/swal';

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

const scoreColor = s => s >= 7 ? '#10b981' : s >= 4 ? '#f59e0b' : '#ef4444';

export default function InterviewPage() {
    const [step, setStep] = useState(1); // 1=Setup 2=FaceVerify 3=Interview 4=Results

    const [sessionId, setSessionId] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [answers, setAnswers] = useState({});
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);

    // Setup state
    const [difficulty, setDifficulty] = useState('Medium');
    const [availableSkills, setAvailableSkills] = useState([]);
    const [selectedSkills, setSelectedSkills] = useState([]);
    const [fetchingSkills, setFetchingSkills] = useState(false);

    // Live interview state
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const mediaRecorderRef = useRef(null);
    const recordedChunksRef = useRef([]);

    // Face verify
    const [cameraOn, setCameraOn] = useState(false);
    const [verifyResult, setVerifyResult] = useState(null);
    const [verifying, setVerifying] = useState(false);
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);

    // Voice
    const [recordingIndex, setRecordingIndex] = useState(null);
    const [speechSupported] = useState(!!SpeechRecognition);
    const recognitionRef = useRef(null);

    useEffect(() => {
        // Fetch resume skills on mount
        const loadSkills = async () => {
            setFetchingSkills(true);
            try {
                const stats = await getDashboardStats();
                if (stats?.resume?.skills) {
                    setAvailableSkills(stats.resume.skills);
                    setSelectedSkills(stats.resume.skills.slice(0, 5)); // select up to 5 by default
                }
            } catch (err) {
                console.error("Failed to fetch skills:", err);
            } finally {
                setFetchingSkills(false);
            }
        };
        loadSkills();

        return () => {
            if (recognitionRef.current) recognitionRef.current.stop();
            stopCamera();
        };
    }, []);

    // ── Camera ────────────────────────────────────────────────────────────────
    const startCamera = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            streamRef.current = stream;
            if (videoRef.current) videoRef.current.srcObject = stream;
            setCameraOn(true);
        } catch {
            toast('warning', 'Camera unavailable. You can skip face verification.', 4000);
        }
    }, []);

    const stopCamera = useCallback(() => {
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        setCameraOn(false);
    }, []);

    const captureAndVerify = useCallback(async () => {
        if (!videoRef.current || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const video = videoRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        const base64 = canvas.toDataURL('image/jpeg', 0.8);
        // Do not stopCamera() yet so we can record video during interview
        setVerifying(true);

        try {
            const res = await verifyFace(base64);
            setVerifyResult(res);
            if (res.verified) toast('success', res.message, 3000);
            else toast('warning', 'Face mismatch detected. Please verify your identity.', 4000);
        } catch {
            setVerifyResult({ verified: true, confidence: 0, message: 'Verification unavailable. Proceeding...' });
            toast('info', 'Face verification unavailable. Proceeding.', 3000);
        } finally {
            setVerifying(false);
        }
    }, [stopCamera]);

    // ── Start interview ───────────────────────────────────────────────────────
    const startVideoRecording = () => {
        if (!streamRef.current) return;

        // Attach stream to the new video element in Step 3
        if (videoRef.current && !videoRef.current.srcObject) {
            videoRef.current.srcObject = streamRef.current;
        }

        recordedChunksRef.current = [];
        try {
            const mediaRecorder = new MediaRecorder(streamRef.current, { mimeType: 'video/webm' });
            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) recordedChunksRef.current.push(e.data);
            };
            mediaRecorder.start(1000);
            mediaRecorderRef.current = mediaRecorder;
        } catch (e) { console.error('MediaRecorder start error', e); }
    };

    const handleStartInterview = async () => {
        setLoading(true);
        loader('🤖 Generating your live interview...');
        try {
            const payload = {
                level: difficulty,
                skills: selectedSkills
            };
            const data = await startInterview(payload);
            closeLoader();
            setSessionId(data.session_id);
            setQuestions(data.questions);
            setCurrentQuestionIndex(0);
            setAnswers({});
            setStep(3);
            setTimeout(startVideoRecording, 500);
            toast('success', `Live interview started!`, 2000);
        } catch (err) {
            closeLoader();
            toast('error', err.response?.data?.detail || 'Please upload your resume first.', 4000);
        } finally {
            setLoading(false);
        }
    };

    // ── Voice ────────────────────────────────────────────────────────────────
    const startRecording = (qIndex) => {
        if (!SpeechRecognition) return;
        recognitionRef.current?.stop();

        const rec = new SpeechRecognition();
        rec.lang = 'en-US';
        rec.continuous = true;
        rec.interimResults = true;
        let final = answers[qIndex] || '';

        rec.onresult = (e) => {
            let interim = '';
            for (let i = e.resultIndex; i < e.results.length; i++) {
                if (e.results[i].isFinal) final += e.results[i][0].transcript + ' ';
                else interim = e.results[i][0].transcript;
            }
            setAnswers(prev => ({ ...prev, [qIndex]: final + interim }));
        };

        rec.onerror = (e) => {
            setRecordingIndex(null);
            if (e.error === 'not-allowed') toast('error', 'Microphone access denied.', 3000);
        };

        rec.onend = () => {
            setAnswers(prev => ({ ...prev, [qIndex]: final.trim() }));
            setRecordingIndex(null);
        };

        recognitionRef.current = rec;
        rec.start();
        setRecordingIndex(qIndex);
    };

    const stopRecording = () => {
        recognitionRef.current?.stop();
        recognitionRef.current = null;
        setRecordingIndex(null);
    };

    // ── Submit ────────────────────────────────────────────────────────────────
    const getAnsweredCount = () =>
        Object.keys(answers).filter(k => (answers[k] || '').trim() !== '').length;

    const handleNextQuestion = () => {
        stopRecording();
        if (currentQuestionIndex < questions.length - 1) {
            setCurrentQuestionIndex(currentQuestionIndex + 1);
        }
    };

    const handleSubmit = async () => {
        stopRecording();

        const getFinalVideoBlob = () => new Promise(resolve => {
            if (!mediaRecorderRef.current) return resolve(null);
            if (mediaRecorderRef.current.state === 'inactive') {
                resolve(new Blob(recordedChunksRef.current, { type: 'video/webm' }));
            } else {
                mediaRecorderRef.current.onstop = () => {
                    resolve(new Blob(recordedChunksRef.current, { type: 'video/webm' }));
                };
                mediaRecorderRef.current.stop();
            }
        });

        const unanswered = questions.length - getAnsweredCount();
        if (unanswered > 0) {
            const res = await confirm(
                'Unfinished Interview',
                `You haven't answered ${unanswered} question(s). Finish now?`,
                'Finish Anyway'
            );
            if (!res.isConfirmed) return;
        }

        setLoading(true);
        loader('🤖 Compiling video & AI evaluating answers...');

        try {
            const videoBlob = await getFinalVideoBlob();
            stopCamera();

            const formatted = questions.map(q => ({
                question_index: q.index,
                answer: answers[q.index] || '',
            }));

            // Submit text answers
            const data = await submitInterview(sessionId, formatted);

            // Submit video blob
            if (videoBlob) {
                await uploadVideo(sessionId, videoBlob).catch(err => {
                    console.error('Video upload failed', err);
                    toast('warning', 'Video upload failed, but interview processed.');
                });
            }

            closeLoader();
            setResult(data);
            setStep(4);
            const icon = data.overall_score >= 7 ? 'success' : data.overall_score >= 4 ? 'warning' : 'error';
            toast(icon, `Interview complete! Score: ${data.overall_score}/10`, 3000);
        } catch (err) {
            closeLoader();
            toast('error', err.response?.data?.detail || 'Evaluation failed. Try again.', 4000);
        } finally {
            setLoading(false);
        }
    };

    const resetInterview = () => {
        stopRecording(); stopCamera();
        setStep(1); setResult(null); setSessionId(null);
        setQuestions([]); setAnswers({}); setVerifyResult(null);
        setSelectedSkills(availableSkills.slice(0, 5));
        setDifficulty('Medium');
    };

    return (
        <div className="app-bg" style={{ minHeight: '100vh' }}>
            <Navbar />
            <Container className="pb-5">
                <div className="fade-in" style={{ marginBottom: '2rem' }}>
                    <h2 style={{ fontWeight: 800 }}>🎤 AI Mock Interview</h2>
                    <p style={{ color: '#64748b' }}>
                        Resume-based questions · Type or speak · AI-evaluated
                        {speechSupported
                            ? <span style={{ color: '#10b981', marginLeft: '0.5rem' }}>🎙️ Mic ready</span>
                            : <span style={{ color: '#f59e0b', marginLeft: '0.5rem' }}>⚠️ Use Chrome/Edge for mic</span>}
                    </p>
                </div>

                {/* ── Step 1: Setup ─────────────────────────────────────────── */}
                {step === 1 && (
                    <div className="card p-5 fade-in" style={{ maxWidth: 650, margin: '0 auto' }}>
                        <div className="text-center">
                            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🤖</div>
                            <h3 style={{ fontWeight: 800, marginBottom: '0.5rem' }}>Customize Your Interview</h3>
                            <p style={{ color: '#64748b', marginBottom: '2rem' }}>
                                We'll generate 10 unique questions based on your resume. You can customize the focus and difficulty below.
                            </p>
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ fontWeight: 600, color: '#e2e8f0', marginBottom: '0.5rem', display: 'block' }}>
                                Difficulty Level
                            </label>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                {['Easy', 'Medium', 'Hard'].map(lvl => (
                                    <button key={lvl}
                                        onClick={() => setDifficulty(lvl)}
                                        className={`btn ${difficulty === lvl ? 'btn-glow' : 'btn-glass'}`}
                                        style={{ flex: 1 }}>
                                        {lvl}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div style={{ marginBottom: '2.5rem' }}>
                            <label style={{ fontWeight: 600, color: '#e2e8f0', marginBottom: '0.75rem', display: 'block' }}>
                                Target Skills (Extracted from Resume)
                            </label>
                            {fetchingSkills ? (
                                <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Loading your skills...</p>
                            ) : availableSkills.length > 0 ? (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                    {availableSkills.map((skill, idx) => {
                                        const isSelected = selectedSkills.includes(skill);
                                        return (
                                            <span
                                                key={idx}
                                                onClick={() => {
                                                    if (isSelected) {
                                                        setSelectedSkills(selectedSkills.filter(s => s !== skill));
                                                    } else {
                                                        setSelectedSkills([...selectedSkills, skill]);
                                                    }
                                                }}
                                                className={`skill-badge ${isSelected ? '' : 'unselected'}`}
                                                style={{
                                                    cursor: 'pointer',
                                                    background: isSelected ? 'rgba(99,102,241,0.2)' : 'rgba(51,65,85,0.5)',
                                                    border: isSelected ? '1px solid rgba(99,102,241,0.5)' : '1px solid #334155',
                                                    color: isSelected ? '#a5b4fc' : '#94a3b8',
                                                    transition: 'all 0.2s',
                                                    userSelect: 'none'
                                                }}>
                                                {isSelected ? '✓ ' : '+ '} {skill}
                                            </span>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p style={{ color: '#ef4444', fontSize: '0.9rem' }}>No skills found. Please upload a resume in the dashboard first.</p>
                            )}
                        </div>

                        <div className="text-center">
                            <button className="btn btn-glow" style={{ padding: '0.85rem 3rem', fontSize: '1.1rem', fontWeight: 700 }}
                                disabled={availableSkills.length === 0}
                                onClick={() => { setStep(2); setTimeout(startCamera, 300); }}>
                                🚀 Start Interview
                            </button>
                            <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '1rem', marginBottom: 0 }}>
                                Your face will be verified before the interview begins.
                            </p>
                        </div>
                    </div>
                )}

                {/* ── Step 2: Face Verification ─────────────────────────────── */}
                {step === 2 && (
                    <div className="card p-4 fade-in" style={{ maxWidth: 520, margin: '0 auto' }}>
                        <h4 style={{ fontWeight: 700, textAlign: 'center', marginBottom: '0.25rem' }}>🔐 Identity Verification</h4>
                        <p style={{ textAlign: 'center', color: '#64748b', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                            Look at the camera so we can verify your identity
                        </p>

                        {/* Camera */}
                        <div className={`camera-box mx-auto mb-3 ${cameraOn ? 'recording' : ''} ${verifyResult?.verified ? 'verified' : ''}`}
                            style={{ width: 320, height: 240 }}>
                            <video ref={videoRef} autoPlay playsInline muted
                                style={{
                                    width: '100%', height: '100%', objectFit: 'cover',
                                    display: cameraOn ? 'block' : 'none'
                                }} />
                            {!cameraOn && (
                                <div style={{
                                    width: '100%', height: '100%', display: 'flex',
                                    alignItems: 'center', justifyContent: 'center', color: '#64748b'
                                }}>
                                    {verifying
                                        ? <div style={{ textAlign: 'center' }}>
                                            <div className="spinner-border" style={{ color: '#6366f1' }} />
                                            <p style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>Verifying...</p>
                                        </div>
                                        : verifyResult
                                            ? <div style={{ fontSize: '4rem' }}>{verifyResult.verified ? '✅' : '⚠️'}</div>
                                            : <div style={{ textAlign: 'center' }}>
                                                <div style={{ fontSize: '2.5rem' }}>📷</div>
                                                <small>Camera off</small>
                                            </div>
                                    }
                                </div>
                            )}
                            {cameraOn && <div className="live-badge">● LIVE</div>}
                        </div>
                        <canvas ref={canvasRef} style={{ display: 'none' }} />

                        {/* Verify result */}
                        {verifyResult && !verifying && (
                            <div style={{
                                background: verifyResult.verified ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
                                border: `1px solid ${verifyResult.verified ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`,
                                borderRadius: 10, padding: '0.75rem', marginBottom: '0.75rem', textAlign: 'center',
                                color: verifyResult.verified ? '#6ee7b7' : '#fcd34d', fontSize: '0.9rem',
                            }}>
                                {verifyResult.message}
                                {verifyResult.confidence > 0 && (
                                    <div style={{ marginTop: '0.5rem' }}>
                                        <div style={{ background: '#334155', height: 6, borderRadius: 20 }}>
                                            <div style={{
                                                height: '100%', borderRadius: 20,
                                                background: verifyResult.confidence >= 0.7 ? '#10b981' : '#f59e0b',
                                                width: `${verifyResult.confidence * 100}%`, transition: 'width 0.5s'
                                            }} />
                                        </div>
                                        <small style={{ color: '#64748b' }}>
                                            Confidence: {(verifyResult.confidence * 100).toFixed(1)}%
                                        </small>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Controls */}
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                            {!cameraOn && !verifyResult && !verifying && (
                                <button className="btn btn-glass" onClick={startCamera}>📷 Start Camera</button>
                            )}
                            {cameraOn && (
                                <button className="btn btn-glow-success btn-glow" onClick={captureAndVerify}>
                                    📸 Capture & Verify
                                </button>
                            )}
                            {verifyResult && (
                                <>
                                    {verifyResult.verified
                                        ? <button className="btn btn-glow" onClick={handleStartInterview} disabled={loading}>
                                            {loading ? '⏳ Loading...' : '✅ Proceed to Interview'}
                                        </button>
                                        : <>
                                            <button className="btn btn-glass" onClick={() => { setVerifyResult(null); startCamera(); }}>
                                                🔄 Try Again
                                            </button>
                                            <button className="btn btn-glass" onClick={handleStartInterview} disabled={loading}>
                                                Proceed Anyway
                                            </button>
                                        </>
                                    }
                                </>
                            )}
                        </div>

                        <div style={{ textAlign: 'center', marginTop: '1rem', display: 'flex', justifyContent: 'center', gap: '1rem' }}>
                            <button className="btn btn-link btn-sm" style={{ color: '#64748b' }}
                                onClick={() => { stopCamera(); setStep(1); }}>← Back</button>
                            <button className="btn btn-link btn-sm" style={{ color: '#64748b' }}
                                onClick={() => { stopCamera(); handleStartInterview(); }}>Skip Verification</button>
                        </div>
                    </div>
                )}

                {/* ── Step 3: Live Interview ─────────────────────────────────────── */}
                {step === 3 && questions.length > 0 && (
                    <div className="fade-in">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <div>
                                <h4 style={{ fontWeight: 800, margin: 0 }}>
                                    Live Session
                                </h4>
                                <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
                                    Question {currentQuestionIndex + 1} of {questions.length}
                                </span>
                            </div>
                            <div className="live-badge" style={{ animation: 'pulse 2s infinite' }}>● RECORDING</div>
                        </div>

                        {/* Split view: Camera on left, Question/Answer on right */}
                        <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>

                            {/* Left Side: Camera Box */}
                            <div style={{ flex: '1 1 300px', maxWidth: '400px' }}>
                                <div className="camera-box recording" style={{ width: '100%', aspectRatio: '4/3', position: 'relative' }}>
                                    <video ref={videoRef} autoPlay playsInline muted
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                </div>
                                <div style={{ marginTop: '1rem', background: 'rgba(30,41,59,0.5)', padding: '1.25rem', borderRadius: 12 }}>
                                    <h6 style={{ color: '#94a3b8', fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: 800 }}>Tips:</h6>
                                    <ul style={{ color: '#cbd5e1', fontSize: '0.9rem', marginBottom: 0, paddingLeft: '1.2rem', lineHeight: 1.6 }}>
                                        <li>Speak clearly into your microphone</li>
                                        <li>Maintain eye contact with the camera</li>
                                        <li>You can type your answer if preferred</li>
                                    </ul>
                                </div>
                            </div>

                            {/* Right Side: Q & A */}
                            <div style={{ flex: '2 1 400px' }}>
                                {(() => {
                                    const q = questions[currentQuestionIndex];
                                    const isRecording = recordingIndex === q.index;
                                    const hasAnswer = (answers[q.index] || '').trim().length > 0;
                                    const wordCount = (answers[q.index] || '').trim().split(/\s+/).filter(Boolean).length;

                                    return (
                                        <div className="card p-4 h-100" style={{ display: 'flex', flexDirection: 'column' }}>
                                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '1.5rem' }}>
                                                <span style={{
                                                    background: '#10b981', color: '#fff',
                                                    borderRadius: 8, padding: '4px 12px', fontSize: '1.1rem', fontWeight: 800, flexShrink: 0
                                                }}>
                                                    Q{currentQuestionIndex + 1}
                                                </span>
                                                <h5 style={{ margin: 0, fontWeight: 600, lineHeight: 1.6, color: '#f8fafc' }}>
                                                    {q.question}
                                                </h5>
                                            </div>

                                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                                <textarea
                                                    className="form-control"
                                                    style={{ flex: 1, minHeight: '200px', fontSize: '1.05rem', lineHeight: 1.6, ...(isRecording ? { borderColor: '#ef4444', borderWidth: 2, background: 'rgba(239,68,68,0.05)' } : {}) }}
                                                    placeholder={isRecording ? '🎙️ Listening... speak your answer...' : 'Type or 🎙️ speak your answer...'}
                                                    value={answers[q.index] || ''}
                                                    onChange={e => setAnswers(prev => ({ ...prev, [q.index]: e.target.value }))}
                                                />

                                                {speechSupported && (
                                                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', alignItems: 'center' }}>
                                                        {!isRecording
                                                            ? <button className="btn btn-glass btn-sm" style={{ borderColor: 'rgba(239,68,68,0.4)', color: '#fca5a5', padding: '0.5rem 1rem' }}
                                                                onClick={() => startRecording(q.index)}
                                                                disabled={recordingIndex !== null && recordingIndex !== q.index}>
                                                                🎙️ Voice Dictation
                                                            </button>
                                                            : <button className="btn btn-glow-danger btn-glow btn-sm" style={{ padding: '0.5rem 1rem' }} onClick={stopRecording}>
                                                                ⏹️ Stop Dictation
                                                            </button>
                                                        }
                                                        {hasAnswer && (
                                                            <span style={{ color: '#475569', marginLeft: 'auto', fontWeight: 600, fontSize: '0.9rem' }}>
                                                                {wordCount} words recorded
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid #334155' }}>
                                                {currentQuestionIndex < questions.length - 1 ? (
                                                    <button className="btn btn-glow" style={{ padding: '0.75rem 2.5rem', fontSize: '1.05rem' }} onClick={handleNextQuestion}>
                                                        Next Question →
                                                    </button>
                                                ) : (
                                                    <button className="btn btn-glow btn-glow-success" style={{ padding: '0.75rem 2.5rem', fontSize: '1.05rem' }} onClick={handleSubmit} disabled={loading}>
                                                        {loading ? '⏳ Submitting...' : '✅ Finish Interview'}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Step 4: Results ───────────────────────────────────────── */}
                {step === 4 && result && (
                    <div className="fade-in">
                        {/* Score card */}
                        <div className="card p-5 text-center mb-4">
                            <div style={{ fontSize: '4rem', marginBottom: '0.5rem' }}>🎉</div>
                            <h2 style={{ fontWeight: 800 }}>Interview Complete!</h2>
                            <div style={{
                                fontSize: '5rem', fontWeight: 900, color: scoreColor(result.overall_score),
                                textShadow: `0 0 40px ${scoreColor(result.overall_score)}66`, lineHeight: 1
                            }}>
                                {result.overall_score}
                            </div>
                            <p style={{ color: '#64748b', fontSize: '1rem' }}>out of 10</p>
                            <div style={{ maxWidth: 400, margin: '0.75rem auto' }}>
                                <div style={{ background: '#334155', height: 12, borderRadius: 20, overflow: 'hidden' }}>
                                    <div style={{
                                        height: '100%', borderRadius: 20,
                                        background: scoreColor(result.overall_score),
                                        width: `${result.overall_score * 10}%`, transition: 'width 1s ease'
                                    }} />
                                </div>
                            </div>
                        </div>

                        <h4 style={{ fontWeight: 700, marginBottom: '1.25rem' }}>📋 Detailed Feedback</h4>

                        {result.feedback.map((f, idx) => {
                            const nlp = f.nlp_analysis;
                            return (
                                <div key={idx} className="card p-4 mb-3">
                                    <p style={{ fontWeight: 600, marginBottom: '0.75rem', color: '#e2e8f0' }}>
                                        Q{f.question_index + 1}. {f.question}
                                    </p>

                                    {/* User answer */}
                                    <div className="user-answer-box mb-3">
                                        <small style={{
                                            textTransform: 'uppercase', fontSize: '0.7rem', color: '#475569',
                                            fontWeight: 700, display: 'block', marginBottom: 4
                                        }}>Your Answer</small>
                                        "{f.user_answer || 'No answer provided'}"
                                    </div>

                                    {/* Score */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                                        <span style={{ fontSize: '1.5rem', fontWeight: 800, color: scoreColor(f.score) }}>
                                            {f.score}<span style={{ fontSize: '0.85rem', color: '#64748b' }}>/10</span>
                                        </span>
                                        <div style={{ flex: 1, background: '#334155', height: 8, borderRadius: 20 }}>
                                            <div style={{
                                                height: '100%', borderRadius: 20,
                                                background: scoreColor(f.score), width: `${f.score * 10}%`
                                            }} />
                                        </div>
                                    </div>

                                    {/* AI Feedback */}
                                    <div className="ai-feedback-box mb-3">
                                        <strong>💬 AI Feedback: </strong>{f.feedback}
                                    </div>

                                    {/* NLP Panel */}
                                    {nlp && nlp.word_count > 0 && (
                                        <div className="nlp-panel">
                                            <strong style={{ display: 'block', marginBottom: '0.75rem', fontSize: '0.9rem' }}>
                                                🧠 Speech Analysis
                                            </strong>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '0.5rem', marginBottom: '0.75rem' }}>
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

                                            {/* Fluency bar */}
                                            <div style={{ marginBottom: '0.5rem' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                                                    <small style={{ color: '#64748b' }}>Fluency</small>
                                                    <small style={{ color: scoreColor(nlp.fluency_score) }}>{nlp.fluency_score}/10</small>
                                                </div>
                                                <div style={{ background: '#334155', height: 5, borderRadius: 20 }}>
                                                    <div style={{
                                                        height: '100%', borderRadius: 20,
                                                        background: scoreColor(nlp.fluency_score),
                                                        width: `${nlp.fluency_score * 10}%`
                                                    }} />
                                                </div>
                                            </div>

                                            {/* Filler words */}
                                            {nlp.filler_words_found.length > 0 && (
                                                <div style={{ marginTop: '0.5rem' }}>
                                                    <small style={{ color: '#64748b' }}>Filler words: </small>
                                                    {nlp.filler_words_found.map((w, i) => (
                                                        <span key={i} style={{
                                                            background: 'rgba(245,158,11,0.15)',
                                                            color: '#fcd34d', border: '1px solid rgba(245,158,11,0.3)',
                                                            borderRadius: 6, padding: '1px 8px', fontSize: '0.78rem',
                                                            marginRight: 4, fontStyle: 'italic'
                                                        }}>"{w}"</span>
                                                    ))}
                                                </div>
                                            )}

                                            <small style={{ color: '#475569', display: 'block', marginTop: '0.4rem' }}>
                                                {nlp.sentence_count} sentence{nlp.sentence_count !== 1 ? 's' : ''} ·{' '}
                                                {nlp.avg_words_per_sentence} words/sentence
                                            </small>
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        <div style={{ display: 'flex', gap: '0.75rem', paddingBottom: '3rem', marginTop: '0.5rem' }}>
                            <button className="btn btn-glow" onClick={resetInterview}>🔁 New Interview</button>
                            <Link to="/dashboard" className="btn btn-glass">← Dashboard</Link>
                        </div>
                    </div>
                )}
            </Container>
        </div>
    );
}
