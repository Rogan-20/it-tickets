const express = require('express');
const { db } = require('../db');

const router = express.Router();

// GET /api/companies
router.get('/', async (req, res) => {
    try {
        const companies = await db.all(`
      SELECT c.*, 
        (SELECT COUNT(*) FROM tickets WHERE company_id = c.id) as ticket_count,
        (SELECT COUNT(*) FROM tickets WHERE company_id = c.id AND status NOT IN ('resolved','closed')) as open_tickets
      FROM companies c ORDER BY c.name
    `);
        res.json(companies);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/companies/:id
router.get('/:id', async (req, res) => {
    try {
        const company = await db.get('SELECT * FROM companies WHERE id = ?', [req.params.id]);
        if (!company) return res.status(404).json({ error: 'Company not found' });
        res.json(company);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/companies
router.post('/', async (req, res) => {
    try {
        const { name, contact_email, contact_phone, address, notes } = req.body;
        if (!name) return res.status(400).json({ error: 'Company name is required' });

        const result = await db.run(
            'INSERT INTO companies (name, contact_email, contact_phone, address, notes) VALUES (?, ?, ?, ?, ?)',
            [name, contact_email || '', contact_phone || '', address || '', notes || '']
        );

        const company = await db.get('SELECT * FROM companies WHERE id = ?', [result.lastInsertRowid]);
        res.status(201).json(company);
    } catch (err) {
        if (err.message.includes('UNIQUE') || err.message.includes('unique') || err.message.includes('duplicate')) {
            return res.status(409).json({ error: 'Company name already exists' });
        }
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/companies/:id
router.put('/:id', async (req, res) => {
    try {
        const { name, contact_email, contact_phone, address, notes } = req.body;
        await db.run(`
      UPDATE companies SET 
        name = COALESCE(?, name),
        contact_email = COALESCE(?, contact_email),
        contact_phone = COALESCE(?, contact_phone),
        address = COALESCE(?, address),
        notes = COALESCE(?, notes)
      WHERE id = ?
    `, [name || null, contact_email, contact_phone, address, notes, req.params.id]);

        const company = await db.get('SELECT * FROM companies WHERE id = ?', [req.params.id]);
        res.json(company);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/companies/:id
router.delete('/:id', async (req, res) => {
    try {
        await db.run('DELETE FROM companies WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
