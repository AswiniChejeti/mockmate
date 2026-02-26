import { useState, useEffect, useRef } from 'react';
import { Container, Row, Col, Form, Button } from 'react-bootstrap';
import Navbar from '../../components/Navbar';
import { getProfile, updateProfile } from '../../api/profileApi';
import { uploadResume } from '../../api/resumeApi';
import { toast, loader, closeLoader, alert as swalAlert } from '../../utils/swal';

export default function ProfilePage() {
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    const [fullName, setFullName] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [password, setPassword] = useState('');
    const [showPwd, setShowPwd] = useState(false);

    const [uploadLoading, setUploadLoading] = useState(false);
    const fileInputRef = useRef(null);

    const fetchProfile = async () => {
        try {
            setLoading(true);
            const data = await getProfile();
            setProfile(data);
            setFullName(data.full_name || '');
            setPhoneNumber(data.phone_number || '');
        } catch {
            swalAlert('error', 'Failed to Load', 'Could not load profile data.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchProfile(); }, []);

    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        loader('Updating profile...');
        try {
            const updateData = {};
            if (fullName.trim() && fullName.trim() !== profile.full_name) updateData.full_name = fullName.trim();
            if (phoneNumber.trim() !== (profile.phone_number || '')) updateData.phone_number = phoneNumber.trim();
            if (password) updateData.password = password;

            if (Object.keys(updateData).length === 0) {
                closeLoader();
                toast('info', 'No changes detected.');
                return;
            }

            const updatedUser = await updateProfile(updateData);
            setProfile(updatedUser);
            setPassword('');
            closeLoader();
            toast('success', 'Profile updated successfully! 🎉');
        } catch (err) {
            closeLoader();
            toast('error', err.response?.data?.detail || 'Update failed.');
        }
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.type !== 'application/pdf') {
            toast('error', 'Please upload a PDF file only', 4000);
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            toast('error', 'File too large. Maximum size is 10MB', 4000);
            return;
        }

        setUploadLoading(true);
        loader('Uploading & analyzing your resume...');
        try {
            const res = await uploadResume(file);
            closeLoader();
            toast('success', `Resume uploaded! ${res.skills?.length || 0} skills found 🎉`, 4000);
        } catch (err) {
            closeLoader();
            toast('error', err.response?.data?.detail || 'Upload failed. Please try again.', 4000);
        } finally {
            setUploadLoading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    if (loading && !profile) {
        return (
            <div className="app-bg" style={{ minHeight: '100vh' }}>
                <Navbar />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: '1rem' }}>
                    <div className="spinner-border" style={{ color: '#6366f1', width: '3rem', height: '3rem' }} />
                    <p style={{ color: '#64748b' }}>Loading your profile...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="app-bg" style={{ minHeight: '100vh' }}>
            <Navbar />
            <Container className="pb-5">
                <div className="fade-in" style={{ marginBottom: '2rem' }}>
                    <h2 style={{ fontWeight: 800, fontSize: '1.8rem' }}>Profile Details 👤</h2>
                    <p style={{ color: '#64748b' }}>Manage your account settings and resume.</p>
                </div>

                <Row className="g-4">
                    <Col md={6}>
                        <div className="card p-4 h-100 fade-in">
                            <h5 style={{ fontWeight: 700, marginBottom: '1.25rem' }}>Personal Information</h5>
                            <Form onSubmit={handleUpdateProfile}>
                                <div className="mb-3">
                                    <label className="form-label" style={{ color: '#94a3b8' }}>Email Address (Read Only)</label>
                                    <input type="email" className="form-control" value={profile?.email || ''} readOnly disabled style={{ background: 'rgba(30, 41, 59, 0.5)' }} />
                                </div>
                                <div className="mb-3">
                                    <label className="form-label" style={{ color: '#94a3b8' }}>Full Name</label>
                                    <input type="text" className="form-control" value={fullName} onChange={e => setFullName(e.target.value)} />
                                </div>
                                <div className="mb-3">
                                    <label className="form-label" style={{ color: '#94a3b8' }}>Phone Number</label>
                                    <input type="text" className="form-control" placeholder="123-456-7890" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} />
                                </div>
                                <div className="mb-4">
                                    <label className="form-label" style={{ color: '#94a3b8' }}>New Password (Optional)</label>
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            type={showPwd ? 'text' : 'password'}
                                            className="form-control"
                                            placeholder="Leave blank to keep current password"
                                            value={password}
                                            onChange={e => setPassword(e.target.value)}
                                            style={{ paddingRight: '3rem' }}
                                        />
                                        <button type="button" onClick={() => setShowPwd(s => !s)}
                                            style={{
                                                position: 'absolute', right: '0.75rem', top: '50%',
                                                transform: 'translateY(-50%)', background: 'none',
                                                border: 'none', cursor: 'pointer', fontSize: '1rem', color: '#94a3b8'
                                            }}>
                                            {showPwd ? '🙈' : '👁️'}
                                        </button>
                                    </div>
                                </div>
                                <Button type="submit" className="btn-glow w-100">Save Changes</Button>
                            </Form>
                        </div>
                    </Col>
                    <Col md={6}>
                        <div className="card p-4 h-100 fade-in-delay-1">
                            <h5 style={{ fontWeight: 700, marginBottom: '1.25rem' }}>📄 Resume Management</h5>
                            <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                                Your resume is used to customize your mock interviews. You can update it anytime below.
                            </p>
                            <div className="upload-zone mx-auto mb-4" onClick={() => fileInputRef.current.click()}>
                                {uploadLoading
                                    ? <><div className="spinner-border spinner-border-sm" style={{ color: '#6366f1' }} /><p style={{ marginTop: '0.5rem', color: '#64748b' }}>Uploading...</p></>
                                    : <>
                                        <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📁</div>
                                        <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Click to update your resume</p>
                                        <small style={{ color: '#64748b' }}>PDF only · Max 10MB</small>
                                    </>
                                }
                            </div>
                            <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept=".pdf" onChange={handleFileChange} />
                        </div>
                    </Col>
                </Row>
            </Container>
        </div>
    );
}
