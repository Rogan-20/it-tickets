const express = require('express');
const { db, getNextRefNumber } = require('../db');

const router = express.Router();

// GET /api/email/pending - list pending email tickets
router.get('/pending', async (req, res) => {
    try {
        const emails = await db.all("SELECT * FROM email_pending WHERE status = 'pending' ORDER BY received_at DESC");
        res.json(emails);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/email/simulate - simulate incoming email (for testing / manual entry)
router.post('/simulate', async (req, res) => {
    try {
        const { from_address, from_name, subject, body } = req.body;
        if (!subject) return res.status(400).json({ error: 'Subject is required' });

        const result = await db.run(
            'INSERT INTO email_pending (from_address, from_name, subject, body, received_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)',
            [from_address || '', from_name || '', subject, body || '']
        );

        const email = await db.get('SELECT * FROM email_pending WHERE id = ?', [result.lastInsertRowid]);
        res.status(201).json(email);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/email/approve/:id - approve and create ticket from email
router.post('/approve/:id', async (req, res) => {
    try {
        const email = await db.get('SELECT * FROM email_pending WHERE id = ?', [req.params.id]);
        if (!email) return res.status(404).json({ error: 'Email not found' });

        const { title, description, company_id, company_name, assigned_tech_id, priority, category } = req.body;

        let finalCompanyId = company_id || null;
        if (!company_id && company_name) {
            const existing = await db.get('SELECT id FROM companies WHERE name = ?', [company_name]);
            if (existing) {
                finalCompanyId = existing.id;
            } else {
                const result = await db.run('INSERT INTO companies (name) VALUES (?)', [company_name]);
                finalCompanyId = result.lastInsertRowid;
            }
        }

        const refNumber = await getNextRefNumber();

        const result = await db.run(`
      INSERT INTO tickets (ref_number, title, description, company_id, assigned_tech_id, priority, source, category,
        contact_name, contact_email)
      VALUES (?, ?, ?, ?, ?, ?, 'email', ?, ?, ?)
    `, [
            refNumber,
            title || email.subject,
            description || email.body,
            finalCompanyId,
            assigned_tech_id || null,
            priority || 'medium',
            category || 'other',
            email.from_name,
            email.from_address
        ]);

        await db.run("UPDATE email_pending SET status = 'approved' WHERE id = ?", [req.params.id]);

        await db.run("INSERT INTO ticket_updates (ticket_id, update_text, updated_by, update_type) VALUES (?, ?, 'System', 'note')",
            [result.lastInsertRowid, `Ticket created from email: "${email.subject}" from ${email.from_name} <${email.from_address}>`]);

        const ticket = await db.get('SELECT * FROM tickets WHERE id = ?', [result.lastInsertRowid]);
        res.status(201).json(ticket);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/email/dismiss/:id - dismiss email
router.post('/dismiss/:id', async (req, res) => {
    try {
        await db.run("UPDATE email_pending SET status = 'dismissed' WHERE id = ?", [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
