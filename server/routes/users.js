const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// All routes require admin
router.use(requireAuth, requireAdmin);

// GET /api/users - list all users
router.get('/', async (req, res) => {
    try {
        const users = await db.all(
            `SELECT u.id, u.username, u.display_name, u.role, u.tech_id, u.active, u.created_at, u.updated_at,
             t.name as tech_name
             FROM users u LEFT JOIN techs t ON u.tech_id = t.id
             ORDER BY u.role, u.display_name`
        );
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/users - create user
router.post('/', async (req, res) => {
    try {
        const { username, display_name, password, role, tech_id } = req.body;
        if (!username || !password || !display_name) {
            return res.status(400).json({ error: 'Username, display name, and password are required' });
        }
        if (password.length < 4) {
            return res.status(400).json({ error: 'Password must be at least 4 characters' });
        }

        const existing = await db.get('SELECT id FROM users WHERE username = ?', [username.toLowerCase().trim()]);
        if (existing) {
            return res.status(409).json({ error: 'Username already exists' });
        }

        const hash = bcrypt.hashSync(password, 10);
        const validRole = ['admin', 'tech', 'receptionist'].includes(role) ? role : 'receptionist';

        const result = await db.run(
            'INSERT INTO users (username, display_name, password_hash, role, tech_id) VALUES (?, ?, ?, ?, ?)',
            [username.toLowerCase().trim(), display_name.trim(), hash, validRole, tech_id || null]
        );

        const user = await db.get(
            'SELECT id, username, display_name, role, tech_id, active, created_at FROM users WHERE id = ?',
            [result.lastInsertRowid]
        );

        res.status(201).json(user);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/users/:id - update user
router.put('/:id', async (req, res) => {
    try {
        const user = await db.get('SELECT * FROM users WHERE id = ?', [req.params.id]);
        if (!user) return res.status(404).json({ error: 'User not found' });

        const { display_name, role, active, new_password, tech_id } = req.body;

        if (display_name) {
            await db.run('UPDATE users SET display_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [display_name.trim(), req.params.id]);
        }
        if (role && ['admin', 'tech', 'receptionist'].includes(role)) {
            await db.run('UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [role, req.params.id]);
        }
        if (active !== undefined) {
            await db.run('UPDATE users SET active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [active ? 1 : 0, req.params.id]);
        }
        if (new_password && new_password.length >= 4) {
            const hash = bcrypt.hashSync(new_password, 10);
            await db.run('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [hash, req.params.id]);
        }
        if (tech_id !== undefined) {
            await db.run('UPDATE users SET tech_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [tech_id || null, req.params.id]);
        }

        const updated = await db.get(
            'SELECT id, username, display_name, role, tech_id, active, created_at, updated_at FROM users WHERE id = ?',
            [req.params.id]
        );
        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/users/:id - deactivate user (don't actually delete)
router.delete('/:id', async (req, res) => {
    try {
        if (parseInt(req.params.id) === req.user.id) {
            return res.status(400).json({ error: 'Cannot deactivate your own account' });
        }
        await db.run('UPDATE users SET active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
