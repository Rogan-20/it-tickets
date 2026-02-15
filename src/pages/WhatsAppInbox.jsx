import { useState, useEffect } from 'react';

// Parse WhatsApp chat text into individual messages
// Supports formats:
//   [2026/02/15, 10:30:15] Sender Name: message
//   [15/02/2026, 10:30:15] Sender Name: message
//   2026/02/15, 10:30 - Sender Name: message
//   15/02/2026, 10:30 - Sender Name: message
//   2/15/26, 10:30 AM - Sender Name: message
function parseWhatsAppChat(text) {
    if (!text || !text.trim()) return [];

    const lines = text.split('\n');
    const messages = [];
    let current = null;

    // Patterns for WhatsApp message lines
    const patterns = [
        // [2026/02/15, 10:30:15] Sender: message
        /^\[(\d{1,4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)\]\s+(.+?):\s+(.+)/i,
        // 2026/02/15, 10:30 - Sender: message  OR  15/02/2026, 10:30 - Sender: message
        /^(\d{1,4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)\s*[-–—]\s+(.+?):\s+(.+)/i,
    ];

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        let matched = false;
        for (const pattern of patterns) {
            const match = trimmed.match(pattern);
            if (match) {
                // Save previous message
                if (current) messages.push(current);

                const [, dateStr, timeStr, sender, msgText] = match;

                // Try to parse the date
                let receivedAt;
                try {
                    // Normalize separators
                    const normalized = dateStr.replace(/[\.]/g, '/');
                    const parts = normalized.split('/');
                    let year, month, day;

                    if (parts[0].length === 4) {
                        // YYYY/MM/DD
                        [year, month, day] = parts;
                    } else if (parts[2].length === 4) {
                        // DD/MM/YYYY
                        [day, month, year] = parts;
                    } else if (parts[2].length === 2) {
                        // Could be M/D/YY or D/M/YY - assume D/M/YY
                        [day, month, year] = parts;
                        year = `20${year}`;
                    } else {
                        [day, month, year] = parts;
                    }

                    // Parse time
                    let timeParts = timeStr.replace(/\s*[AP]M/i, '').split(':');
                    let hours = parseInt(timeParts[0]);
                    const mins = timeParts[1] || '00';
                    const secs = timeParts[2] || '00';

                    if (/PM/i.test(timeStr) && hours < 12) hours += 12;
                    if (/AM/i.test(timeStr) && hours === 12) hours = 0;

                    receivedAt = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hours).padStart(2, '0')}:${mins}:${secs}`;
                } catch {
                    receivedAt = new Date().toISOString();
                }

                current = {
                    sender_name: sender.trim(),
                    message_text: msgText.trim(),
                    received_at: receivedAt,
                    selected: true
                };
                matched = true;
                break;
            }
        }

        // Continuation line (belongs to previous message)
        if (!matched && current) {
            current.message_text += '\n' + trimmed;
        }
    }

    // Push the last message
    if (current) messages.push(current);

    return messages;
}

export default function WhatsAppInbox({ addToast, authFetch }) {
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [showPaste, setShowPaste] = useState(false);
    const [showConvert, setShowConvert] = useState(null);
    const [companies, setCompanies] = useState([]);
    const [techs, setTechs] = useState([]);

    const [addForm, setAddForm] = useState({ sender_name: '', sender_phone: '', group_name: '', message_text: '' });
    const [convertForm, setConvertForm] = useState({ title: '', description: '', company_name: '', assigned_tech_id: '', priority: 'medium', category: 'other' });

    // Paste chat state
    const [pasteText, setPasteText] = useState('');
    const [pasteGroupName, setPasteGroupName] = useState('');
    const [parsedMessages, setParsedMessages] = useState([]);
    const [importing, setImporting] = useState(false);

    const fetchMessages = () => {
        authFetch('/api/whatsapp/messages?status=pending').then(r => r.json()).then(d => { setMessages(d); setLoading(false); }).catch(() => setLoading(false));
    };

    useEffect(() => {
        fetchMessages();
        authFetch('/api/companies').then(r => r.json()).then(setCompanies).catch(() => { });
        authFetch('/api/techs?status=active').then(r => r.json()).then(setTechs).catch(() => { });
    }, []);

    const addMessage = async () => {
        if (!addForm.message_text) { addToast('Message is required', 'error'); return; }
        try {
            await authFetch('/api/whatsapp/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(addForm) });
            addToast('Message added', 'success');
            setShowAdd(false);
            setAddForm({ sender_name: '', sender_phone: '', group_name: '', message_text: '' });
            fetchMessages();
        } catch { addToast('Failed', 'error'); }
    };

    const handleParse = () => {
        const parsed = parseWhatsAppChat(pasteText);
        if (parsed.length === 0) {
            addToast('Could not parse any messages. Make sure you paste WhatsApp chat text.', 'error');
            return;
        }
        setParsedMessages(parsed);
    };

    const toggleMessage = (idx) => {
        setParsedMessages(prev => prev.map((m, i) => i === idx ? { ...m, selected: !m.selected } : m));
    };

    const selectAll = () => {
        const allSelected = parsedMessages.every(m => m.selected);
        setParsedMessages(prev => prev.map(m => ({ ...m, selected: !allSelected })));
    };

    const importSelected = async () => {
        const selected = parsedMessages.filter(m => m.selected);
        if (selected.length === 0) { addToast('No messages selected', 'error'); return; }

        setImporting(true);
        try {
            const res = await authFetch('/api/whatsapp/bulk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: selected, group_name: pasteGroupName })
            });
            const data = await res.json();
            if (res.ok) {
                addToast(`${data.imported} message(s) imported to inbox!`, 'success');
                setShowPaste(false);
                setPasteText('');
                setParsedMessages([]);
                setPasteGroupName('');
                fetchMessages();
            } else {
                addToast(data.error || 'Import failed', 'error');
            }
        } catch { addToast('Network error', 'error'); }
        setImporting(false);
    };

    const openConvert = (msg) => {
        setConvertForm({
            title: `WhatsApp: ${msg.sender_name || msg.sender_phone || 'Unknown'}`,
            description: msg.message_text,
            company_name: '',
            assigned_tech_id: '',
            priority: 'medium',
            category: 'other'
        });
        setShowConvert(msg);
    };

    const convertMessage = async () => {
        try {
            const res = await authFetch(`/api/whatsapp/convert/${showConvert.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(convertForm)
            });
            const ticket = await res.json();
            addToast(`Ticket ${ticket.ref_number} created!`, 'success');
            setShowConvert(null);
            fetchMessages();
        } catch { addToast('Failed', 'error'); }
    };

    const dismissMessage = async (id) => {
        await authFetch(`/api/whatsapp/dismiss/${id}`, { method: 'POST' });
        addToast('Message dismissed', 'info');
        fetchMessages();
    };

    const dismissAll = async () => {
        if (!messages.length) return;
        if (!confirm('Dismiss all pending messages?')) return;
        try {
            await authFetch('/api/whatsapp/dismiss-bulk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: messages.map(m => m.id) })
            });
            addToast('All messages dismissed', 'info');
            fetchMessages();
        } catch { addToast('Failed', 'error'); }
    };

    if (loading) return <div className="page-body"><div className="loading"><div className="spinner" /></div></div>;

    const selectedCount = parsedMessages.filter(m => m.selected).length;

    return (
        <>
            <div className="page-header">
                <div>
                    <h1 className="page-title">💬 WhatsApp Inbox</h1>
                    <p className="page-subtitle">{messages.length} pending message{messages.length !== 1 ? 's' : ''}</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-primary" onClick={() => setShowPaste(true)}>📋 Paste Chat</button>
                    <button className="btn btn-success" onClick={() => setShowAdd(true)}>💬 Add Single</button>
                    {messages.length > 0 && (
                        <button className="btn btn-danger" onClick={dismissAll}>🗑️ Clear All</button>
                    )}
                </div>
            </div>
            <div className="page-body">
                {messages.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">💬</div>
                        <div className="empty-state-text">No pending messages</div>
                        <div className="empty-state-sub">Use <strong>Paste Chat</strong> to import WhatsApp group messages, then choose which to convert to tickets</div>
                        <button className="btn btn-primary" onClick={() => setShowPaste(true)} style={{ marginTop: 16 }}>📋 Paste WhatsApp Chat</button>
                    </div>
                ) : (
                    messages.map(msg => (
                        <div key={msg.id} className="inbox-item">
                            <div className="inbox-item-header">
                                <div>
                                    <div className="inbox-sender">
                                        {msg.sender_name || 'Unknown'}
                                        {msg.group_name && (
                                            <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-muted)', fontWeight: 400 }}>
                                                in <span style={{ color: '#25D366' }}>{msg.group_name}</span>
                                            </span>
                                        )}
                                    </div>
                                    <div className="inbox-contact">{msg.sender_phone}</div>
                                </div>
                                <div className="inbox-timestamp">{new Date(msg.received_at).toLocaleString()}</div>
                            </div>
                            <div className="inbox-body" style={{ maxHeight: 'none', background: 'var(--surface-1)', padding: 12, borderRadius: 'var(--radius-md)', borderLeft: '3px solid #25D366', whiteSpace: 'pre-wrap' }}>
                                {msg.message_text}
                            </div>
                            <div className="inbox-actions" style={{ marginTop: 12 }}>
                                <button className="btn btn-primary btn-sm" onClick={() => openConvert(msg)}>🎫 Convert to Ticket</button>
                                <button className="btn btn-danger btn-sm" onClick={() => dismissMessage(msg.id)}>✕ Dismiss</button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Paste Chat Modal */}
            {showPaste && (
                <div className="modal-overlay" onClick={() => setShowPaste(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 750 }}>
                        <div className="modal-header">
                            <h2 className="modal-title">📋 Paste WhatsApp Chat</h2>
                            <button className="modal-close" onClick={() => setShowPaste(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            {parsedMessages.length === 0 ? (
                                <>
                                    <div style={{ background: 'var(--surface-1)', padding: 14, borderRadius: 'var(--radius-md)', marginBottom: 16, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, borderLeft: '3px solid #25D366' }}>
                                        <strong>How to use:</strong> Open a WhatsApp group on your phone or WhatsApp Web/Desktop, copy the chat messages, and paste them below. The parser recognizes standard WhatsApp message formats.<br /><br />
                                        <strong>Tip:</strong> On WhatsApp Desktop, select the messages you want, right-click → Copy. On phone, use "Export Chat" (without media) or manually select and copy.
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Group Name (optional)</label>
                                        <input className="form-input" value={pasteGroupName}
                                            onChange={e => setPasteGroupName(e.target.value)}
                                            placeholder="e.g. ABC Company IT Support" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Paste chat messages here *</label>
                                        <textarea className="form-textarea" value={pasteText}
                                            onChange={e => setPasteText(e.target.value)}
                                            placeholder={"[15/02/2026, 10:30:15] John Smith: My printer isn't working\n[15/02/2026, 10:32:00] Jane Doe: Outlook keeps crashing\n[15/02/2026, 10:45:22] John Smith: Also the WiFi is down in office 3"}
                                            rows={12}
                                            style={{ fontFamily: 'monospace', fontSize: 12.5 }} />
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                        <div>
                                            <strong>{parsedMessages.length}</strong> messages parsed — <strong style={{ color: 'var(--primary)' }}>{selectedCount}</strong> selected for import
                                            {pasteGroupName && <span style={{ marginLeft: 8, color: '#25D366' }}>({pasteGroupName})</span>}
                                        </div>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <button className="btn btn-secondary btn-sm" onClick={selectAll}>
                                                {parsedMessages.every(m => m.selected) ? 'Deselect All' : 'Select All'}
                                            </button>
                                            <button className="btn btn-secondary btn-sm" onClick={() => { setParsedMessages([]); }}>
                                                ← Back
                                            </button>
                                        </div>
                                    </div>
                                    <div style={{ maxHeight: 400, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        {parsedMessages.map((msg, i) => (
                                            <div key={i} onClick={() => toggleMessage(i)}
                                                style={{
                                                    display: 'flex', gap: 10, alignItems: 'flex-start',
                                                    padding: '10px 12px', borderRadius: 'var(--radius-md)',
                                                    background: msg.selected ? 'var(--surface-1)' : 'transparent',
                                                    border: `1px solid ${msg.selected ? '#25D366' : 'var(--border-color)'}`,
                                                    cursor: 'pointer', transition: 'all 0.15s ease',
                                                    opacity: msg.selected ? 1 : 0.5
                                                }}>
                                                <div style={{
                                                    width: 20, height: 20, borderRadius: 4, flexShrink: 0, marginTop: 1,
                                                    border: `2px solid ${msg.selected ? '#25D366' : 'var(--text-muted)'}`,
                                                    background: msg.selected ? '#25D366' : 'transparent',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    color: '#fff', fontSize: 12, fontWeight: 700
                                                }}>
                                                    {msg.selected && '✓'}
                                                </div>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                                                        <span style={{ fontWeight: 600, color: 'var(--text-bright)', fontSize: 13 }}>{msg.sender_name}</span>
                                                        <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                                                            {msg.received_at ? new Date(msg.received_at).toLocaleString() : ''}
                                                        </span>
                                                    </div>
                                                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                                        {msg.message_text.length > 200 ? msg.message_text.substring(0, 200) + '…' : msg.message_text}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => { setShowPaste(false); setParsedMessages([]); setPasteText(''); setPasteGroupName(''); }}>Cancel</button>
                            {parsedMessages.length === 0 ? (
                                <button className="btn btn-primary" onClick={handleParse} disabled={!pasteText.trim()}>
                                    🔍 Parse Messages
                                </button>
                            ) : (
                                <button className="btn btn-success" onClick={importSelected} disabled={importing || selectedCount === 0}>
                                    {importing ? '⏳ Importing...' : `📥 Import ${selectedCount} Message${selectedCount !== 1 ? 's' : ''}`}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Add Single Message Modal */}
            {showAdd && (
                <div className="modal-overlay" onClick={() => setShowAdd(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">Add Single Message</h2>
                            <button className="modal-close" onClick={() => setShowAdd(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Sender Name</label>
                                    <input className="form-input" value={addForm.sender_name} onChange={e => setAddForm(f => ({ ...f, sender_name: e.target.value }))} placeholder="Name" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Phone Number</label>
                                    <input className="form-input" value={addForm.sender_phone} onChange={e => setAddForm(f => ({ ...f, sender_phone: e.target.value }))} placeholder="+27..." />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Group Name</label>
                                <input className="form-input" value={addForm.group_name} onChange={e => setAddForm(f => ({ ...f, group_name: e.target.value }))} placeholder="e.g. ABC Company IT Support" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Message *</label>
                                <textarea className="form-textarea" value={addForm.message_text} onChange={e => setAddForm(f => ({ ...f, message_text: e.target.value }))} placeholder="Paste WhatsApp message here..." rows={6} />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
                            <button className="btn btn-success" onClick={addMessage}>💬 Add Message</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Convert to Ticket Modal */}
            {showConvert && (
                <div className="modal-overlay" onClick={() => setShowConvert(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">Convert to Ticket</h2>
                            <button className="modal-close" onClick={() => setShowConvert(null)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div style={{ background: 'var(--surface-1)', padding: 12, borderRadius: 'var(--radius-md)', marginBottom: 16, fontSize: 13, borderLeft: '3px solid #25D366' }}>
                                <div style={{ fontWeight: 600, color: 'var(--text-bright)', marginBottom: 4 }}>
                                    {showConvert.sender_name} {showConvert.sender_phone && `(${showConvert.sender_phone})`}
                                    {showConvert.group_name && <span style={{ fontWeight: 400, color: '#25D366', marginLeft: 8 }}>in {showConvert.group_name}</span>}
                                </div>
                                <div style={{ color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{showConvert.message_text}</div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Ticket Title</label>
                                <input className="form-input" value={convertForm.title} onChange={e => setConvertForm(f => ({ ...f, title: e.target.value }))} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Description</label>
                                <textarea className="form-textarea" value={convertForm.description} onChange={e => setConvertForm(f => ({ ...f, description: e.target.value }))} rows={4} />
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Company</label>
                                    <input className="form-input" value={convertForm.company_name} onChange={e => setConvertForm(f => ({ ...f, company_name: e.target.value }))} placeholder="Type company name" list="wa-company-list" />
                                    <datalist id="wa-company-list">{companies.map(c => <option key={c.id} value={c.name} />)}</datalist>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Assign Tech</label>
                                    <select className="form-select" value={convertForm.assigned_tech_id} onChange={e => setConvertForm(f => ({ ...f, assigned_tech_id: e.target.value }))}>
                                        <option value="">Unassigned</option>
                                        {techs.map(t => <option key={t.id} value={t.id}>{t.name} ({t.type})</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Priority</label>
                                    <select className="form-select" value={convertForm.priority} onChange={e => setConvertForm(f => ({ ...f, priority: e.target.value }))}>
                                        <option value="low">Low</option>
                                        <option value="medium">Medium</option>
                                        <option value="high">High</option>
                                        <option value="critical">Critical</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Category</label>
                                    <select className="form-select" value={convertForm.category} onChange={e => setConvertForm(f => ({ ...f, category: e.target.value }))}>
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
                            <button className="btn btn-secondary" onClick={() => setShowConvert(null)}>Cancel</button>
                            <button className="btn btn-success" onClick={convertMessage}>🎫 Create Ticket</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
