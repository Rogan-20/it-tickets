import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Dashboard({ addToast, authFetch, currentUser }) {
    const [data, setData] = useState({ tickets: [], stats: {} });
    const [loading, setLoading] = useState(true);
    const [companies, setCompanies] = useState([]);
    const [techs, setTechs] = useState([]);
    const navigate = useNavigate();

    // Filters
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [priorityFilter, setPriorityFilter] = useState('');
    const [companyFilter, setCompanyFilter] = useState('');
    const [techFilter, setTechFilter] = useState('');

    const fetchData = () => {
        setLoading(true);
        const params = new URLSearchParams();
        params.set('limit', '20');
        if (search) params.set('search', search);
        if (statusFilter) params.set('status', statusFilter);
        if (priorityFilter) params.set('priority', priorityFilter);
        if (companyFilter) params.set('company_id', companyFilter);
        if (techFilter) params.set('tech_id', techFilter);

        authFetch(`/api/tickets?${params}`)
            .then(r => r.json())
            .then(d => { setData(d); setLoading(false); })
            .catch(() => setLoading(false));
    };

    useEffect(() => {
        fetchData();
        authFetch('/api/companies').then(r => r.json()).then(setCompanies).catch(() => { });
        authFetch('/api/techs?status=active').then(r => r.json()).then(setTechs).catch(() => { });
    }, []);

    useEffect(() => { fetchData(); }, [statusFilter, priorityFilter, companyFilter, techFilter]);

    const handleSearch = (e) => {
        e.preventDefault();
        fetchData();
    };

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

    const { stats } = data;

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

                    {/* Search & Filters */}
                    <form className="filters-bar" onSubmit={handleSearch} style={{ marginBottom: 16 }}>
                        <input className="filter-input" placeholder="🔍 Search tickets..." value={search}
                            onChange={e => setSearch(e.target.value)} />
                        <select className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                            <option value="">All Status</option>
                            <option value="new">New</option>
                            <option value="open">Open</option>
                            <option value="in_progress">In Progress</option>
                            <option value="waiting">Waiting</option>
                            <option value="resolved">Resolved</option>
                            <option value="closed">Closed</option>
                        </select>
                        <select className="filter-select" value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}>
                            <option value="">All Priority</option>
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                            <option value="critical">Critical</option>
                        </select>
                        <select className="filter-select" value={companyFilter} onChange={e => setCompanyFilter(e.target.value)}>
                            <option value="">All Companies</option>
                            {companies.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                        <select className="filter-select" value={techFilter} onChange={e => setTechFilter(e.target.value)}>
                            <option value="">All Techs</option>
                            {techs.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>
                        <button type="submit" className="btn btn-secondary btn-sm">Search</button>
                    </form>

                    {loading ? (
                        <div className="loading"><div className="spinner" /></div>
                    ) : data.tickets.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-icon">🎫</div>
                            <div className="empty-state-text">No tickets found</div>
                            <div className="empty-state-sub">Try adjusting your filters or create a new ticket</div>
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
