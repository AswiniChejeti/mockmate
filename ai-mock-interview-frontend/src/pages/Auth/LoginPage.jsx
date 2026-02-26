import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { login, resetPassword } from '../../api/authApi';
import { useAuth } from '../../context/AuthContext';
import { toast, loader, closeLoader } from '../../utils/swal';

export default function LoginPage() {
    // Mode toggle
    const [isResetting, setIsResetting] = useState(false);

    // Form states
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    // UI states
    const [showPwd, setShowPwd] = useState(false);
    const [showConfirmPwd, setShowConfirmPwd] = useState(false);
    const [errors, setErrors] = useState({});
    const [touched, setTouched] = useState({});

    const navigate = useNavigate();
    const { loginUser } = useAuth();

    // ── Validation ──────────────────────────────────────────────────────────
    const validate = () => {
        const e = {};
        if (!email.trim()) e.email = 'Email is required';
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Enter a valid email address';

        if (!password) {
            e.password = 'Password is required';
        } else if (isResetting && password.length < 8) {
            e.password = 'Password must be at least 8 characters';
        }

        if (isResetting) {
            if (!confirmPassword) e.confirmPassword = 'Please confirm your password';
            else if (confirmPassword !== password) e.confirmPassword = 'Passwords do not match';
        }

        return e;
    };

    const handleBlur = (field) => setTouched(t => ({ ...t, [field]: true }));

    const fieldState = (field) => {
        if (!touched[field]) return '';
        return validate()[field] ? 'is-invalid' : 'is-valid';
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const fieldsToTouch = { email: true, password: true };
        if (isResetting) fieldsToTouch.confirmPassword = true;
        setTouched(fieldsToTouch);

        const errs = validate();
        if (Object.keys(errs).length) return;
        setErrors({});

        if (isResetting) {
            // Reset Password Flow
            loader('Resetting password...');
            try {
                const data = await resetPassword(email, password);
                closeLoader();
                toast('success', data.message || 'Password reset successfully!');
                setIsResetting(false);
                setPassword('');
                setConfirmPassword('');
                setTouched({});
            } catch (err) {
                closeLoader();
                toast('error', err.message || 'Password reset failed.', 4000);
            }
        } else {
            // Login Flow
            loader('Signing you in...');
            try {
                const data = await login(email, password);
                closeLoader();
                loginUser(data.access_token);
                toast('success', 'Welcome back! 👋');
                navigate('/dashboard');
            } catch (err) {
                closeLoader();
                toast('error', err.message || 'Invalid email or password.', 4000);
            }
        }
    };

    // Toggle between Login and Reset modes
    const toggleMode = () => {
        setIsResetting(!isResetting);
        setErrors({});
        setTouched({});
        setPassword('');
        setConfirmPassword('');
    };

    return (
        <div className="auth-bg">
            <div style={{ width: '100%', maxWidth: '420px', position: 'relative', zIndex: 1 }}>
                {/* Header */}
                <div className="text-center mb-6" style={{ marginBottom: '1.5rem' }}>
                    <div style={{ fontSize: '3.5rem', marginBottom: '0.5rem' }}>🎯</div>
                    <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: 0 }} className="text-gradient">MockMate</h1>
                    <p style={{ color: '#64748b', marginTop: '0.25rem', fontSize: '0.9rem' }}>
                        Your AI-powered interview coach
                    </p>
                </div>

                {/* Card */}
                <div className="glass-card p-4">
                    <h4 style={{ fontWeight: 700, marginBottom: '1.5rem', textAlign: 'center' }}>
                        {isResetting ? 'Reset Password' : 'Sign In'}
                    </h4>

                    <form onSubmit={handleSubmit} noValidate>
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
                            {touched.email && validate().email && (
                                <div className="invalid-feedback d-block">{validate().email}</div>
                            )}
                        </div>

                        {/* Password / New Password */}
                        <div className="mb-3">
                            <div className="d-flex justify-content-between align-items-center">
                                <label className="form-label mb-0">
                                    {isResetting ? 'New Password' : 'Password'}
                                </label>
                                {!isResetting && (
                                    <button
                                        type="button"
                                        onClick={toggleMode}
                                        style={{ background: 'none', border: 'none', color: '#818cf8', fontSize: '0.85rem', fontWeight: 600 }}
                                    >
                                        Forgot Password?
                                    </button>
                                )}
                            </div>
                            <div style={{ position: 'relative', marginTop: '0.5rem' }}>
                                <input
                                    type={showPwd ? 'text' : 'password'}
                                    className={`form-control ${fieldState('password')}`}
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    onBlur={() => handleBlur('password')}
                                    style={{ paddingRight: '3rem' }}
                                />
                                <button type="button" onClick={() => setShowPwd(s => !s)}
                                    style={{
                                        position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)',
                                        background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem'
                                    }}>
                                    {showPwd ? '🙈' : '👁️'}
                                </button>
                            </div>
                            {touched.password && validate().password && (
                                <div className="invalid-feedback d-block">{validate().password}</div>
                            )}
                        </div>

                        {/* Confirm Password (Only for Reset) */}
                        {isResetting && (
                            <div className="mb-4">
                                <label className="form-label">Confirm New Password</label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type={showConfirmPwd ? 'text' : 'password'}
                                        className={`form-control ${fieldState('confirmPassword')}`}
                                        placeholder="••••••••"
                                        value={confirmPassword}
                                        onChange={e => setConfirmPassword(e.target.value)}
                                        onBlur={() => handleBlur('confirmPassword')}
                                        style={{ paddingRight: '3rem' }}
                                    />
                                    <button type="button" onClick={() => setShowConfirmPwd(s => !s)}
                                        style={{
                                            position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)',
                                            background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem'
                                        }}>
                                        {showConfirmPwd ? '🙈' : '👁️'}
                                    </button>
                                </div>
                                {touched.confirmPassword && validate().confirmPassword && (
                                    <div className="invalid-feedback d-block">{validate().confirmPassword}</div>
                                )}
                            </div>
                        )}

                        {!isResetting ? (
                            <button type="submit" className="btn btn-glow w-100" style={{ padding: '0.75rem', marginTop: '1rem' }}>
                                Sign In →
                            </button>
                        ) : (
                            <div className="d-flex gap-2" style={{ marginTop: '1.5rem' }}>
                                <button type="button" className="btn btn-secondary w-50" style={{ padding: '0.75rem' }} onClick={toggleMode}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-glow w-50" style={{ padding: '0.75rem' }}>
                                    Reset Password
                                </button>
                            </div>
                        )}
                    </form>

                    <div className="divider" style={{ margin: '1.5rem 0' }} />

                    <p style={{ textAlign: 'center', color: '#64748b', marginBottom: 0, fontSize: '0.9rem' }}>
                        New to MockMate?{' '}
                        <Link to="/register" style={{ color: '#818cf8', fontWeight: 600, textDecoration: 'none' }}>
                            Create an account
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
