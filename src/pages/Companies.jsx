import { useState, useEffect } from 'react';

export default function Companies({ addToast, authFetch }) {
    const [companies, setCompanies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editId, setEditId] = useState(null);
    const [form, setForm] = useState({ name: '', contact_email: '', contact_phone: '', address: '', notes: '' });

    const fetchCompanies = () => {
        authFetch('/api/companies').then(r => r.json()).then(d => { setCompanies(d); setLoading(false); }).catch(() => setLoading(false));
    };

    useEffect(() => { fetchCompanies(); }, []);

    const openNew = () => { setForm({ name: '', contact_email: '', contact_phone: '', address: '', notes: '' }); setEditId(null); setShowModal(true); };
    const openEdit = (c) => { setForm({ name: c.name, contact_email: c.contact_email, contact_phone: c.contact_phone, address: c.address, notes: c.notes }); setEditId(c.id); setShowModal(true); };

    const handleSubmit = async () => {
        if (!form.name.trim()) { addToast('Name is required', 'error'); return; }
        try {
            const method = editId ? 'PUT' : 'POST';
            const url = editId ? `/api/companies/${editId}` : '/api/companies';
            const res = await authFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
            if (res.ok) {
                addToast(editId ? 'Company updated' : 'Company created', 'success');
                setShowModal(false);
                fetchCompanies();
            } else {
                const data = await res.json();
                addToast(data.error || 'Failed', 'error');
            }
        } catch { addToast('Network error', 'error'); }
    };

    const handleDelete = async (id) => {
        if (!confirm('Delete this company?')) return;
        await authFetch(`/api/companies/${id}`, { method: 'DELETE' });
        addToast('Company deleted', 'info');
        fetchCompanies();
    };

    if (loading) return <div className="page-body"><div className="loading"><div className="spinner" /></div></div>;

    return (
        <>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Companies</h1>
                    <p className="page-subtitle">{companies.length} companies registered</p>
                </div>
                <button className="btn btn-primary" onClick={openNew}>➕ Add Company</button>
            </div>
            <div className="page-body">
                {companies.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">🏢</div>
                        <div className="empty-state-text">No companies yet</div>
                        <div className="empty-state-sub">Add your first client company</div>
                    </div>
                ) : (
                    <div className="manage-list">
                        {companies.map(c => (
                            <div key={c.id} className="manage-card">
                                <div className="manage-card-header">
                                    <div>
                                        <div className="manage-card-name">{c.name}</div>
                                        {c.contact_email && <div className="manage-card-detail">📧 {c.contact_email}</div>}
                                        {c.contact_phone && <div className="manage-card-detail">📞 {c.contact_phone}</div>}
                                        {c.address && <div className="manage-card-detail">📍 {c.address}</div>}
                                    </div>
                                    <div className="manage-card-actions">
                                        <button className="btn btn-secondary btn-sm" onClick={() => openEdit(c)}>✏️</button>
                                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(c.id)}>🗑️</button>
                                    </div>
                                </div>
                                <div className="manage-card-stats">
                                    <div className="manage-card-stat">Total: <strong>{c.ticket_count || 0}</strong></div>
                                    <div className="manage-card-stat">Open: <strong>{c.open_tickets || 0}</strong></div>
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
                            <h2 className="modal-title">{editId ? 'Edit Company' : 'Add Company'}</h2>
                            <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label className="form-label">Company Name *</label>
                                <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Company name" />
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Email</label>
                                    <input className="form-input" value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} placeholder="Contact email" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Phone</label>
                                    <input className="form-input" value={form.contact_phone} onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))} placeholder="Contact phone" />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Address</label>
                                <input className="form-input" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Physical address" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Notes</label>
                                <textarea className="form-textarea" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any notes..." rows={3} />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleSubmit}>{editId ? 'Save Changes' : 'Create Company'}</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
