import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export default function TicketList({ addToast, authFetch }) {
    const [data, setData] = useState({ tickets: [], stats: {}, total: 0 });
    const [loading, setLoading] = useState(true);
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();

    const [search, setSearch] = useState(searchParams.get('search') || '');
    const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
    const [priorityFilter, setPriorityFilter] = useState(searchParams.get('priority') || '');
    const [sourceFilter, setSourceFilter] = useState('');

    const fetchTickets = () => {
        setLoading(true);
        const params = new URLSearchParams();
        if (search) params.set('search', search);
        if (statusFilter) params.set('status', statusFilter);
        if (priorityFilter) params.set('priority', priorityFilter);
        if (sourceFilter) params.set('source', sourceFilter);

        authFetch(`/api/tickets?${params}`)
            .then(r => r.json())
            .then(d => { setData(d); setLoading(false); })
            .catch(() => setLoading(false));
    };

    useEffect(() => { fetchTickets(); }, [statusFilter, priorityFilter, sourceFilter]);

    const handleSearch = (e) => {
        e.preventDefault();
        fetchTickets();
    };

    return (
        <>
            <div className="page-header">
                <div>
                    <h1 className="page-title">All Tickets</h1>
                    <p className="page-subtitle">{data.total} ticket{data.total !== 1 ? 's' : ''} found</p>
                </div>
                <button className="btn btn-primary" onClick={() => navigate('/tickets/new')}>➕ New Ticket</button>
            </div>
            <div className="page-body">
                <form className="filters-bar" onSubmit={handleSearch}>
                    <input className="filter-input" placeholder="🔍 Search tickets..." value={search} onChange={e => setSearch(e.target.value)} />
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
                    <select className="filter-select" value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}>
                        <option value="">All Sources</option>
                        <option value="email">Email</option>
                        <option value="whatsapp">WhatsApp</option>
                        <option value="phone">Phone</option>
                        <option value="walk_in">Walk-in</option>
                        <option value="recurring">Recurring</option>
                    </select>
                    <button type="submit" className="btn btn-secondary btn-sm">Search</button>
                </form>

                {loading ? (
                    <div className="loading"><div className="spinner" /></div>
                ) : data.tickets.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">🔍</div>
                        <div className="empty-state-text">No tickets found</div>
                        <div className="empty-state-sub">Try adjusting your filters or create a new ticket</div>
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
                                    <th>Tech</th>
                                    <th>Source</th>
                                    <th>Updates</th>
                                    <th>Created</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.tickets.map(t => (
                                    <tr key={t.id} onClick={() => navigate(`/tickets/${t.id}`)}>
                                        <td><span className="ticket-ref">{t.ref_number}</span></td>
                                        <td className="ticket-title-cell">
                                            {t.title}
                                            {t.photo_count > 0 && <span style={{ marginLeft: 6, opacity: 0.5 }}>📷{t.photo_count}</span>}
                                        </td>
                                        <td>{t.company_name || '—'}</td>
                                        <td><span className={`badge badge-${t.priority}`}>{t.priority}</span></td>
                                        <td><span className={`badge badge-${t.status}`}>{t.status.replace('_', ' ')}</span></td>
                                        <td>
                                            {t.tech_name ? (
                                                <>
                                                    {t.tech_name}
                                                    <span className={`badge badge-${t.tech_type}`} style={{ marginLeft: 6 }}>{t.tech_type}</span>
                                                </>
                                            ) : '—'}
                                        </td>
                                        <td><span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>{t.source?.replace('_', ' ')}</span></td>
                                        <td style={{ textAlign: 'center' }}>{t.update_count || 0}</td>
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
