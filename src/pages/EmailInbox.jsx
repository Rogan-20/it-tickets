import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function EmailInbox({ addToast, authFetch }) {
    const [emails, setEmails] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showSimulate, setShowSimulate] = useState(false);
    const [showApprove, setShowApprove] = useState(null);
    const [companies, setCompanies] = useState([]);
    const [techs, setTechs] = useState([]);
    const navigate = useNavigate();

    const [simForm, setSimForm] = useState({ from_name: '', from_address: '', subject: '', body: '' });
    const [approveForm, setApproveForm] = useState({ title: '', description: '', company_name: '', assigned_tech_id: '', priority: 'medium', category: 'other' });

    const fetchEmails = () => {
        authFetch('/api/email/pending').then(r => r.json()).then(d => { setEmails(d); setLoading(false); }).catch(() => setLoading(false));
    };

    useEffect(() => {
        fetchEmails();
        authFetch('/api/companies').then(r => r.json()).then(setCompanies).catch(() => { });
        authFetch('/api/techs?status=active').then(r => r.json()).then(setTechs).catch(() => { });
    }, []);

    const simulateEmail = async () => {
        if (!simForm.subject) { addToast('Subject is required', 'error'); return; }
        try {
            await authFetch('/api/email/simulate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(simForm) });
            addToast('Email added to inbox', 'success');
            setShowSimulate(false);
            setSimForm({ from_name: '', from_address: '', subject: '', body: '' });
            fetchEmails();
        } catch { addToast('Failed', 'error'); }
    };

    const openApprove = (email) => {
        setApproveForm({
            title: email.subject,
            description: email.body,
            company_name: '',
            assigned_tech_id: '',
            priority: 'medium',
            category: 'other'
        });
        setShowApprove(email);
    };

    const approveEmail = async () => {
        try {
            const res = await authFetch(`/api/email/approve/${showApprove.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(approveForm)
            });
            const ticket = await res.json();
            addToast(`Ticket ${ticket.ref_number} created from email!`, 'success');
            setShowApprove(null);
            fetchEmails();
        } catch { addToast('Failed', 'error'); }
    };

    const dismissEmail = async (id) => {
        await authFetch(`/api/email/dismiss/${id}`, { method: 'POST' });
        addToast('Email dismissed', 'info');
        fetchEmails();
    };

    if (loading) return <div className="page-body"><div className="loading"><div className="spinner" /></div></div>;

    return (
        <>
            <div className="page-header">
                <div>
                    <h1 className="page-title">📧 Email Inbox</h1>
                    <p className="page-subtitle">{emails.length} pending email{emails.length !== 1 ? 's' : ''} to review</p>
                </div>
                <button className="btn btn-secondary" onClick={() => setShowSimulate(true)}>📨 Simulate Email</button>
            </div>
            <div className="page-body">
                {emails.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">📭</div>
                        <div className="empty-state-text">No pending emails</div>
                        <div className="empty-state-sub">Incoming emails will appear here for review</div>
                    </div>
                ) : (
                    emails.map(email => (
                        <div key={email.id} className="inbox-item">
                            <div className="inbox-item-header">
                                <div>
                                    <div className="inbox-sender">{email.from_name || 'Unknown'}</div>
                                    <div className="inbox-contact">{email.from_address}</div>
                                </div>
                                <div className="inbox-timestamp">{new Date(email.received_at || email.created_at).toLocaleString()}</div>
                            </div>
                            <div className="inbox-subject">{email.subject}</div>
                            <div className="inbox-body">{email.body}</div>
                            <div className="inbox-actions">
                                <button className="btn btn-primary btn-sm" onClick={() => openApprove(email)}>✅ Create Ticket</button>
                                <button className="btn btn-danger btn-sm" onClick={() => dismissEmail(email.id)}>✕ Dismiss</button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Simulate Email Modal */}
            {showSimulate && (
                <div className="modal-overlay" onClick={() => setShowSimulate(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">Simulate Incoming Email</h2>
                            <button className="modal-close" onClick={() => setShowSimulate(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">From Name</label>
                                    <input className="form-input" value={simForm.from_name} onChange={e => setSimForm(f => ({ ...f, from_name: e.target.value }))} placeholder="John Smith" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">From Email</label>
                                    <input className="form-input" value={simForm.from_address} onChange={e => setSimForm(f => ({ ...f, from_address: e.target.value }))} placeholder="john@company.com" />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Subject *</label>
                                <input className="form-input" value={simForm.subject} onChange={e => setSimForm(f => ({ ...f, subject: e.target.value }))} placeholder="Email subject" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Body</label>
                                <textarea className="form-textarea" value={simForm.body} onChange={e => setSimForm(f => ({ ...f, body: e.target.value }))} placeholder="Email content..." rows={5} />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowSimulate(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={simulateEmail}>📨 Add to Inbox</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Approve Email Modal */}
            {showApprove && (
                <div className="modal-overlay" onClick={() => setShowApprove(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">Review & Create Ticket</h2>
                            <button className="modal-close" onClick={() => setShowApprove(null)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div style={{ background: 'var(--surface-1)', padding: 12, borderRadius: 'var(--radius-md)', marginBottom: 16, fontSize: 13 }}>
                                <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>From: {showApprove.from_name} &lt;{showApprove.from_address}&gt;</div>
                                <div style={{ color: 'var(--text-muted)' }}>Received: {new Date(showApprove.received_at || showApprove.created_at).toLocaleString()}</div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Ticket Title</label>
                                <input className="form-input" value={approveForm.title} onChange={e => setApproveForm(f => ({ ...f, title: e.target.value }))} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Description</label>
                                <textarea className="form-textarea" value={approveForm.description} onChange={e => setApproveForm(f => ({ ...f, description: e.target.value }))} rows={4} />
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Company</label>
                                    <input className="form-input" value={approveForm.company_name} onChange={e => setApproveForm(f => ({ ...f, company_name: e.target.value }))} placeholder="Type company name" list="company-list" />
                                    <datalist id="company-list">{companies.map(c => <option key={c.id} value={c.name} />)}</datalist>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Assign Tech</label>
                                    <select className="form-select" value={approveForm.assigned_tech_id} onChange={e => setApproveForm(f => ({ ...f, assigned_tech_id: e.target.value }))}>
                                        <option value="">Unassigned</option>
                                        {techs.map(t => <option key={t.id} value={t.id}>{t.name} ({t.type})</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Priority</label>
                                    <select className="form-select" value={approveForm.priority} onChange={e => setApproveForm(f => ({ ...f, priority: e.target.value }))}>
                                        <option value="low">Low</option>
                                        <option value="medium">Medium</option>
                                        <option value="high">High</option>
                                        <option value="critical">Critical</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Category</label>
                                    <select className="form-select" value={approveForm.category} onChange={e => setApproveForm(f => ({ ...f, category: e.target.value }))}>
                                        <option value="other">Other</option>
                                        <option value="hardware">Hardware</option>
                                        <option value="software">Software</option>
                                        <option value="network">Network</option>
                                        <option value="printer">Printer</option>
                                        <option value="email_issue">Email</option>
                                        <option value="security">Security</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowApprove(null)}>Cancel</button>
                            <button className="btn btn-success" onClick={approveEmail}>✅ Create Ticket</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
