import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

export default function TicketCreate({ addToast, authFetch, currentUser }) {
    const [companies, setCompanies] = useState([]);
    const [techs, setTechs] = useState([]);
    const [photos, setPhotos] = useState([]);
    const [isRecurring, setIsRecurring] = useState(false);
    const [companySearch, setCompanySearch] = useState('');
    const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
    const navigate = useNavigate();
    const fileRef = useRef();

    const [form, setForm] = useState({
        title: '', description: '', company_id: '', company_name: '',
        assigned_tech_id: '', priority: 'medium', source: 'walk_in',
        category: 'other', contact_name: '', contact_email: '', contact_phone: '',
        recurring_schedule: '', due_date: ''
    });

    useEffect(() => {
        authFetch('/api/companies').then(r => r.json()).then(setCompanies).catch(() => { });
        authFetch('/api/techs?status=active').then(r => r.json()).then(setTechs).catch(() => { });
    }, []);

    const updateForm = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

    const handlePhotoDrop = (e) => {
        e.preventDefault();
        const files = Array.from(e.dataTransfer?.files || e.target.files || []);
        const imageFiles = files.filter(f => f.type.startsWith('image/'));
        setPhotos(prev => [...prev, ...imageFiles]);
    };

    const removePhoto = (index) => {
        setPhotos(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.title.trim()) { addToast('Title is required', 'error'); return; }

        const formData = new FormData();
        Object.entries(form).forEach(([k, v]) => { if (v) formData.append(k, v); });
        if (isRecurring && form.recurring_schedule) {
            formData.set('recurring_schedule', form.recurring_schedule);
        }
        photos.forEach(p => formData.append('photos', p));

        try {
            const res = await authFetch('/api/tickets', { method: 'POST', body: formData });
            const ticket = await res.json();
            if (res.ok) {
                addToast(`Ticket ${ticket.ref_number} created!`, 'success');
                navigate(`/tickets/${ticket.id}`);
            } else {
                addToast(ticket.error || 'Failed to create ticket', 'error');
            }
        } catch {
            addToast('Network error', 'error');
        }
    };

    const filteredCompanies = companies.filter(c =>
        c.name.toLowerCase().includes(companySearch.toLowerCase())
    );

    return (
        <>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Create New Ticket</h1>
                    <p className="page-subtitle">Log a new IT support request</p>
                </div>
            </div>
            <div className="page-body">
                <form onSubmit={handleSubmit}>
                    <div className="card" style={{ maxWidth: 900 }}>
                        <h3 className="card-title" style={{ marginBottom: 20 }}>📝 Ticket Details</h3>

                        <div className="form-group">
                            <label className="form-label">Title *</label>
                            <input className="form-input" placeholder="Brief description of the issue..."
                                value={form.title} onChange={e => updateForm('title', e.target.value)} required />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Description</label>
                            <textarea className="form-textarea" placeholder="Detailed description of the problem..."
                                value={form.description} onChange={e => updateForm('description', e.target.value)} rows={4} />
                        </div>

                        <div className="form-row-3">
                            <div className="form-group">
                                <label className="form-label">Priority</label>
                                <select className="form-select" value={form.priority} onChange={e => updateForm('priority', e.target.value)}>
                                    <option value="low">🟢 Low</option>
                                    <option value="medium">🟡 Medium</option>
                                    <option value="high">🟠 High</option>
                                    <option value="critical">🔴 Critical</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Category</label>
                                <select className="form-select" value={form.category} onChange={e => updateForm('category', e.target.value)}>
                                    <option value="other">Other</option>
                                    <option value="hardware">🖥️ Hardware</option>
                                    <option value="software">💿 Software</option>
                                    <option value="network">🌐 Network</option>
                                    <option value="printer">🖨️ Printer</option>
                                    <option value="email_issue">📧 Email</option>
                                    <option value="security">🔒 Security</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Source</label>
                                <select className="form-select" value={form.source} onChange={e => updateForm('source', e.target.value)}>
                                    <option value="walk_in">🚶 Walk-in</option>
                                    <option value="phone">📞 Phone Call</option>
                                    <option value="email">📧 Email</option>
                                    <option value="whatsapp">💬 WhatsApp</option>
                                </select>
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group" style={{ position: 'relative' }}>
                                <label className="form-label">Company</label>
                                {currentUser?.role === 'admin' ? (
                                    /* Admin: search + create new company */
                                    <>
                                        <input className="form-input" placeholder="Search or type new company..."
                                            value={companySearch}
                                            onChange={e => { setCompanySearch(e.target.value); setShowCompanyDropdown(true); updateForm('company_id', ''); updateForm('company_name', e.target.value); }}
                                            onFocus={() => setShowCompanyDropdown(true)}
                                            onBlur={() => setTimeout(() => setShowCompanyDropdown(false), 200)} />
                                        {showCompanyDropdown && filteredCompanies.length > 0 && (
                                            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', maxHeight: 180, overflowY: 'auto', zIndex: 10 }}>
                                                {filteredCompanies.map(c => (
                                                    <div key={c.id} style={{ padding: '8px 14px', cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-light)' }}
                                                        onMouseDown={() => { updateForm('company_id', c.id); updateForm('company_name', ''); setCompanySearch(c.name); setShowCompanyDropdown(false); }}>
                                                        {c.name}
                                                        <span style={{ float: 'right', color: 'var(--text-muted)', fontSize: 11 }}>{c.open_tickets || 0} open</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    /* Non-admin: dropdown only */
                                    <select className="form-select" value={form.company_id}
                                        onChange={e => { updateForm('company_id', e.target.value); updateForm('company_name', ''); }}>
                                        <option value="">Select a company</option>
                                        {companies.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                )}
                            </div>
                            <div className="form-group">
                                <label className="form-label">Assign Tech</label>
                                <select className="form-select" value={form.assigned_tech_id} onChange={e => updateForm('assigned_tech_id', e.target.value)}>
                                    <option value="">Unassigned</option>
                                    {techs.map(t => (
                                        <option key={t.id} value={t.id}>{t.name} ({t.type}) — {t.open_tickets || 0} open</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <h3 className="card-title" style={{ margin: '24px 0 16px' }}>👤 Contact Info</h3>
                        <div className="form-row-3">
                            <div className="form-group">
                                <label className="form-label">Name</label>
                                <input className="form-input" placeholder="Contact name"
                                    value={form.contact_name} onChange={e => updateForm('contact_name', e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Email</label>
                                <input className="form-input" type="email" placeholder="Contact email"
                                    value={form.contact_email} onChange={e => updateForm('contact_email', e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Phone</label>
                                <input className="form-input" placeholder="Contact phone"
                                    value={form.contact_phone} onChange={e => updateForm('contact_phone', e.target.value)} />
                            </div>
                        </div>

                        <h3 className="card-title" style={{ margin: '24px 0 16px' }}>📷 Photos</h3>
                        <div className="photo-upload-zone"
                            onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('dragover'); }}
                            onDragLeave={e => e.currentTarget.classList.remove('dragover')}
                            onDrop={e => { e.currentTarget.classList.remove('dragover'); handlePhotoDrop(e); }}
                            onClick={() => fileRef.current?.click()}>
                            <div className="photo-upload-icon">📸</div>
                            <div className="photo-upload-text">Drop photos here or click to browse</div>
                            <div className="photo-upload-hint">Supports JPEG, PNG, GIF up to 10MB</div>
                        </div>
                        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={handlePhotoDrop} />
                        {photos.length > 0 && (
                            <div className="photo-previews">
                                {photos.map((p, i) => (
                                    <div key={i} className="photo-preview">
                                        <img src={URL.createObjectURL(p)} alt="" />
                                        <button type="button" className="photo-preview-remove" onClick={() => removePhoto(i)}>✕</button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <h3 className="card-title" style={{ margin: '24px 0 16px' }}>🔄 Recurring</h3>
                        <div className="toggle-wrapper" style={{ marginBottom: 12 }}>
                            <div className={`toggle ${isRecurring ? 'active' : ''}`} onClick={() => setIsRecurring(!isRecurring)} />
                            <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Make this a recurring ticket</span>
                        </div>
                        {isRecurring && (
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Schedule</label>
                                    <select className="form-select" value={form.recurring_schedule} onChange={e => updateForm('recurring_schedule', e.target.value)}>
                                        <option value="">Select schedule</option>
                                        <option value="daily">Daily</option>
                                        <option value="weekly">Weekly</option>
                                        <option value="monthly">Monthly</option>
                                        <option value="quarterly">Quarterly</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Due Date (optional)</label>
                                    <input className="form-input" type="date" value={form.due_date} onChange={e => updateForm('due_date', e.target.value)} />
                                </div>
                            </div>
                        )}

                        <div style={{ marginTop: 28, display: 'flex', gap: 12 }}>
                            <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center', padding: '14px 24px', fontSize: 15 }}>
                                🎫 Create Ticket
                            </button>
                            <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}>Cancel</button>
                        </div>
                    </div>
                </form>
            </div>
        </>
    );
}
