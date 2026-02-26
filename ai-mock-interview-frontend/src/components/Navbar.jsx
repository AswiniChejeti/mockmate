import { Navbar as BsNavbar, Nav, Container } from 'react-bootstrap';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { confirm, toast } from '../utils/swal';

export default function Navbar() {
    const { logoutUser } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const handleLogout = async () => {
        const result = await confirm('Sign Out?', 'Are you sure you want to log out?', 'Sign Out');
        if (result.isConfirmed) {
            logoutUser();
            toast('success', 'Logged out successfully');
            navigate('/login');
        }
    };

    const isActive = (path) => location.pathname === path;

    return (
        <BsNavbar expand="lg" className="app-navbar mb-4">
            <Container>
                <BsNavbar.Brand as={Link} to="/dashboard">
                    🎯 MockMate
                </BsNavbar.Brand>
                <BsNavbar.Toggle aria-controls="main-nav" style={{ borderColor: 'rgba(255,255,255,0.2)' }} />
                <BsNavbar.Collapse id="main-nav">
                    <Nav className="me-auto gap-1">
                        <Nav.Link as={Link} to="/dashboard" className={isActive('/dashboard') ? 'active' : ''}>
                            📊 Dashboard
                        </Nav.Link>
                        <Nav.Link as={Link} to="/assessment" className={isActive('/assessment') ? 'active' : ''}>
                            🧠 Assessment
                        </Nav.Link>
                        <Nav.Link as={Link} to="/interview" className={isActive('/interview') ? 'active' : ''}>
                            🎤 Interview
                        </Nav.Link>
                        <Nav.Link as={Link} to="/profile" className={isActive('/profile') ? 'active' : ''}>
                            👤 Profile
                        </Nav.Link>
                    </Nav>
                    <Nav>
                        <button className="btn btn-glass btn-sm px-4" onClick={handleLogout}>
                            Sign Out
                        </button>
                    </Nav>
                </BsNavbar.Collapse>
            </Container>
        </BsNavbar>
    );
}
