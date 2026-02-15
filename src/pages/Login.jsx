import { useState } from 'react';

export default function Login({ onLogin }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!username || !password) { setError('Please enter username and password'); return; }

        setLoading(true);
        setError('');

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();

            if (!res.ok) {
                setError(data.error || 'Login failed');
                setLoading(false);
                return;
            }

            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            onLogin(data.user, data.token);
        } catch {
            setError('Network error — is the server running?');
        }
        setLoading(false);
    };

    return (
        <div style={{
            minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--bg-base)',
            padding: 20
        }}>
            <div style={{
                width: '100%', maxWidth: 400,
                background: 'var(--surface-0)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-color)',
                padding: '40px 32px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
            }}>
                <div style={{ textAlign: 'center', marginBottom: 32 }}>
                    <div style={{ fontSize: 48, marginBottom: 8 }}>🎫</div>
                    <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-bright)', margin: 0 }}>IT Tickets</h1>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>Sign in to your account</p>
                </div>

                <form onSubmit={handleSubmit}>
                    {error && (
                        <div style={{
                            background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)',
                            borderRadius: 'var(--radius-md)', padding: '10px 14px', marginBottom: 16,
                            fontSize: 13, color: '#ef4444'
                        }}>
                            {error}
                        </div>
                    )}

                    <div className="form-group">
                        <label className="form-label">Username</label>
                        <input className="form-input" type="text" value={username}
                            onChange={e => setUsername(e.target.value)}
                            placeholder="Enter username" autoFocus autoComplete="username" />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Password</label>
                        <input className="form-input" type="password" value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="Enter password" autoComplete="current-password" />
                    </div>

                    <button type="submit" className="btn btn-primary"
                        disabled={loading}
                        style={{ width: '100%', marginTop: 8, padding: '12px 0', fontSize: 14, fontWeight: 600 }}>
                        {loading ? '⏳ Signing in...' : '🔐 Sign In'}
                    </button>
                </form>
            </div>
        </div>
    );
}
