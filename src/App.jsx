import { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, NavLink, useLocation, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import TicketList from './pages/TicketList';
import TicketCreate from './pages/TicketCreate';
import TicketDetail from './pages/TicketDetail';
import Companies from './pages/Companies';
import Techs from './pages/Techs';
import EmailInbox from './pages/EmailInbox';
import WhatsAppInbox from './pages/WhatsAppInbox';
import Settings from './pages/Settings';
import Login from './pages/Login';
import UserManagement from './pages/UserManagement';

// Authenticated fetch helper — attaches JWT token to all requests
function createAuthFetch(token, onUnauthorized) {
    return (url, options = {}) => {
        const headers = { ...options.headers };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        return fetch(url, { ...options, headers }).then(res => {
            if (res.status === 401) {
                onUnauthorized();
            }
            return res;
        });
    };
}

function AppContent() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [toasts, setToasts] = useState([]);
    const [currentUser, setCurrentUser] = useState(null);
    const [token, setToken] = useState(null);
    const [authChecked, setAuthChecked] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [passwordForm, setPasswordForm] = useState({ current_password: '', new_password: '', confirm: '' });
    const location = useLocation();

    const addToast = useCallback((message, type = 'success') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
    }, []);

    const handleLogout = useCallback(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setCurrentUser(null);
        setToken(null);
    }, []);

    const authFetch = useCallback(
        createAuthFetch(token, handleLogout),
        [token, handleLogout]
    );

    // Check for existing session on mount
    useEffect(() => {
        const savedToken = localStorage.getItem('token');
        const savedUser = localStorage.getItem('user');
        if (savedToken && savedUser) {
            setToken(savedToken);
            setCurrentUser(JSON.parse(savedUser));
            // Validate token
            fetch('/api/auth/me', {
                headers: { 'Authorization': `Bearer ${savedToken}` }
            }).then(r => {
                if (!r.ok) {
                    handleLogout();
                }
                return r.json();
            }).then(user => {
                if (user && user.id) {
                    setCurrentUser(user);
                }
            }).catch(() => {
                handleLogout();
            }).finally(() => setAuthChecked(true));
        } else {
            setAuthChecked(true);
        }
    }, []);

    const handleLogin = (user, newToken) => {
        setCurrentUser(user);
        setToken(newToken);
    };

    const changePassword = async () => {
        if (!passwordForm.current_password || !passwordForm.new_password) {
            addToast('Both fields are required', 'error'); return;
        }
        if (passwordForm.new_password !== passwordForm.confirm) {
            addToast('Passwords do not match', 'error'); return;
        }
        try {
            const res = await authFetch('/api/auth/password', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    current_password: passwordForm.current_password,
                    new_password: passwordForm.new_password
                })
            });
            const data = await res.json();
            if (!res.ok) { addToast(data.error || 'Failed', 'error'); return; }
            addToast('Password changed!', 'success');
            setShowPasswordModal(false);
            setPasswordForm({ current_password: '', new_password: '', confirm: '' });
        } catch { addToast('Network error', 'error'); }
    };

    const closeSidebar = () => setSidebarOpen(false);

    // Show loading while checking auth
    if (!authChecked) {
        return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
            <div className="spinner" />
        </div>;
    }

    // Not logged in — show login page
    if (!currentUser || !token) {
        return <Login onLogin={handleLogin} />;
    }

    const isAdmin = currentUser.role === 'admin';

    return (
        <div className="app-layout">
            <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
                <div className="sidebar-header">
                    <div className="sidebar-logo">🎫</div>
                    <span className="sidebar-title">IT Tickets</span>
                </div>
                <nav className="sidebar-nav">
                    <div className="nav-section-label">Main</div>
                    <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={closeSidebar} end>
                        <span className="nav-icon">📊</span> Dashboard
                    </NavLink>
                    <NavLink to="/tickets" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={closeSidebar}>
                        <span className="nav-icon">🎫</span> All Tickets
                    </NavLink>
                    <NavLink to="/tickets/new" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={closeSidebar}>
                        <span className="nav-icon">➕</span> New Ticket
                    </NavLink>

                    <div className="nav-section-label">Inbox</div>
                    <NavLink to="/email-inbox" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={closeSidebar}>
                        <span className="nav-icon">📧</span> Email Inbox
                    </NavLink>
                    <NavLink to="/whatsapp-inbox" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={closeSidebar}>
                        <span className="nav-icon">💬</span> WhatsApp Inbox
                    </NavLink>

                    <div className="nav-section-label">Manage</div>
                    <NavLink to="/companies" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={closeSidebar}>
                        <span className="nav-icon">🏢</span> Companies
                    </NavLink>
                    <NavLink to="/techs" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={closeSidebar}>
                        <span className="nav-icon">👨‍💻</span> Technicians
                    </NavLink>

                    {isAdmin && (
                        <>
                            <div className="nav-section-label">Admin</div>
                            <NavLink to="/users" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={closeSidebar}>
                                <span className="nav-icon">👥</span> Users
                            </NavLink>
                            <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={closeSidebar}>
                                <span className="nav-icon">⚙️</span> Settings
                            </NavLink>
                        </>
                    )}
                </nav>

                {/* User info at bottom of sidebar */}
                <div style={{
                    padding: '12px 16px', borderTop: '1px solid var(--border-color)',
                    marginTop: 'auto', fontSize: 13
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                        <div style={{
                            width: 32, height: 32, borderRadius: '50%',
                            background: 'var(--primary)', color: '#fff',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 700, fontSize: 13, flexShrink: 0
                        }}>
                            {currentUser.display_name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-bright)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {currentUser.display_name}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{currentUser.role}</div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-secondary btn-sm" style={{ flex: 1, fontSize: 11 }}
                            onClick={() => setShowPasswordModal(true)}>🔑 Password</button>
                        <button className="btn btn-danger btn-sm" style={{ flex: 1, fontSize: 11 }}
                            onClick={handleLogout}>🚪 Logout</button>
                    </div>
                </div>
            </aside>

            {sidebarOpen && <div className="sidebar-overlay" onClick={closeSidebar} />}

            <main className="main-content">
                <Routes>
                    <Route path="/" element={<Dashboard addToast={addToast} authFetch={authFetch} />} />
                    <Route path="/tickets" element={<TicketList addToast={addToast} authFetch={authFetch} />} />
                    <Route path="/tickets/new" element={<TicketCreate addToast={addToast} authFetch={authFetch} />} />
                    <Route path="/tickets/:id" element={<TicketDetail addToast={addToast} authFetch={authFetch} currentUser={currentUser} />} />
                    <Route path="/companies" element={<Companies addToast={addToast} authFetch={authFetch} />} />
                    <Route path="/techs" element={<Techs addToast={addToast} authFetch={authFetch} />} />
                    <Route path="/email-inbox" element={<EmailInbox addToast={addToast} authFetch={authFetch} />} />
                    <Route path="/whatsapp-inbox" element={<WhatsAppInbox addToast={addToast} authFetch={authFetch} />} />
                    {isAdmin && (
                        <>
                            <Route path="/settings" element={<Settings addToast={addToast} authFetch={authFetch} />} />
                            <Route path="/users" element={<UserManagement addToast={addToast} authFetch={authFetch} />} />
                        </>
                    )}
                    <Route path="*" element={<Navigate to="/" />} />
                </Routes>
            </main>

            {/* Mobile menu button */}
            <button className="mobile-menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}
                style={{ position: 'fixed', top: 12, left: 12, zIndex: 997 }}>
                ☰
            </button>

            {/* Toast container */}
            <div className="toast-container">
                {toasts.map(t => (
                    <div key={t.id} className={`toast toast-${t.type}`}>{t.message}</div>
                ))}
            </div>

            {/* Change Password Modal */}
            {showPasswordModal && (
                <div className="modal-overlay" onClick={() => setShowPasswordModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
                        <div className="modal-header">
                            <h2 className="modal-title">Change Password</h2>
                            <button className="modal-close" onClick={() => setShowPasswordModal(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label className="form-label">Current Password</label>
                                <input className="form-input" type="password" value={passwordForm.current_password}
                                    onChange={e => setPasswordForm(f => ({ ...f, current_password: e.target.value }))}
                                    autoComplete="current-password" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">New Password</label>
                                <input className="form-input" type="password" value={passwordForm.new_password}
                                    onChange={e => setPasswordForm(f => ({ ...f, new_password: e.target.value }))}
                                    autoComplete="new-password" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Confirm New Password</label>
                                <input className="form-input" type="password" value={passwordForm.confirm}
                                    onChange={e => setPasswordForm(f => ({ ...f, confirm: e.target.value }))}
                                    autoComplete="new-password" />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowPasswordModal(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={changePassword}>🔑 Change Password</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function App() {
    return (
        <BrowserRouter>
            <AppContent />
        </BrowserRouter>
    );
}
