import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function MyTickets({ addToast, authFetch, currentUser }) {
    const [data, setData] = useState({ tickets: [], stats: {}, total: 0 });
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    const [statusFilter, setStatusFilter] = useState('');
    const [priorityFilter, setPriorityFilter] = useState('');

    const fetchTickets = () => {
        if (!currentUser?.tech_id) {
            setLoading(false);
            return;
        }
        setLoading(true);
        const params = new URLSearchParams();
        params.set('tech_id', currentUser.tech_id);
        if (statusFilter) params.set('status', statusFilter);
        if (priorityFilter) params.set('priority', priorityFilter);

        authFetch(`/api/tickets?${params}`)
            .then(r => r.json())
            .then(d => { setData(d); setLoading(false); })
            .catch(() => setLoading(false));
    };

    useEffect(() => { fetchTickets(); }, [statusFilter, priorityFilter]);

    if (!currentUser?.tech_id) {
        return (
            <>
                <div className="page-header">
                    <div>
                        <h1 className="page-title">My Tickets</h1>
                        <p className="page-subtitle">Tickets assigned to you</p>
                    </div>
                </div>
                <div className="page-body">
                    <div className="empty-state">
                        <div className="empty-state-icon">🔗</div>
                        <div className="empty-state-text">No tech profile linked</div>
                        <div className="empty-state-sub">Ask your admin to link your account to a tech profile</div>
                    </div>
                </div>
            </>
        );
    }

    const formatElapsed = (startedAt, closedAt) => {
        if (!startedAt) return null;
        const start = new Date(startedAt);
        const end = closedAt ? new Date(closedAt) : new Date();
        const diff = Math.max(0, Math.floor((end - start) / 1000));
        const h = Math.floor(diff / 3600);
        const m = Math.floor((diff % 3600) / 60);
        if (h > 0) return `${h}h ${m}m`;
        return `${m}m`;
    };

    return (
        <>
            <div className="page-header">
                <div>
                    <h1 className="page-title">My Tickets</h1>
                    <p className="page-subtitle">{data.total} ticket{data.total !== 1 ? 's' : ''} assigned to you</p>
                </div>
                <button className="btn btn-primary" onClick={() => navigate('/tickets/new')}>➕ New Ticket</button>
            </div>
            <div className="page-body">
                <div className="filters-bar">
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
                </div>

                {loading ? (
                    <div className="loading"><div className="spinner" /></div>
                ) : data.tickets.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">✅</div>
                        <div className="empty-state-text">No tickets assigned</div>
                        <div className="empty-state-sub">You're all caught up!</div>
                    </div>
                ) : (
                    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                        <table className="ticket-table">
                            <thead>
                                <tr>
                                    <th>Ref</th>
                                    <th>Title</th>
                                    <th>Company</th>
                                    <th>Priority</th>
                                    <th>Status</th>
                                    <th>Timer</th>
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
                                        <td style={{ whiteSpace: 'nowrap', fontSize: 12 }}>
                                            {t.started_at ? (
                                                <span style={{ color: t.closed_at ? 'var(--text-muted)' : 'var(--success)' }}>
                                                    {t.closed_at ? '✅ ' : '⏱️ '}{formatElapsed(t.started_at, t.closed_at)}
                                                </span>
                                            ) : '—'}
                                        </td>
                                        <td style={{ whiteSpace: 'nowrap', fontSize: 12, color: 'var(--text-muted)' }}>
                                            {new Date(t.created_at).toLocaleDateString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </>
    );
}
