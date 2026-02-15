import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import VoiceInput from '../components/VoiceInput';

export default function TicketDetail({ addToast, authFetch, currentUser }) {
    const { id } = useParams();
    const navigate = useNavigate();
    const [ticket, setTicket] = useState(null);
    const [loading, setLoading] = useState(true);
    const [updateText, setUpdateText] = useState('');
    const [techs, setTechs] = useState([]);
    const [companies, setCompanies] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [lightboxPhoto, setLightboxPhoto] = useState(null);
    const photoRef = useRef();

    const fetchTicket = () => {
        authFetch(`/api/tickets/${id}`)
            .then(r => r.json())
            .then(t => { setTicket(t); setLoading(false); })
            .catch(() => setLoading(false));
    };

    useEffect(() => {
        fetchTicket();
        authFetch('/api/techs?status=active').then(r => r.json()).then(setTechs).catch(() => { });
        authFetch('/api/companies').then(r => r.json()).then(setCompanies).catch(() => { });
    }, [id]);

    const updateTicket = async (fields) => {
        try {
            const res = await authFetch(`/api/tickets/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(fields)
            });
            if (res.ok) {
                fetchTicket();
                addToast('Ticket updated', 'success');
            }
        } catch {
            addToast('Failed to update', 'error');
        }
    };

    const addUpdate = async () => {
        if (!updateText.trim()) return;
        try {
            await authFetch(`/api/tickets/${id}/updates`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ update_text: updateText, updated_by: 'Tech' })
            });
            setUpdateText('');
            fetchTicket();
            addToast('Update added', 'success');
        } catch {
            addToast('Failed to add update', 'error');
        }
    };

    const uploadPhotos = async (e) => {
        const files = e.target.files;
        if (!files.length) return;
        setUploading(true);
        const formData = new FormData();
        Array.from(files).forEach(f => formData.append('photos', f));
        try {
            await authFetch(`/api/tickets/${id}/photos`, { method: 'POST', body: formData });
            fetchTicket();
            addToast('Photos uploaded', 'success');
        } catch {
            addToast('Upload failed', 'error');
        }
        setUploading(false);
    };

    const deleteTicket = async () => {
        if (!confirm('Delete this ticket?')) return;
        await authFetch(`/api/tickets/${id}`, { method: 'DELETE' });
        addToast('Ticket deleted', 'info');
        navigate('/tickets');
    };

    if (loading) return <div className="page-body"><div className="loading"><div className="spinner" /></div></div>;
    if (!ticket) return <div className="page-body"><div className="empty-state"><div className="empty-state-icon">❌</div><div className="empty-state-text">Ticket not found</div></div></div>;

    return (
        <>
            <div className="page-header">
                <div>
                    <h1 className="page-title">
                        <span className="ticket-ref" style={{ fontSize: 18 }}>{ticket.ref_number}</span>
                        <span style={{ margin: '0 8px', color: 'var(--text-muted)' }}>—</span>
                        {ticket.title}
                    </h1>
                    <p className="page-subtitle">
                        Created {new Date(ticket.created_at).toLocaleString()} · Source: {ticket.source?.replace('_', ' ')}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-danger btn-sm" onClick={deleteTicket}>🗑️ Delete</button>
                </div>
            </div>
            <div className="page-body">
                <div className="ticket-detail-grid">
                    {/* Left column - Main content */}
                    <div>
                        {/* Description */}
                        <div className="detail-section">
                            <div className="detail-section-title">📝 Description</div>
                            <div className="card">
                                <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
                                    {ticket.description || 'No description provided'}
                                </p>
                            </div>
                        </div>

                        {/* Photos */}
                        {(ticket.photos?.length > 0 || true) && (
                            <div className="detail-section">
                                <div className="detail-section-title">
                                    📷 Photos ({ticket.photos?.length || 0})
                                    <button className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto' }}
                                        onClick={() => photoRef.current?.click()}>
                                        {uploading ? '⏳ Uploading...' : '➕ Add Photo'}
                                    </button>
                                </div>
                                <input ref={photoRef} type="file" accept="image/*" multiple hidden onChange={uploadPhotos} />
                                {ticket.photos?.length > 0 ? (
                                    <div className="photo-gallery">
                                        {ticket.photos.map(p => (
                                            <div key={p.id} className="photo-thumb" onClick={() => setLightboxPhoto(p)}>
                                                <img src={p.filepath} alt={p.original_name} />
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '12px 0' }}>No photos attached</div>
                                )}
                            </div>
                        )}

                        {/* Updates Timeline */}
                        <div className="detail-section">
                            <div className="detail-section-title">💬 Updates & Notes ({ticket.updates?.length || 0})</div>

                            {/* Add update */}
                            <div className="card" style={{ marginBottom: 16 }}>
                                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                                    <textarea className="form-textarea" placeholder="Add an update or note..."
                                        value={updateText} onChange={e => setUpdateText(e.target.value)}
                                        style={{ minHeight: 70, flex: 1 }} />
                                    <VoiceInput onResult={(text) => setUpdateText(prev => prev + (prev ? ' ' : '') + text)} />
                                </div>
                                <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
                                    <button className="btn btn-primary btn-sm" onClick={addUpdate} disabled={!updateText.trim()}>
                                        📤 Post Update
                                    </button>
                                </div>
                            </div>

                            {ticket.updates?.length > 0 ? (
                                <div className="timeline">
                                    {ticket.updates.map(u => (
                                        <div key={u.id} className={`timeline-item ${u.update_type}`}>
                                            <div className="timeline-header">
                                                <span className="timeline-author">{u.updated_by}</span>
                                                <span className="timeline-time">{new Date(u.created_at).toLocaleString()}</span>
                                            </div>
                                            <div className="timeline-text">{u.update_text}</div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>
                                    No updates yet
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right column - Sidebar info */}
                    <div>
                        {/* Status */}
                        <div className="detail-section">
                            <div className="detail-section-title">📊 Status</div>
                            <div className="card">
                                <div className="status-buttons">
                                    {['new', 'open', 'in_progress', 'waiting', 'resolved', 'closed'].map(s => (
                                        <button key={s} className={`status-btn ${ticket.status === s ? 'active' : ''}`}
                                            data-status={s}
                                            onClick={() => updateTicket({ status: s })}>
                                            {s.replace('_', ' ')}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Details */}
                        <div className="detail-section">
                            <div className="detail-section-title">ℹ️ Details</div>
                            <div className="detail-info-grid">
                                <div className="detail-info-item">
                                    <div className="detail-info-label">Priority</div>
                                    <select className="form-select" value={ticket.priority} style={{ marginTop: 4, padding: '6px 10px', fontSize: 12 }}
                                        onChange={e => updateTicket({ priority: e.target.value })}>
                                        <option value="low">🟢 Low</option>
                                        <option value="medium">🟡 Medium</option>
                                        <option value="high">🟠 High</option>
                                        <option value="critical">🔴 Critical</option>
                                    </select>
                                </div>
                                <div className="detail-info-item">
                                    <div className="detail-info-label">Category</div>
                                    <div className="detail-info-value">{ticket.category?.replace('_', ' ') || 'Other'}</div>
                                </div>
                                <div className="detail-info-item" style={{ gridColumn: '1 / -1' }}>
                                    <div className="detail-info-label">Assigned Tech</div>
                                    <select className="form-select" value={ticket.assigned_tech_id || ''} style={{ marginTop: 4, padding: '6px 10px', fontSize: 12 }}
                                        onChange={e => updateTicket({ assigned_tech_id: e.target.value || null })}>
                                        <option value="">Unassigned</option>
                                        {techs.map(t => (
                                            <option key={t.id} value={t.id}>{t.name} ({t.type})</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Company */}
                        <div className="detail-section">
                            <div className="detail-section-title">🏢 Company</div>
                            <div className="card">
                                <select className="form-select" value={ticket.company_id || ''} style={{ padding: '8px 10px', fontSize: 13 }}
                                    onChange={e => updateTicket({ company_id: e.target.value || null })}>
                                    <option value="">No company</option>
                                    {companies.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                                {ticket.company_name && (
                                    <div style={{ marginTop: 10, fontSize: 13, color: 'var(--text-secondary)' }}>
                                        {ticket.company_email && <div>📧 {ticket.company_email}</div>}
                                        {ticket.company_phone && <div>📞 {ticket.company_phone}</div>}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Contact */}
                        <div className="detail-section">
                            <div className="detail-section-title">👤 Contact</div>
                            <div className="card">
                                {ticket.contact_name && <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-bright)', marginBottom: 4 }}>{ticket.contact_name}</div>}
                                {ticket.contact_email && <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 2 }}>📧 {ticket.contact_email}</div>}
                                {ticket.contact_phone && <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>📞 {ticket.contact_phone}</div>}
                                {!ticket.contact_name && !ticket.contact_email && !ticket.contact_phone && (
                                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No contact info</div>
                                )}
                            </div>
                        </div>

                        {/* Recurring info */}
                        {ticket.recurring_schedule && (
                            <div className="detail-section">
                                <div className="detail-section-title">🔄 Recurring</div>
                                <div className="card">
                                    <div className="detail-info-value" style={{ textTransform: 'capitalize' }}>
                                        {ticket.recurring_schedule} schedule
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Lightbox */}
            {lightboxPhoto && (
                <div className="modal-overlay" onClick={() => setLightboxPhoto(null)}>
                    <div onClick={e => e.stopPropagation()} style={{ maxWidth: '90vw', maxHeight: '90vh' }}>
                        <img src={lightboxPhoto.filepath} alt={lightboxPhoto.original_name}
                            style={{ maxWidth: '90vw', maxHeight: '85vh', borderRadius: 'var(--radius-lg)', objectFit: 'contain' }} />
                        <div style={{ textAlign: 'center', marginTop: 8, color: 'var(--text-secondary)', fontSize: 13 }}>
                            {lightboxPhoto.original_name}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
