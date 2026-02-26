import { Modal, Button, Accordion } from 'react-bootstrap';

export default function HistoryModal({ show, onHide, type, data }) {
    if (!data) return null;

    const isInterview = type === 'interview';

    return (
        <Modal show={show} onHide={onHide} size="lg" centered>
            <Modal.Header closeButton style={{ backgroundColor: '#1e293b', borderBottom: '1px solid #334155' }}>
                <Modal.Title style={{ color: '#f8fafc', fontWeight: 700 }}>
                    {isInterview ? '🎤 Mock Interview Details' : '🧠 Assessment Details'}
                </Modal.Title>
            </Modal.Header>
            <Modal.Body style={{ backgroundColor: '#0f172a', color: '#cbd5e1', maxHeight: '75vh', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8', textTransform: 'uppercase' }}>Date Taken</p>
                        <p style={{ margin: 0, fontWeight: 600, color: '#f8fafc' }}>
                            {new Date(data.conducted_at || data.taken_at).toLocaleString()}
                        </p>
                    </div>
                    <div>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8', textTransform: 'uppercase' }}>Overall Score</p>
                        <p style={{
                            margin: 0, fontWeight: 800, fontSize: '1.2rem',
                            color: (data.overall_score || data.score) >= 7 ? '#10b981' : (data.overall_score || data.score) >= 4 ? '#f59e0b' : '#ef4444'
                        }}>
                            {data.overall_score !== undefined ? data.overall_score : data.score}/10
                        </p>
                    </div>
                    {data.skill && (
                        <div>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8', textTransform: 'uppercase' }}>Skill Focus</p>
                            <p style={{ margin: 0, fontWeight: 600, color: '#38bdf8' }}>{data.skill}</p>
                        </div>
                    )}
                </div>

                {isInterview && data.video_url && (
                    <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
                        <h6 style={{ color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>
                            Session Recording
                        </h6>
                        <video
                            controls
                            src={`${import.meta.env.VITE_API_BASE_URL.replace('/api/v1', '')}${data.video_url}`}
                            style={{ width: '100%', maxWidth: '600px', borderRadius: '8px', border: '1px solid #334155', backgroundColor: '#000' }}
                        >
                            Your browser does not support the video tag.
                        </video>
                    </div>
                )}

                <h6 style={{ color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>
                    {isInterview ? 'Question Breakdown & Feedback' : 'Question Breakdown & Correct Answers'}
                </h6>

                <Accordion className="custom-accordion">
                    {isInterview ? (
                        data.feedback?.map((fb, idx) => (
                            <Accordion.Item eventKey={idx.toString()} key={idx} style={{ backgroundColor: '#1e293b', border: '1px solid #334155', marginBottom: '0.5rem', borderRadius: '8px' }}>
                                <Accordion.Header>
                                    <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                                        <span style={{ fontWeight: 600, color: '#f8fafc', flex: 1 }}>Q{idx + 1}: {fb.question.substring(0, 60)}...</span>
                                        <span style={{
                                            padding: '4px 10px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 700,
                                            backgroundColor: fb.score >= 7 ? 'rgba(16,185,129,0.2)' : fb.score >= 4 ? 'rgba(245,158,11,0.2)' : 'rgba(239,68,68,0.2)',
                                            color: fb.score >= 7 ? '#34d399' : fb.score >= 4 ? '#fbbf24' : '#f87171'
                                        }}>
                                            Score: {fb.score}/10
                                        </span>
                                    </div>
                                </Accordion.Header>
                                <Accordion.Body style={{ borderTop: '1px solid #334155', backgroundColor: '#0f172a' }}>
                                    <p style={{ fontWeight: 600, color: '#e2e8f0', marginBottom: '0.5rem' }}>Question:</p>
                                    <p style={{ color: '#cbd5e1', fontSize: '0.95rem', marginBottom: '1.25rem' }}>{fb.question}</p>

                                    <p style={{ fontWeight: 600, color: '#e2e8f0', marginBottom: '0.5rem' }}>Your Answer:</p>
                                    <div style={{ padding: '1rem', backgroundColor: '#1e293b', borderRadius: '8px', marginBottom: '1.25rem', borderLeft: '3px solid #6366f1' }}>
                                        <p style={{ margin: 0, color: '#cbd5e1', fontStyle: fb.user_answer ? 'normal' : 'italic', fontSize: '0.95rem' }}>
                                            {fb.user_answer || "No answer provided"}
                                        </p>
                                    </div>

                                    <p style={{ fontWeight: 600, color: '#e2e8f0', marginBottom: '0.5rem' }}>AI Feedback:</p>
                                    <div style={{ padding: '1rem', backgroundColor: 'rgba(56,189,248,0.1)', borderRadius: '8px', borderLeft: '3px solid #38bdf8' }}>
                                        <p style={{ margin: 0, color: '#e0f2fe', fontSize: '0.95rem' }}>{fb.feedback}</p>
                                    </div>
                                </Accordion.Body>
                            </Accordion.Item>
                        ))
                    ) : (
                        data.questions_data?.map((q, idx) => {
                            const userAnswerObj = data.answers_data?.find(a => a.question_index === idx);
                            const userAnswer = userAnswerObj ? userAnswerObj.selected_answer : null;
                            const isCorrect = userAnswer?.toUpperCase() === q.correct_answer?.toUpperCase();

                            return (
                                <Accordion.Item eventKey={idx.toString()} key={idx} style={{ backgroundColor: '#1e293b', border: '1px solid #334155', marginBottom: '0.5rem', borderRadius: '8px' }}>
                                    <Accordion.Header>
                                        <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                                            <span style={{ fontWeight: 600, color: '#f8fafc', flex: 1 }}>Q{idx + 1}: {q.question.substring(0, 60)}...</span>
                                            <span style={{
                                                padding: '4px 10px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 700,
                                                backgroundColor: isCorrect ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)',
                                                color: isCorrect ? '#34d399' : '#f87171'
                                            }}>
                                                {isCorrect ? '✓ Correct' : '✗ Incorrect'}
                                            </span>
                                        </div>
                                    </Accordion.Header>
                                    <Accordion.Body style={{ borderTop: '1px solid #334155', backgroundColor: '#0f172a' }}>
                                        <p style={{ fontWeight: 600, color: '#e2e8f0', marginBottom: '0.75rem' }}>{q.question}</p>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
                                            {q.options.map(opt => {
                                                const isThisSelected = userAnswer?.toUpperCase() === opt.key.toUpperCase();
                                                const isThisCorrect = q.correct_answer?.toUpperCase() === opt.key.toUpperCase();

                                                let bgColor = '#1e293b';
                                                let borderColor = '#334155';

                                                if (isThisCorrect) {
                                                    bgColor = 'rgba(16,185,129,0.15)'; // Green for correct
                                                    borderColor = '#10b981';
                                                } else if (isThisSelected && !isThisCorrect) {
                                                    bgColor = 'rgba(239,68,68,0.15)';  // Red for wrong selection
                                                    borderColor = '#ef4444';
                                                }

                                                return (
                                                    <div key={opt.key} style={{
                                                        padding: '0.75rem', borderRadius: '6px', border: `1px solid ${borderColor}`, backgroundColor: bgColor,
                                                        display: 'flex', alignItems: 'center'
                                                    }}>
                                                        <span style={{ fontWeight: 700, marginRight: '1rem', width: '24px', color: '#94a3b8' }}>{opt.key}.</span>
                                                        <span style={{ color: '#e2e8f0' }}>{opt.value}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        <p style={{ fontWeight: 600, color: '#e2e8f0', marginBottom: '0.5rem' }}>Explanation:</p>
                                        <div style={{ padding: '1rem', backgroundColor: 'rgba(56,189,248,0.1)', borderRadius: '8px', borderLeft: '3px solid #38bdf8' }}>
                                            <p style={{ margin: 0, color: '#e0f2fe', fontSize: '0.95rem' }}>{q.explanation}</p>
                                        </div>
                                    </Accordion.Body>
                                </Accordion.Item>
                            );
                        })
                    )}
                </Accordion>

                {((isInterview && (!data.feedback || data.feedback.length === 0)) ||
                    (!isInterview && (!data.questions_data || data.questions_data.length === 0))) && (
                        <p style={{ textAlign: 'center', color: '#64748b', margin: '2rem 0' }}>No detailed breakdown available for this session.</p>
                    )}
            </Modal.Body>
            <Modal.Footer style={{ backgroundColor: '#1e293b', borderTop: '1px solid #334155' }}>
                <Button variant="secondary" onClick={onHide}>Close</Button>
            </Modal.Footer>
        </Modal>
    );
}
