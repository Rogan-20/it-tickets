const express = require('express');
const { db } = require('../db');

const router = express.Router();

// GET /api/techs
router.get('/', async (req, res) => {
    try {
        const { type, status } = req.query;
        let where = [];
        let params = {};

        if (type) { where.push('t.type = @type'); params.type = type; }
        if (status) { where.push('t.status = @status'); params.status = status; }

        const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';

        const techs = await db.all(`
      SELECT t.*,
        (SELECT COUNT(*) FROM tickets WHERE assigned_tech_id = t.id) as total_tickets,
        (SELECT COUNT(*) FROM tickets WHERE assigned_tech_id = t.id AND status NOT IN ('resolved','closed')) as open_tickets
      FROM techs t ${whereClause}
      ORDER BY t.name
    `, params);

        res.json(techs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/techs/:id
router.get('/:id', async (req, res) => {
    try {
        const tech = await db.get('SELECT * FROM techs WHERE id = ?', [req.params.id]);
        if (!tech) return res.status(404).json({ error: 'Tech not found' });
        res.json(tech);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/techs
router.post('/', async (req, res) => {
    try {
        const { name, email, phone, type } = req.body;
        if (!name) return res.status(400).json({ error: 'Tech name is required' });

        const result = await db.run(
            'INSERT INTO techs (name, email, phone, type) VALUES (?, ?, ?, ?)',
            [name, email || '', phone || '', type || 'internal']
        );

        const tech = await db.get('SELECT * FROM techs WHERE id = ?', [result.lastInsertRowid]);
        res.status(201).json(tech);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/techs/:id
router.put('/:id', async (req, res) => {
    try {
        const { name, email, phone, type, status } = req.body;
        await db.run(`
      UPDATE techs SET 
        name = COALESCE(?, name),
        email = COALESCE(?, email),
        phone = COALESCE(?, phone),
        type = COALESCE(?, type),
        status = COALESCE(?, status)
      WHERE id = ?
    `, [name || null, email, phone, type || null, status || null, req.params.id]);

        const tech = await db.get('SELECT * FROM techs WHERE id = ?', [req.params.id]);
        res.json(tech);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/techs/:id
router.delete('/:id', async (req, res) => {
    try {
        await db.run('DELETE FROM techs WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
