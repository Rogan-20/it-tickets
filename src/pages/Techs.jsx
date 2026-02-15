import { useState, useEffect } from 'react';

export default function Techs({ addToast, authFetch }) {
    const [techs, setTechs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editId, setEditId] = useState(null);
    const [filterType, setFilterType] = useState('');
    const [form, setForm] = useState({ name: '', email: '', phone: '', type: 'internal' });

    const fetchTechs = () => {
        const params = filterType ? `?type=${filterType}` : '';
        authFetch(`/api/techs${params}`).then(r => r.json()).then(d => { setTechs(d); setLoading(false); }).catch(() => setLoading(false));
    };

    useEffect(() => { fetchTechs(); }, [filterType]);

    const openNew = () => { setForm({ name: '', email: '', phone: '', type: 'internal' }); setEditId(null); setShowModal(true); };
    const openEdit = (t) => { setForm({ name: t.name, email: t.email, phone: t.phone, type: t.type }); setEditId(t.id); setShowModal(true); };

    const handleSubmit = async () => {
        if (!form.name.trim()) { addToast('Name is required', 'error'); return; }
        try {
            const method = editId ? 'PUT' : 'POST';
            const url = editId ? `/api/techs/${editId}` : '/api/techs';
            const res = await authFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
            if (res.ok) {
                addToast(editId ? 'Tech updated' : 'Tech added', 'success');
                setShowModal(false);
                fetchTechs();
            }
        } catch { addToast('Network error', 'error'); }
    };

    const handleDelete = async (id) => {
        if (!confirm('Delete this technician?')) return;
        await authFetch(`/api/techs/${id}`, { method: 'DELETE' });
        addToast('Tech removed', 'info');
        fetchTechs();
    };

    const toggleStatus = async (tech) => {
        const newStatus = tech.status === 'active' ? 'inactive' : 'active';
        await authFetch(`/api/techs/${tech.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });
        addToast(`Tech ${newStatus === 'active' ? 'activated' : 'deactivated'}`, 'success');
        fetchTechs();
    };

    if (loading) return <div className="page-body"><div className="loading"><div className="spinner" /></div></div>;

    return (
        <>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Technicians</h1>
                    <p className="page-subtitle">{techs.length} technicians</p>
                </div>
                <button className="btn btn-primary" onClick={openNew}>➕ Add Tech</button>
            </div>
            <div className="page-body">
                <div className="filters-bar" style={{ marginBottom: 20 }}>
                    <button className={`status-btn ${filterType === '' ? 'active' : ''}`} onClick={() => setFilterType('')}>All</button>
                    <button className={`status-btn ${filterType === 'internal' ? 'active' : ''}`} data-status="new" onClick={() => setFilterType('internal')}>Internal</button>
                    <button className={`status-btn ${filterType === 'external' ? 'active' : ''}`} data-status="open" onClick={() => setFilterType('external')}>External</button>
                    <button className={`status-btn ${filterType === 'remote' ? 'active' : ''}`} data-status="in_progress" onClick={() => setFilterType('remote')}>Remote</button>
                </div>

                {techs.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">👨‍💻</div>
                        <div className="empty-state-text">No technicians found</div>
                    </div>
                ) : (
                    <div className="manage-list">
                        {techs.map(t => (
                            <div key={t.id} className="manage-card" style={{ opacity: t.status === 'inactive' ? 0.5 : 1 }}>
                                <div className="manage-card-header">
                                    <div>
                                        <div className="manage-card-name">
                                            {t.name}
                                            <span className={`badge badge-${t.type}`} style={{ marginLeft: 8 }}>{t.type}</span>
                                            {t.status === 'inactive' && <span className="badge" style={{ marginLeft: 6, background: 'rgba(100,116,139,0.15)', color: 'var(--text-muted)' }}>inactive</span>}
                                        </div>
                                        {t.email && <div className="manage-card-detail">📧 {t.email}</div>}
                                        {t.phone && <div className="manage-card-detail">📞 {t.phone}</div>}
                                    </div>
                                    <div className="manage-card-actions">
                                        <button className="btn btn-secondary btn-sm" onClick={() => toggleStatus(t)}
                                            title={t.status === 'active' ? 'Deactivate' : 'Activate'}>
                                            {t.status === 'active' ? '⏸️' : '▶️'}
                                        </button>
                                        <button className="btn btn-secondary btn-sm" onClick={() => openEdit(t)}>✏️</button>
                                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(t.id)}>🗑️</button>
                                    </div>
                                </div>
                                <div className="manage-card-stats">
                                    <div className="manage-card-stat">Total: <strong>{t.total_tickets || 0}</strong></div>
                                    <div className="manage-card-stat">Open: <strong>{t.open_tickets || 0}</strong></div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">{editId ? 'Edit Tech' : 'Add Tech'}</h2>
                            <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label className="form-label">Name *</label>
                                <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Full name" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Type</label>
                                <select className="form-select" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                                    <option value="internal">🏢 Internal</option>
                                    <option value="external">🔧 External</option>
                                    <option value="remote">🌐 Remote</option>
                                </select>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Email</label>
                                    <input className="form-input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="Email" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Phone</label>
                                    <input className="form-input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="Phone" />
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleSubmit}>{editId ? 'Save' : 'Add Tech'}</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
