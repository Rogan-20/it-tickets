const express = require('express');
const router = express.Router();
const { db } = require('../db');
const emailPoller = require('../services/emailPoller');

// Get all settings (grouped)
router.get('/', async (req, res) => {
    try {
        const rows = await db.all('SELECT key, value, updated_at FROM settings');
        const settings = {};
        rows.forEach(r => {
            if (r.key === 'email_password' && r.value) {
                settings[r.key] = '••••••••';
            } else {
                settings[r.key] = r.value;
            }
        });
        res.json(settings);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Save settings (batch)
router.put('/', async (req, res) => {
    try {
        const entries = req.body;
        for (const [key, value] of Object.entries(entries)) {
            await db.run(`
        INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
      `, [key, value]);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get email settings + status
router.get('/email', async (req, res) => {
    try {
        const status = await emailPoller.getStatus();
        const row = await db.get("SELECT COUNT(*) as count FROM email_pending WHERE status = 'pending'");
        res.json({ ...status, pendingCount: row.count });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Save email settings & restart poller
router.put('/email', async (req, res) => {
    try {
        const { host, port, user, password, tls, folder, poll_interval, mark_read } = req.body;

        const upsert = async (key, value) => {
            await db.run(`
        INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
      `, [key, value]);
        };

        if (host !== undefined) await upsert('email_host', host);
        if (port !== undefined) await upsert('email_port', String(port));
        if (user !== undefined) await upsert('email_user', user);
        if (password !== undefined && password !== '••••••••') await upsert('email_password', password);
        if (tls !== undefined) await upsert('email_tls', String(tls));
        if (folder !== undefined) await upsert('email_folder', folder);
        if (poll_interval !== undefined) await upsert('email_poll_interval', String(poll_interval));
        if (mark_read !== undefined) await upsert('email_mark_read', String(mark_read));

        // Restart polling if configured
        const configured = await emailPoller.isConfigured();
        if (configured) {
            const interval = parseInt(poll_interval || '2');
            emailPoller.startAutoPolling(interval);
        }

        const status = await emailPoller.getStatus();
        res.json({ success: true, status });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Test email connection
router.post('/email/test', async (req, res) => {
    try {
        const result = await emailPoller.fetchNewEmails();
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Start/stop polling
router.post('/email/polling', async (req, res) => {
    const { action, interval } = req.body;
    if (action === 'start') {
        const configured = await emailPoller.isConfigured();
        if (!configured) {
            return res.status(400).json({ error: 'Email not configured' });
        }
        emailPoller.startAutoPolling(parseInt(interval || '2'));
        res.json({ polling: true });
    } else if (action === 'stop') {
        emailPoller.stopAutoPolling();
        res.json({ polling: false });
    } else {
        res.status(400).json({ error: 'Invalid action' });
    }
});

module.exports = router;
