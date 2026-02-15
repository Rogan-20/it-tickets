import { useState, useEffect } from 'react';

export default function Settings({ addToast, authFetch }) {
    const [emailConfig, setEmailConfig] = useState({
        host: '', port: '993', user: '', password: '', tls: true,
        folder: 'INBOX', poll_interval: '2', mark_read: true
    });
    const [status, setStatus] = useState({});
    const [testing, setTesting] = useState(false);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);

    const fetchStatus = () => {
        authFetch('/api/settings/email')
            .then(r => r.json())
            .then(s => {
                setStatus(s);
                if (s.host) {
                    setEmailConfig(prev => ({
                        ...prev,
                        host: s.host || '',
                        user: s.user || '',
                        folder: s.folder || 'INBOX',
                        poll_interval: s.interval || '2'
                    }));
                }
                setLoading(false);
            })
            .catch(() => setLoading(false));
    };

    useEffect(() => { fetchStatus(); }, []);

    const saveConfig = async () => {
        setSaving(true);
        try {
            const res = await authFetch('/api/settings/email', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(emailConfig)
            });
            const data = await res.json();
            if (res.ok) {
                addToast('Email settings saved!', 'success');
                fetchStatus();
            } else {
                addToast(data.error || 'Failed to save', 'error');
            }
        } catch {
            addToast('Network error', 'error');
        }
        setSaving(false);
    };

    const testConnection = async () => {
        setTesting(true);
        try {
            const res = await authFetch('/api/settings/email/test', { method: 'POST' });
            const data = await res.json();
            if (data.error) {
                addToast(`Connection failed: ${data.error}`, 'error');
            } else {
                addToast(data.message || `Fetched ${data.fetched} emails`, 'success');
            }
        } catch {
            addToast('Connection test failed', 'error');
        }
        setTesting(false);
        fetchStatus();
    };

    const togglePolling = async (action) => {
        try {
            await authFetch('/api/settings/email/polling', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, interval: emailConfig.poll_interval })
            });
            addToast(`Polling ${action === 'start' ? 'started' : 'stopped'}`, 'success');
            fetchStatus();
        } catch {
            addToast('Failed', 'error');
        }
    };

    if (loading) return <div className="page-body"><div className="loading"><div className="spinner" /></div></div>;

    return (
        <>
            <div className="page-header">
                <div>
                    <h1 className="page-title">⚙️ Settings</h1>
                    <p className="page-subtitle">Configure email integration and system settings</p>
                </div>
            </div>
            <div className="page-body">
                {/* Email Configuration */}
                <div className="card" style={{ maxWidth: 800 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                        <h3 className="card-title" style={{ margin: 0 }}>📧 Email Integration (IMAP)</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span className={`badge badge-${status.configured ? (status.polling ? 'open' : 'waiting') : 'closed'}`}>
                                {status.configured ? (status.polling ? '● Active' : '○ Configured') : '✕ Not configured'}
                            </span>
                            {status.pendingCount > 0 && (
                                <span className="badge badge-new">{status.pendingCount} pending</span>
                            )}
                        </div>
                    </div>

                    <div style={{ background: 'var(--surface-1)', padding: 16, borderRadius: 'var(--radius-md)', marginBottom: 20, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                        <strong>How it works:</strong> Connect your support email inbox (e.g. <code>support@yourcompany.com</code>). The system will poll for new emails every few minutes and add them to your <strong>Email Inbox</strong> page. From there, reception can review, edit, and convert them to tickets.
                        <br /><br />
                        <strong style={{ color: 'var(--text-bright)' }}>📧 For Exchange Server (on-premises):</strong> Use your Exchange server hostname (e.g. <code>mail.yourcompany.co.za</code>), port <code>993</code> with TLS. Your username is typically your full email address. IMAP must be enabled on the Exchange server — check with your IT admin if unsure.
                        <br /><br />
                        <strong>Other providers:</strong> Gmail (use App Password), Outlook 365, Yahoo, or any IMAP server.
                    </div>

                    <div className="form-row">
                        <div className="form-group" style={{ flex: 2 }}>
                            <label className="form-label">IMAP Server Host</label>
                            <input className="form-input" placeholder="imap.gmail.com"
                                value={emailConfig.host} onChange={e => setEmailConfig(c => ({ ...c, host: e.target.value }))} />
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                            <label className="form-label">Port</label>
                            <input className="form-input" type="number" placeholder="993"
                                value={emailConfig.port} onChange={e => setEmailConfig(c => ({ ...c, port: e.target.value }))} />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Email / Username</label>
                            <input className="form-input" placeholder="support@yourcompany.com" autoComplete="off"
                                value={emailConfig.user} onChange={e => setEmailConfig(c => ({ ...c, user: e.target.value }))} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Password / App Password</label>
                            <input className="form-input" type="password" placeholder="••••••••" autoComplete="new-password"
                                value={emailConfig.password} onChange={e => setEmailConfig(c => ({ ...c, password: e.target.value }))} />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Folder</label>
                            <input className="form-input" placeholder="INBOX"
                                value={emailConfig.folder} onChange={e => setEmailConfig(c => ({ ...c, folder: e.target.value }))} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Poll Interval (minutes)</label>
                            <select className="form-select" value={emailConfig.poll_interval}
                                onChange={e => setEmailConfig(c => ({ ...c, poll_interval: e.target.value }))}>
                                <option value="1">Every 1 minute</option>
                                <option value="2">Every 2 minutes</option>
                                <option value="5">Every 5 minutes</option>
                                <option value="10">Every 10 minutes</option>
                                <option value="15">Every 15 minutes</option>
                                <option value="30">Every 30 minutes</option>
                            </select>
                        </div>
                    </div>

                    <div className="form-row" style={{ marginBottom: 0 }}>
                        <div className="toggle-wrapper" style={{ marginBottom: 0 }}>
                            <div className={`toggle ${emailConfig.tls ? 'active' : ''}`}
                                onClick={() => setEmailConfig(c => ({ ...c, tls: !c.tls }))} />
                            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Use TLS/SSL (recommended)</span>
                        </div>
                        <div className="toggle-wrapper" style={{ marginBottom: 0 }}>
                            <div className={`toggle ${emailConfig.mark_read ? 'active' : ''}`}
                                onClick={() => setEmailConfig(c => ({ ...c, mark_read: !c.mark_read }))} />
                            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Mark imported emails as read</span>
                        </div>
                    </div>

                    <div style={{ marginTop: 24, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <button className="btn btn-primary" onClick={saveConfig} disabled={saving}>
                            {saving ? '⏳ Saving...' : '💾 Save Settings'}
                        </button>
                        <button className="btn btn-secondary" onClick={testConnection} disabled={testing || !emailConfig.host}>
                            {testing ? '⏳ Testing...' : '🔍 Test & Fetch Now'}
                        </button>
                        {status.configured && (
                            <>
                                {status.polling ? (
                                    <button className="btn btn-danger" onClick={() => togglePolling('stop')}>⏹️ Stop Polling</button>
                                ) : (
                                    <button className="btn btn-success" onClick={() => togglePolling('start')}>▶️ Start Polling</button>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* Quick Help */}
                <div className="card" style={{ maxWidth: 800, marginTop: 20 }}>
                    <h3 className="card-title" style={{ marginBottom: 16 }}>📋 Common Email Server Settings</h3>
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr><th>Provider</th><th>IMAP Host</th><th>Port</th><th>Notes</th></tr>
                            </thead>
                            <tbody>
                                <tr style={{ background: 'rgba(37, 99, 235, 0.05)' }}><td><strong>Exchange (on-prem)</strong></td><td>mail.yourcompany.co.za</td><td>993</td><td>Full email as username, IMAP must be enabled</td></tr>
                                <tr><td>Outlook 365</td><td>outlook.office365.com</td><td>993</td><td>May require admin to enable IMAP and app password</td></tr>
                                <tr><td>Gmail</td><td>imap.gmail.com</td><td>993</td><td>Requires App Password (2FA enabled)</td></tr>
                                <tr><td>Yahoo</td><td>imap.mail.yahoo.com</td><td>993</td><td>Requires App Password</td></tr>
                                <tr><td>Custom</td><td>mail.yourdomain.com</td><td>993</td><td>Check with your IT provider</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </>
    );
}
