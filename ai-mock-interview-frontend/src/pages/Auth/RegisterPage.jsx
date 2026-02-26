import { useState, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { register, login } from '../../api/authApi';
import { uploadResume } from '../../api/resumeApi';
import { useAuth } from '../../context/AuthContext';
import { toast, loader, closeLoader, alert as swalAlert } from '../../utils/swal';

// ── Validation helpers ────────────────────────────────────────────────────────
const ONLY_LETTERS = /^[A-Za-z\s'-]+$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const pwdChecks = [
    { label: 'At least 8 characters', test: p => p.length >= 8 },
    { label: 'At least one uppercase letter', test: p => /[A-Z]/.test(p) },
    { label: 'At least one digit (0–9)', test: p => /\d/.test(p) },
    { label: 'At least one special character', test: p => /[!@#$%^&*(),.?":{}|<>]/.test(p) },
];

function getStrength(p) {
    const met = pwdChecks.filter(c => c.test(p)).length;
    if (met <= 1) return { label: 'Weak', color: '#ef4444', width: '25%' };
    if (met === 2) return { label: 'Fair', color: '#f59e0b', width: '50%' };
    if (met === 3) return { label: 'Good', color: '#0ea5e9', width: '75%' };
    return { label: 'Strong', color: '#10b981', width: '100%' };
}

export default function RegisterPage() {
    const [step, setStep] = useState(1); // 1=form 2=face 3=resume

    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPwd, setShowPwd] = useState(false);
    const [errors, setErrors] = useState({});
    const [touched, setTouched] = useState({});

    // Face state
    const [cameraOn, setCameraOn] = useState(false);
    const [capturedImage, setCapturedImage] = useState(null);
    const [faceQualityMsg, setFaceQualityMsg] = useState('');

    // Resume state
    const [selectedResume, setSelectedResume] = useState(null);
    const [uploadLoading, setUploadLoading] = useState(false);
    const fileInputRef = useRef(null);

    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);
    const navigate = useNavigate();
    const { loginUser } = useAuth(); // Import from AuthContext

    // ── Form validation ───────────────────────────────────────────────────────
    const validate = () => {
        const e = {};
        if (!fullName.trim())
            e.fullName = 'Full name is required';
        else if (!ONLY_LETTERS.test(fullName.trim()))
            e.fullName = 'Name must contain letters only (no numbers or symbols)';
        else if (fullName.trim().length < 2)
            e.fullName = 'Name must be at least 2 characters';

        if (!email.trim())
            e.email = 'Email is required';
        else if (!EMAIL_RE.test(email))
            e.email = 'Enter a valid email address';

        const unmet = pwdChecks.filter(c => !c.test(password));
        if (!password) e.password = 'Password is required';
        else if (unmet.length) e.password = unmet[0].label + ' required';

        return e;
    };

    const handleBlur = (f) => setTouched(t => ({ ...t, [f]: true }));
    const fieldState = (f) => {
        if (!touched[f]) return '';
        return validate()[f] ? 'is-invalid' : 'is-valid';
    };

    // ── Camera helpers ────────────────────────────────────────────────────────
    const startCamera = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
            });
            streamRef.current = stream;
            if (videoRef.current) videoRef.current.srcObject = stream;
            setCameraOn(true);
            setFaceQualityMsg('');
        } catch {
            swalAlert('warning', 'Camera Unavailable', 'Camera access denied. You can skip face capture and use text passwords only.');
        }
    }, []);

    const stopCamera = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
        setCameraOn(false);
    }, []);

    // ── Face quality check ────────────────────────────────────────────────────
    const checkImageQuality = (canvas) => {
        const ctx = canvas.getContext('2d');
        const { width, height } = canvas;
        if (width < 200 || height < 150) return 'Image resolution too low. Move closer to the camera.';

        const data = ctx.getImageData(0, 0, width, height).data;
        let total = 0;
        for (let i = 0; i < data.length; i += 4) total += (data[i] + data[i + 1] + data[i + 2]) / 3;
        const avg = total / (data.length / 4);
        if (avg < 40) return '⚠️ Image is too dark. Improve lighting and try again.';
        if (avg > 220) return '⚠️ Image is too bright / overexposed. Reduce light and try again.';
        return null;
    };

    const capturePhoto = useCallback(() => {
        if (!videoRef.current || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const video = videoRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);

        const qualityErr = checkImageQuality(canvas);
        if (qualityErr) {
            setFaceQualityMsg(qualityErr);
            return;
        }
        setFaceQualityMsg('');
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setCapturedImage(dataUrl);
        stopCamera();
    }, [stopCamera]);

    const retake = useCallback(() => {
        setCapturedImage(null);
        setFaceQualityMsg('');
        startCamera();
    }, [startCamera]);

    // ── Step 1 → Step 2 ───────────────────────────────────────────────────────
    const goToFaceStep = (e) => {
        e.preventDefault();
        setTouched({ fullName: true, email: true, password: true });
        const errs = validate();
        if (Object.keys(errs).length) { setErrors(errs); return; }
        if (!selectedResume) {
            toast('error', 'Resume upload is mandatory to proceed.', 4000);
            return;
        }
        setErrors({});
        setStep(2);
        setTimeout(() => startCamera(), 300);
    };

    const handleResumeSelection = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.type !== 'application/pdf') {
            toast('error', 'Please upload a PDF file only', 4000);
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            toast('error', 'File too large. Maximum size is 10MB', 4000);
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }
        setSelectedResume(file);
    };

    // ── Step 2 → Complete Registration ────────────────────────────────────────
    const completeRegistration = async () => {
        if (!capturedImage) {
            toast('error', 'Face capture is required to finish registration.', 4000);
            return;
        }
        stopCamera();

        setUploadLoading(true);
        loader('Creating your account...');
        try {
            // 1. Register User (face image is mandatory)
            await register(fullName.trim(), email, password, capturedImage);

            // 2. Login User
            const data = await login(email, password);
            loginUser(data.access_token);

            // 3. Upload Resume (mandatory)
            loader('Account created! Analyzing your resume with AI... 🚀');
            const res = await uploadResume(selectedResume);
            closeLoader();
            toast('success', `Welcome! ${res.skills?.length || 0} skills found 🎉`, 4000);

            navigate('/dashboard');
        } catch (err) {
            closeLoader();
            const msg = err.response?.data?.detail || err.message || 'Registration failed. Please try again.';
            toast('error', msg, 5000);
        } finally {
            setUploadLoading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };


    const strength = password ? getStrength(password) : null;

    return (
        <div className="auth-bg">
            <div style={{ width: '100%', maxWidth: '480px', position: 'relative', zIndex: 1 }}>
                {/* Header */}
                <div className="text-center" style={{ marginBottom: '1.5rem' }}>
                    <div style={{ fontSize: '3rem' }}>🎯</div>
                    <h1 style={{ fontSize: '1.8rem', fontWeight: 800 }} className="text-gradient">MockMate</h1>
                    <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Create your account</p>
                </div>

                <div className="glass-card p-4">
                    {/* Step indicator */}
                    <div className="step-indicator">
                        <div className={`step-dot ${step === 1 ? 'active' : 'done'}`}>1</div>
                        <div className="step-line" />
                        <div className={`step-dot ${step === 2 ? 'active' : 'pending'}`}>2</div>
                    </div>

                    {/* ── Step 1: Form ──────────────────────────────────────── */}
                    {step === 1 && (
                        <form onSubmit={goToFaceStep} noValidate>
                            <h5 style={{ fontWeight: 700, marginBottom: '1.25rem', textAlign: 'center' }}>Your Details</h5>

                            {/* Full Name */}
                            <div className="mb-3">
                                <label className="form-label">Full Name</label>
                                <input
                                    type="text"
                                    className={`form-control ${fieldState('fullName')}`}
                                    placeholder="John Doe"
                                    value={fullName}
                                    onChange={e => {
                                        const v = e.target.value;
                                        if (/\d/.test(v)) return;
                                        setFullName(v);
                                    }}
                                    onBlur={() => handleBlur('fullName')}
                                />
                                {touched.fullName && errors.fullName && (
                                    <div className="invalid-feedback d-block">{errors.fullName}</div>
                                )}
                                {!errors.fullName && touched.fullName && (
                                    <div className="valid-feedback d-block">Looks good!</div>
                                )}
                            </div>

                            {/* Email */}
                            <div className="mb-3">
                                <label className="form-label">Email Address</label>
                                <input
                                    type="email"
                                    className={`form-control ${fieldState('email')}`}
                                    placeholder="you@example.com"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    onBlur={() => handleBlur('email')}
                                />
                                {touched.email && errors.email && (
                                    <div className="invalid-feedback d-block">{errors.email}</div>
                                )}
                            </div>

                            {/* Password */}
                            <div className="mb-3">
                                <label className="form-label">Password</label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type={showPwd ? 'text' : 'password'}
                                        className={`form-control ${fieldState('password')}`}
                                        placeholder="Min 8 chars, include A-Z, 0-9, symbol"
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        onBlur={() => handleBlur('password')}
                                        style={{ paddingRight: '3rem' }}
                                    />
                                    <button type="button" onClick={() => setShowPwd(s => !s)}
                                        style={{
                                            position: 'absolute', right: '0.75rem', top: '50%',
                                            transform: 'translateY(-50%)', background: 'none',
                                            border: 'none', cursor: 'pointer', fontSize: '1rem'
                                        }}>
                                        {showPwd ? '🙈' : '👁️'}
                                    </button>
                                </div>

                                {/* Strength bar */}
                                {password && (
                                    <div className="mt-2">
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                            <small style={{ color: '#64748b' }}>Strength</small>
                                            <small style={{ color: strength.color, fontWeight: 600 }}>{strength.label}</small>
                                        </div>
                                        <div style={{ background: '#334155', borderRadius: 4, height: 4 }}>
                                            <div className="pwd-strength-bar" style={{ width: strength.width, background: strength.color, height: '100%' }} />
                                        </div>
                                    </div>
                                )}

                                {/* Requirements */}
                                {(password || touched.password) && (
                                    <div className="mt-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px' }}>
                                        {pwdChecks.map((c, i) => (
                                            <div key={i} className={`pwd-req ${c.test(password) ? 'met' : ''}`}>
                                                {c.test(password) ? '✓' : '○'} {c.label}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {touched.password && errors.password && !pwdChecks.every(c => c.test(password)) && (
                                    <div className="invalid-feedback d-block">{errors.password}</div>
                                )}
                            </div>

                            {/* Resume Upload (Required) */}
                            <div className="mb-4">
                                <label className="form-label">Resume (Required)</label>
                                <div style={{
                                    border: '1px dashed #475569', borderRadius: '8px',
                                    padding: '0.75rem', textAlign: 'center', cursor: 'pointer',
                                    background: 'rgba(30, 41, 59, 0.5)'
                                }} onClick={() => fileInputRef.current.click()}>
                                    {selectedResume ? (
                                        <div>
                                            <div style={{ color: '#10b981', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                                                ✓ {selectedResume.name}
                                            </div>
                                            <div style={{ color: '#94a3b8', fontSize: '0.75rem', textDecoration: 'underline' }}>
                                                Click to re-select resume
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                                            📄 Click to attach PDF resume (Max 10MB)
                                        </div>
                                    )}
                                </div>
                                <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept=".pdf" onChange={handleResumeSelection} />
                                <small style={{ color: '#64748b', fontSize: '0.75rem', display: 'block', marginTop: '4px' }}>
                                    AI will automatically analyze this to personalize your mock interviews.
                                </small>
                            </div>

                            <button type="submit" className="btn btn-glow w-100" style={{ padding: '0.75rem', marginTop: '0.5rem' }}>
                                Next → Step 2 (Face Capture)
                            </button>
                        </form>
                    )}

                    {/* ── Step 2: Face Capture ───────────────────────────────── */}
                    {step === 2 && (
                        <div>
                            <h5 style={{ fontWeight: 700, marginBottom: '0.25rem', textAlign: 'center' }}>📸 Face Registration</h5>
                            <p style={{ textAlign: 'center', color: '#64748b', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                                We'll use this to verify your identity during interviews
                            </p>

                            <div className={`camera-box mx-auto mb-3 ${cameraOn ? 'recording' : capturedImage ? 'verified' : ''}`}
                                style={{ width: 320, height: 240 }}>
                                <video ref={videoRef} autoPlay playsInline muted
                                    style={{
                                        width: '100%', height: '100%', objectFit: 'cover',
                                        display: cameraOn && !capturedImage ? 'block' : 'none'
                                    }} />
                                {capturedImage && (
                                    <img src={capturedImage} alt="Captured"
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                )}
                                {!cameraOn && !capturedImage && (
                                    <div style={{
                                        width: '100%', height: '100%', display: 'flex',
                                        alignItems: 'center', justifyContent: 'center', color: '#64748b'
                                    }}>
                                        <div style={{ textAlign: 'center' }}>
                                            <div style={{ fontSize: '2.5rem' }}>📷</div>
                                            <small>Camera off</small>
                                        </div>
                                    </div>
                                )}
                                {cameraOn && <div className="live-badge">● LIVE</div>}
                                {capturedImage && (
                                    <div style={{
                                        position: 'absolute', top: 10, right: 10,
                                        background: 'rgba(16,185,129,0.85)', color: 'white',
                                        fontSize: '11px', padding: '3px 10px', borderRadius: '20px', fontWeight: 600
                                    }}>
                                        ✓ Captured
                                    </div>
                                )}
                            </div>
                            <canvas ref={canvasRef} style={{ display: 'none' }} />

                            {faceQualityMsg && (
                                <div style={{
                                    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                                    borderRadius: 8, padding: '0.6rem 1rem', marginBottom: '0.75rem',
                                    color: '#fca5a5', fontSize: '0.85rem', textAlign: 'center'
                                }}>
                                    {faceQualityMsg}
                                </div>
                            )}

                            {cameraOn && !capturedImage && (
                                <div style={{
                                    background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)',
                                    borderRadius: 8, padding: '0.6rem 1rem', marginBottom: '0.75rem',
                                    color: '#94a3b8', fontSize: '0.8rem'
                                }}>
                                    💡 Tips: Good lighting · Face the camera directly · Avoid shadows
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                                {!cameraOn && !capturedImage && (
                                    <button className="btn btn-glass" onClick={startCamera}>📷 Start Camera</button>
                                )}
                                {cameraOn && !capturedImage && (
                                    <button className="btn btn-glow-success btn-glow" onClick={capturePhoto}>📸 Capture Photo</button>
                                )}
                                {capturedImage && (
                                    <>
                                        <button className="btn btn-glass" onClick={retake}>🔄 Retake</button>
                                        <button className="btn btn-glow" onClick={completeRegistration}>
                                            Finish Registration 🎉
                                        </button>
                                    </>
                                )}
                            </div>

                            <div style={{ textAlign: 'center', marginTop: '0.75rem' }}>
                                <button className="btn btn-link btn-sm" style={{ color: '#64748b' }}
                                    onClick={() => { stopCamera(); setStep(1); }}>
                                    ← Back to Details
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 1 && (
                        <>
                            <div className="divider" />
                            <p style={{ textAlign: 'center', color: '#64748b', marginBottom: 0, fontSize: '0.9rem' }}>
                                Already have an account?{' '}
                                <Link to="/login" style={{ color: '#818cf8', fontWeight: 600, textDecoration: 'none' }}>Sign in</Link>
                            </p>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
