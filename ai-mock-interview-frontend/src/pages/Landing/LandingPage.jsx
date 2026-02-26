import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

/* ── AI / interview background scenes ──────────────────────────────────────
   We use beautiful CSS gradient illustrations instead of external image URLs
   to avoid CORS / fetch issues. Each "slide" is a rich gradient scene.       */
const SLIDES = [
    {
        gradient: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 40%, #0f172a 100%)',
        accent: 'rgba(99,102,241,0.35)',
        icon: '🤖',
        headline: 'AI-Powered Interviews',
        sub: 'Experience next-generation interview coaching with real-time AI feedback',
    },
    {
        gradient: 'linear-gradient(135deg, #0a1628 0%, #0c2340 50%, #0f172a 100%)',
        accent: 'rgba(14,165,233,0.3)',
        icon: '🎤',
        headline: 'Speak, Don\'t Type',
        sub: 'Answer questions with your voice — just like a real interview',
    },
    {
        gradient: 'linear-gradient(135deg, #0f1923 0%, #0f2d1e 50%, #0f172a 100%)',
        accent: 'rgba(16,185,129,0.3)',
        icon: '📊',
        headline: 'NLP-Powered Analytics',
        sub: 'Get fluency scores, filler word detection, and vocabulary insights',
    },
    {
        gradient: 'linear-gradient(135deg, #1a0f2e 0%, #2d1b69 50%, #0f172a 100%)',
        accent: 'rgba(168,85,247,0.3)',
        icon: '🔐',
        headline: 'Secure Face Verification',
        sub: 'Biometric identity checks ensure every session is authentic',
    },
    {
        gradient: 'linear-gradient(135deg, #0f172a 0%, #1c1a0d 40%, #0f172a 100%)',
        accent: 'rgba(245,158,11,0.25)',
        icon: '🧠',
        headline: 'Adaptive Skill Assessment',
        sub: 'AI generates MCQs tailored to your actual resume skills',
    },
];

const FEATURES = [
    { icon: '📄', title: 'Resume Analysis', desc: 'Upload your PDF resume — AI extracts skills, technologies, and experience instantly.' },
    { icon: '🧠', title: 'Skill Assessment', desc: 'Auto-generated MCQs at your chosen difficulty level. Score yourself in minutes.' },
    { icon: '🎤', title: 'Mock Interview', desc: 'AI asks tailored questions. Answer by typing or speaking — scored in real time.' },
    { icon: '🔐', title: 'Face Verification', desc: 'Webcam face capture at signup and biometric check before each interview session.' },
    { icon: '📊', title: 'NLP Analytics', desc: 'Fluency scoring, filler word detection, vocabulary richness — per answer.' },
    { icon: '📈', title: 'Progress Dashboard', desc: 'Track your assessment and interview scores over time in one clean view.' },
];

const STEPS = [
    { n: '01', title: 'Sign Up & Capture Face', desc: 'Create your account. Take a quick webcam photo for biometric security.' },
    { n: '02', title: 'Upload Your Resume', desc: 'Drag & drop your PDF. AI extracts your skills automatically.' },
    { n: '03', title: 'Run a Skill Assessment', desc: 'Choose a skill and difficulty. Get AI-generated MCQs scored instantly.' },
    { n: '04', title: 'Start a Mock Interview', desc: 'AI generates resume-based questions. Speak or type your answers.' },
    { n: '05', title: 'Review Detailed Feedback', desc: 'Get per-answer AI feedback + NLP speech analysis + score breakdown.' },
];

