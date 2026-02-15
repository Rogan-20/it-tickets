import { useState, useEffect } from 'react';

export default function UserManagement({ addToast, authFetch }) {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [showEdit, setShowEdit] = useState(null);
    const [createForm, setCreateForm] = useState({ username: '', display_name: '', password: '', role: 'receptionist' });
    const [editForm, setEditForm] = useState({ display_name: '', role: '', new_password: '' });

    const fetchUsers = () => {
        authFetch('/api/users').then(r => r.json()).then(d => { setUsers(d); setLoading(false); }).catch(() => setLoading(false));
    };

    useEffect(() => { fetchUsers(); }, []);

    const createUser = async () => {
        if (!createForm.username || !createForm.display_name || !createForm.password) {
            addToast('All fields are required', 'error'); return;
        }
        try {
            const res = await authFetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(createForm)
            });
            const data = await res.json();
            if (!res.ok) { addToast(data.error || 'Failed', 'error'); return; }
            addToast(`User "${data.display_name}" created!`, 'success');
            setShowCreate(false);
            setCreateForm({ username: '', display_name: '', password: '', role: 'receptionist' });
            fetchUsers();
        } catch { addToast('Network error', 'error'); }
    };

    const openEdit = (user) => {
        setEditForm({ display_name: user.display_name, role: user.role, new_password: '' });
        setShowEdit(user);
    };

    const saveEdit = async () => {
        try {
            const body = {};
            if (editForm.display_name !== showEdit.display_name) body.display_name = editForm.display_name;
            if (editForm.role !== showEdit.role) body.role = editForm.role;
            if (editForm.new_password) body.new_password = editForm.new_password;

            const res = await authFetch(`/api/users/${showEdit.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            if (!res.ok) { const d = await res.json(); addToast(d.error || 'Failed', 'error'); return; }
            addToast('User updated', 'success');
            setShowEdit(null);
            fetchUsers();
        } catch { addToast('Network error', 'error'); }
    };

    const toggleActive = async (user) => {
        const action = user.active ? 'deactivate' : 'reactivate';
        if (user.active && !confirm(`Are you sure you want to ${action} ${user.display_name}?`)) return;
        try {
            if (user.active) {
                await authFetch(`/api/users/${user.id}`, { method: 'DELETE' });
            } else {
                await authFetch(`/api/users/${user.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ active: true })
                });
            }
            addToast(`User ${action}d`, 'success');
            fetchUsers();
        } catch { addToast('Failed', 'error'); }
    };

    const roleColors = { admin: '#ef4444', tech: '#3b82f6', receptionist: '#22c55e' };
    const roleLabels = { admin: 'Admin', tech: 'Technician', receptionist: 'Receptionist' };

    if (loading) return <div className="page-body"><div className="loading"><div className="spinner" /></div></div>;

    return (
        <>
            <div className="page-header">
                <div>
                    <h1 className="page-title">👥 User Management</h1>
                    <p className="page-subtitle">{users.filter(u => u.active).length} active user{users.filter(u => u.active).length !== 1 ? 's' : ''}</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowCreate(true)}>➕ Add User</button>
            </div>
            <div className="page-body">
                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Username</th>
                                <th>Display Name</th>
                                <th>Role</th>
                                <th>Status</th>
                                <th>Created</th>
                                <th style={{ width: 140 }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(u => (
                                <tr key={u.id} style={{ opacity: u.active ? 1 : 0.5 }}>
                                    <td style={{ fontWeight: 600, fontFamily: 'monospace' }}>{u.username}</td>
                                    <td>{u.display_name}</td>
                                    <td>
                                        <span style={{
                                            display: 'inline-block', padding: '3px 10px', borderRadius: 12,
                                            fontSize: 11, fontWeight: 600, letterSpacing: 0.3,
                                            background: `${roleColors[u.role]}22`,
                                            color: roleColors[u.role],
                                            border: `1px solid ${roleColors[u.role]}44`
                                        }}>
                                            {roleLabels[u.role]}
                                        </span>
                                    </td>
                                    <td>
                                        <span className={`badge badge-${u.active ? 'open' : 'closed'}`}>
                                            {u.active ? '● Active' : '○ Inactive'}
                                        </span>
                                    </td>
                                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(u.created_at).toLocaleDateString()}</td>
                                    <td>
                                        <div style={{ display: 'flex', gap: 6 }}>
                                            <button className="btn btn-secondary btn-sm" onClick={() => openEdit(u)}>✏️</button>
                                            <button className={`btn btn-${u.active ? 'danger' : 'success'} btn-sm`}
                                                onClick={() => toggleActive(u)}>
                                                {u.active ? '🚫' : '✅'}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create User Modal */}
            {showCreate && (
                <div className="modal-overlay" onClick={() => setShowCreate(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">Create New User</h2>
                            <button className="modal-close" onClick={() => setShowCreate(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label className="form-label">Username *</label>
                                <input className="form-input" value={createForm.username}
                                    onChange={e => setCreateForm(f => ({ ...f, username: e.target.value }))}
                                    placeholder="e.g. john" autoComplete="off" />
                                <small style={{ color: 'var(--text-muted)', fontSize: 11 }}>Lowercase, used for login</small>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Display Name *</label>
                                <input className="form-input" value={createForm.display_name}
                                    onChange={e => setCreateForm(f => ({ ...f, display_name: e.target.value }))}
                                    placeholder="e.g. John Smith" />
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Password *</label>
                                    <input className="form-input" type="password" value={createForm.password}
                                        onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))}
                                        placeholder="Min 4 characters" autoComplete="new-password" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Role</label>
                                    <select className="form-select" value={createForm.role}
                                        onChange={e => setCreateForm(f => ({ ...f, role: e.target.value }))}>
                                        <option value="receptionist">Receptionist</option>
                                        <option value="tech">Technician</option>
                                        <option value="admin">Admin</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={createUser}>➕ Create User</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit User Modal */}
            {showEdit && (
                <div className="modal-overlay" onClick={() => setShowEdit(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">Edit User: {showEdit.username}</h2>
                            <button className="modal-close" onClick={() => setShowEdit(null)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label className="form-label">Display Name</label>
                                <input className="form-input" value={editForm.display_name}
                                    onChange={e => setEditForm(f => ({ ...f, display_name: e.target.value }))} />
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Role</label>
                                    <select className="form-select" value={editForm.role}
                                        onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}>
                                        <option value="receptionist">Receptionist</option>
                                        <option value="tech">Technician</option>
                                        <option value="admin">Admin</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Reset Password</label>
                                    <input className="form-input" type="password" value={editForm.new_password}
                                        onChange={e => setEditForm(f => ({ ...f, new_password: e.target.value }))}
                                        placeholder="Leave blank to keep current" autoComplete="new-password" />
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowEdit(null)}>Cancel</button>
                            <button className="btn btn-primary" onClick={saveEdit}>💾 Save Changes</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
