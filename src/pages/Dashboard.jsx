import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Dashboard({ addToast, authFetch }) {
    const [data, setData] = useState({ tickets: [], stats: {} });
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        authFetch('/api/tickets?limit=10')
            .then(r => r.json())
            .then(d => { setData(d); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    const { stats } = data;

    const enableNotifications = async () => {
        try {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                const reg = await navigator.serviceWorker.ready;
                const res = await authFetch('/api/notifications/vapid-key');
                const { publicKey } = await res.json();
                const sub = await reg.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(publicKey)
                });
                await authFetch('/api/notifications/subscribe', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ endpoint: sub.endpoint, keys: sub.toJSON().keys, user_name: 'User' })
                });
                addToast('Notifications enabled! You\'ll get daily reminders.', 'success');
            }
        } catch (e) {
            addToast('Could not enable notifications', 'error');
        }
    };

    if (loading) return <div className="page-body"><div className="loading"><div className="spinner" /></div></div>;

    return (
        <>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Dashboard</h1>
                    <p className="page-subtitle">Overview of your IT tickets</p>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn btn-secondary" onClick={enableNotifications}>🔔 Enable Notifications</button>
                    <button className="btn btn-primary" onClick={() => navigate('/tickets/new')}>➕ New Ticket</button>
                </div>
            </div>
            <div className="page-body">
                <div className="stats-grid">
                    <div className="stat-card" onClick={() => navigate('/tickets?status=new')}>
                        <div className="stat-icon new">🆕</div>
                        <div>
                            <div className="stat-value">{stats.new_count || 0}</div>
                            <div className="stat-label">New</div>
                        </div>
                    </div>
                    <div className="stat-card" onClick={() => navigate('/tickets?status=open')}>
                        <div className="stat-icon open">📂</div>
                        <div>
                            <div className="stat-value">{stats.open || 0}</div>
                            <div className="stat-label">Open / In Progress</div>
                        </div>
                    </div>
                    <div className="stat-card" onClick={() => navigate('/tickets?priority=critical')}>
                        <div className="stat-icon critical">🔴</div>
                        <div>
                            <div className="stat-value">{stats.critical || 0}</div>
                            <div className="stat-label">Critical</div>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon waiting">⏳</div>
                        <div>
                            <div className="stat-value">{stats.waiting || 0}</div>
                            <div className="stat-label">Waiting</div>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon resolved">✅</div>
                        <div>
                            <div className="stat-value">{stats.resolved_today || 0}</div>
                            <div className="stat-label">Resolved Today</div>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon total">📋</div>
                        <div>
                            <div className="stat-value">{stats.total || 0}</div>
                            <div className="stat-label">Total</div>
                        </div>
                    </div>
                </div>

                <div className="card">
                    <div className="card-header">
                        <h2 className="card-title">Recent Tickets</h2>
                        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/tickets')}>View All →</button>
                    </div>
                    {data.tickets.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-icon">🎫</div>
                            <div className="empty-state-text">No tickets yet</div>
                            <div className="empty-state-sub">Create your first ticket to get started</div>
                        </div>
                    ) : (
                        <table className="ticket-table">
                            <thead>
                                <tr>
                                    <th>Ref</th>
                                    <th>Title</th>
                                    <th>Company</th>
                                    <th>Priority</th>
                                    <th>Status</th>
                                    <th>Tech</th>
                                    <th>Created</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.tickets.map(t => (
                                    <tr key={t.id} onClick={() => navigate(`/tickets/${t.id}`)}>
                                        <td><span className="ticket-ref">{t.ref_number}</span></td>
                                        <td className="ticket-title-cell">{t.title}</td>
                                        <td>{t.company_name || '—'}</td>
                                        <td><span className={`badge badge-${t.priority}`}>{t.priority}</span></td>
                                        <td><span className={`badge badge-${t.status}`}>{t.status.replace('_', ' ')}</span></td>
                                        <td>{t.tech_name ? <><span>{t.tech_name}</span> <span className={`badge badge-${t.tech_type}`} style={{ marginLeft: 4 }}>{t.tech_type}</span></> : '—'}</td>
                                        <td style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{new Date(t.created_at).toLocaleDateString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </>
    );
}

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
    return outputArray;
}
