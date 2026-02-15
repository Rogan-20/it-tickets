const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../db');
const { generateToken, requireAuth } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        const user = await db.get('SELECT * FROM users WHERE username = ? AND active = 1', [username.toLowerCase().trim()]);
        if (!user) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        const valid = bcrypt.compareSync(password, user.password_hash);
        if (!valid) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        const token = generateToken(user);
        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                display_name: user.display_name,
                role: user.role
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/auth/me - get current user from token
router.get('/me', requireAuth, async (req, res) => {
    try {
        const user = await db.get('SELECT id, username, display_name, role, active FROM users WHERE id = ?', [req.user.id]);
        if (!user || !user.active) {
            return res.status(401).json({ error: 'User not found or inactive' });
        }
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/auth/password - change own password
router.put('/password', requireAuth, async (req, res) => {
    try {
        const { current_password, new_password } = req.body;
        if (!current_password || !new_password) {
            return res.status(400).json({ error: 'Current and new passwords are required' });
        }
        if (new_password.length < 4) {
            return res.status(400).json({ error: 'Password must be at least 4 characters' });
        }

        const user = await db.get('SELECT * FROM users WHERE id = ?', [req.user.id]);
        if (!bcrypt.compareSync(current_password, user.password_hash)) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }

        const hash = bcrypt.hashSync(new_password, 10);
        await db.run('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [hash, req.user.id]);
        res.json({ success: true, message: 'Password changed successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
