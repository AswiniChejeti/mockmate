import { Navbar as BsNavbar, Nav, Container, Button } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
    const { logoutUser } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logoutUser();
        navigate('/login');
    };

    return (
        <BsNavbar bg="white" expand="lg" className="shadow-sm mb-4">
            <Container>
                <BsNavbar.Brand as={Link} to="/dashboard">🎯 AI Mock Interview</BsNavbar.Brand>
                <BsNavbar.Toggle aria-controls="basic-navbar-nav" />
                <BsNavbar.Collapse id="basic-navbar-nav">
                    <Nav className="me-auto">
                        <Nav.Link as={Link} to="/dashboard">Dashboard</Nav.Link>
                        <Nav.Link as={Link} to="/assessment">Assessment</Nav.Link>
                        <Nav.Link as={Link} to="/interview">Interview</Nav.Link>
                    </Nav>
                    <Nav>
                        <Button variant="outline-secondary" size="sm" onClick={handleLogout}>
                            Logout
                        </Button>
                    </Nav>
                </BsNavbar.Collapse>
            </Container>
        </BsNavbar>
    );
}