export default function LandingPage() {
    const [currentSlide, setCurrentSlide] = useState(0);
    const intervalRef = useRef(null);

    // Auto-advance slides every 3.5 s
    useEffect(() => {
        intervalRef.current = setInterval(() => {
            setCurrentSlide(s => (s + 1) % SLIDES.length);
        }, 3500);
        return () => clearInterval(intervalRef.current);
    }, []);

    const slide = SLIDES[currentSlide];

    return (
        <div style={{ fontFamily: "'Inter', sans-serif", background: '#0f172a', color: '#e2e8f0', overflowX: 'hidden' }}>

            {/* ── Navbar ──────────────────────────────────────────────────── */}
            <nav style={{
                position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
                background: 'rgba(15,23,42,0.92)', backdropFilter: 'blur(20px)',
                borderBottom: '1px solid rgba(255,255,255,0.07)',
                padding: '0.85rem 2rem',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
                <div style={{
                    fontWeight: 800, fontSize: '1.25rem',
                    background: 'linear-gradient(135deg, #818cf8, #38bdf8)',
                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                }}>
                    🎯 MockMate
                </div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <Link to="/register" style={{
                        color: '#94a3b8', textDecoration: 'none', fontWeight: 500, fontSize: '0.9rem',
                    }}>Sign Up</Link>
                    <Link to="/login" style={{
                        background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                        color: '#fff', textDecoration: 'none', fontWeight: 600,
                        padding: '0.5rem 1.25rem', borderRadius: 10, fontSize: '0.9rem',
                        boxShadow: '0 0 20px rgba(99,102,241,0.4)',
                        transition: 'all 0.2s',
                    }}>Sign In →</Link>
                </div>
            </nav>

            {/* ── Hero + Slideshow ─────────────────────────────────────────── */}
            <section style={{
                minHeight: '100vh', position: 'relative',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden',
            }}>
                {/* Animated background slides */}
                {SLIDES.map((s, i) => (
                    <div key={i} style={{
                        position: 'absolute', inset: 0,
                        background: s.gradient,
                        transition: 'opacity 1s ease',
                        opacity: i === currentSlide ? 1 : 0,
                    }}>
                        {/* Grid dots */}
                        <div style={{
                            position: 'absolute', inset: 0,
                            backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.06) 1px, transparent 0)',
                            backgroundSize: '36px 36px',
                        }} />
                        {/* Accent orb */}
                        <div style={{
                            position: 'absolute', top: '20%', right: '15%',
                            width: 500, height: 500, borderRadius: '50%',
                            background: s.accent, filter: 'blur(80px)',
                            transition: 'background 1s ease',
                        }} />
                        <div style={{
                            position: 'absolute', bottom: '15%', left: '5%',
                            width: 350, height: 350, borderRadius: '50%',
                            background: s.accent, filter: 'blur(100px)', opacity: 0.7,
                        }} />
                    </div>
                ))}

                {/* Hero content */}
                <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', padding: '2rem 1rem', maxWidth: 800 }}>
                    {/* Slide icon */}
                    <div style={{
                        fontSize: '5rem', marginBottom: '0.5rem',
                        transition: 'all 0.5s',
                        filter: 'drop-shadow(0 0 30px rgba(99,102,241,0.6))',
                    }}>
                        {slide.icon}
                    </div>

                    {/* Badge */}
                    <div style={{
                        display: 'inline-block', marginBottom: '1.5rem',
                        background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)',
                        borderRadius: 20, padding: '0.3rem 1rem',
                        fontSize: '0.8rem', color: '#818cf8', fontWeight: 600, letterSpacing: '0.05em',
                    }}>
                        🚀 AI-POWERED CAREER PREPARATION
                    </div>

                    <h1 style={{
                        fontSize: 'clamp(2.2rem, 6vw, 4rem)', fontWeight: 900,
                        lineHeight: 1.1, marginBottom: '1rem',
                        transition: 'all 0.5s',
                    }}>
                        <span style={{
                            background: 'linear-gradient(135deg, #fff 0%, #818cf8 50%, #38bdf8 100%)',
                            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                        }}>
                            {slide.headline}
                        </span>
                    </h1>

                    <p style={{
                        fontSize: '1.15rem', color: '#94a3b8', marginBottom: '2.5rem',
                        lineHeight: 1.7, transition: 'all 0.5s',
                    }}>
                        {slide.sub}
                    </p>

                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <Link to="/register" style={{
                            background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                            color: '#fff', textDecoration: 'none', fontWeight: 700,
                            padding: '0.85rem 2.5rem', borderRadius: 12, fontSize: '1rem',
                            boxShadow: '0 0 30px rgba(99,102,241,0.5)',
                            display: 'inline-block', transition: 'all 0.2s',
                        }}>
                            Get Started Free →
                        </Link>
                        <Link to="/login" style={{
                            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
                            color: '#e2e8f0', textDecoration: 'none', fontWeight: 600,
                            padding: '0.85rem 2.5rem', borderRadius: 12, fontSize: '1rem',
                            display: 'inline-block',
                        }}>
                            Sign In
                        </Link>
                    </div>

                    {/* Slide indicators */}
                    <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center', marginTop: '2.5rem' }}>
                        {SLIDES.map((_, i) => (
                            <button key={i} onClick={() => setCurrentSlide(i)} style={{
                                width: i === currentSlide ? 24 : 8, height: 8,
                                borderRadius: 4, border: 'none', cursor: 'pointer',
                                background: i === currentSlide ? '#6366f1' : 'rgba(255,255,255,0.2)',
                                transition: 'all 0.3s',
                                padding: 0,
                            }} />
                        ))}
                    </div>
                </div>

                {/* Scroll hint */}
                <div style={{
                    position: 'absolute', bottom: '2rem', left: '50%', transform: 'translateX(-50%)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem',
                    color: '#475569', fontSize: '0.78rem', animation: 'fadeInUp 2s ease 1s both',
                }}>
                    <span>Scroll to explore</span>
                    <div style={{
                        width: 2, height: 40, background: 'linear-gradient(to bottom, #6366f1, transparent)',
                        borderRadius: 2, animation: 'pulse 2s infinite',
                    }} />
                </div>
            </section>

            {/* ── Stats bar ──────────────────────────────────────────────────── */}
            <section style={{ background: 'rgba(99,102,241,0.1)', borderTop: '1px solid rgba(99,102,241,0.2)', borderBottom: '1px solid rgba(99,102,241,0.2)', padding: '2rem 1rem' }}>
                <div style={{ maxWidth: 900, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1.5rem', textAlign: 'center' }}>
                    {[
                        { n: '10K+', label: 'Interviews Conducted' },
                        { n: '95%', label: 'User Satisfaction' },
                        { n: '50+', label: 'Skills Covered' },
                        { n: 'AI', label: 'Powered Feedback' },
                    ].map((s, i) => (
                        <div key={i}>
                            <div style={{ fontSize: '2rem', fontWeight: 900, background: 'linear-gradient(135deg, #818cf8, #38bdf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                                {s.n}
                            </div>
                            <div style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '0.2rem' }}>{s.label}</div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── Features grid ──────────────────────────────────────────────── */}
            <section style={{ padding: '5rem 1.5rem', maxWidth: 1100, margin: '0 auto' }}>
                <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
                    <span style={{ color: '#6366f1', fontWeight: 600, fontSize: '0.85rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>What We Offer</span>
                    <h2 style={{
                        fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', fontWeight: 800, margin: '0.5rem 0',
                        background: 'linear-gradient(135deg, #fff, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
                    }}>
                        Everything You Need to Land the Job
                    </h2>
                    <p style={{ color: '#64748b', maxWidth: 600, margin: '0 auto' }}>
                        From resume analysis to AI-powered mock interviews with biometric security — MockMate covers your entire preparation journey.
                    </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem' }}>
                    {FEATURES.map((f, i) => (
                        <div key={i} style={{
                            background: 'rgba(30,41,59,0.7)', border: '1px solid rgba(255,255,255,0.07)',
                            borderRadius: 16, padding: '1.75rem',
                            transition: 'all 0.3s', cursor: 'default',
                        }}
                            onMouseEnter={e => {
                                e.currentTarget.style.borderColor = 'rgba(99,102,241,0.5)';
                                e.currentTarget.style.transform = 'translateY(-4px)';
                                e.currentTarget.style.boxShadow = '0 12px 40px rgba(99,102,241,0.15)';
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)';
                                e.currentTarget.style.transform = 'none';
                                e.currentTarget.style.boxShadow = 'none';
                            }}>
                            <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>{f.icon}</div>
                            <h3 style={{ fontWeight: 700, marginBottom: '0.5rem', fontSize: '1rem', color: '#f1f5f9' }}>{f.title}</h3>
                            <p style={{ color: '#64748b', fontSize: '0.88rem', lineHeight: 1.6, margin: 0 }}>{f.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── How it works ─────────────────────────────────────────────── */}
            <section style={{ background: 'rgba(99,102,241,0.04)', borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '5rem 1.5rem' }}>
                <div style={{ maxWidth: 900, margin: '0 auto' }}>
                    <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
                        <span style={{ color: '#6366f1', fontWeight: 600, fontSize: '0.85rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Simple Process</span>
                        <h2 style={{
                            fontSize: 'clamp(1.8rem, 4vw, 2.5rem)', fontWeight: 800, margin: '0.5rem 0',
                            background: 'linear-gradient(135deg, #fff, #38bdf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
                        }}>
                            How MockMate Works
                        </h2>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {STEPS.map((s, i) => (
                            <div key={i} style={{
                                display: 'flex', alignItems: 'flex-start', gap: '1.25rem',
                                background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(255,255,255,0.06)',
                                borderRadius: 14, padding: '1.25rem 1.5rem',
                                transition: 'all 0.3s',
                            }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)'; e.currentTarget.style.background = 'rgba(99,102,241,0.08)'; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.background = 'rgba(30,41,59,0.6)'; }}>
                                <div style={{
                                    minWidth: 48, height: 48, borderRadius: 12,
                                    background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontWeight: 800, fontSize: '0.85rem', color: '#fff',
                                    boxShadow: '0 0 15px rgba(99,102,241,0.4)', flexShrink: 0,
                                }}>{s.n}</div>
                                <div>
                                    <h4 style={{ fontWeight: 700, marginBottom: '0.25rem', color: '#f1f5f9', fontSize: '0.95rem' }}>{s.title}</h4>
                                    <p style={{ color: '#64748b', margin: 0, fontSize: '0.88rem', lineHeight: 1.6 }}>{s.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── CTA ──────────────────────────────────────────────────────── */}
            <section style={{ padding: '6rem 1.5rem', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
                <div style={{
                    position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
                    width: 600, height: 600, borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)',
                    pointerEvents: 'none',
                }} />
                <div style={{ position: 'relative', zIndex: 1 }}>
                    <h2 style={{
                        fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 900, marginBottom: '1rem',
                        background: 'linear-gradient(135deg, #fff 0%, #818cf8 60%, #38bdf8 100%)',
                        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                    }}>
                        Ready to Ace Your Next Interview?
                    </h2>
                    <p style={{ color: '#64748b', fontSize: '1.1rem', marginBottom: '2.5rem', maxWidth: 500, margin: '0 auto 2.5rem' }}>
                        Join thousands of professionals who use MockMate to prepare smarter and land better jobs.
                    </p>
                    <Link to="/register" style={{
                        background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                        color: '#fff', textDecoration: 'none', fontWeight: 700,
                        padding: '1rem 3rem', borderRadius: 14, fontSize: '1.1rem',
                        boxShadow: '0 0 40px rgba(99,102,241,0.5)',
                        display: 'inline-block',
                    }}>
                        Start for Free 🚀
                    </Link>
                </div>
            </section>

            {/* ── Footer ───────────────────────────────────────────────────── */}
            <footer style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: '2rem', textAlign: 'center', color: '#334155', fontSize: '0.85rem' }}>
                © 2025 MockMate · AI-Powered Interview & Assessment Platform
            </footer>
        </div>
    );
}
