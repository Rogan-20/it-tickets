const express = require('express');
const { db, getNextRefNumber } = require('../db');

const router = express.Router();

// GET /api/whatsapp/messages - list messages
router.get('/messages', async (req, res) => {
    try {
        const { status } = req.query;
        const where = status ? "WHERE status = ?" : "";
        const messages = await db.all(`SELECT * FROM whatsapp_messages ${where} ORDER BY received_at DESC`, status ? [status] : []);
        res.json(messages);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/whatsapp/messages - manually add a single WhatsApp message
router.post('/messages', async (req, res) => {
    try {
        const { sender_name, sender_phone, group_name, message_text, received_at } = req.body;
        if (!message_text) return res.status(400).json({ error: 'Message text is required' });

        const result = await db.run(
            'INSERT INTO whatsapp_messages (sender_name, sender_phone, group_name, message_text, received_at) VALUES (?, ?, ?, ?, ?)',
            [sender_name || '', sender_phone || '', group_name || '', message_text, received_at || new Date().toISOString()]
        );

        const msg = await db.get('SELECT * FROM whatsapp_messages WHERE id = ?', [result.lastInsertRowid]);
        res.status(201).json(msg);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/whatsapp/bulk - bulk import parsed WhatsApp messages
router.post('/bulk', async (req, res) => {
    try {
        const { messages, group_name } = req.body;
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({ error: 'No messages provided' });
        }

        let imported = 0;
        for (const msg of messages) {
            if (!msg.message_text || !msg.message_text.trim()) continue;
            await db.run(
                'INSERT INTO whatsapp_messages (sender_name, sender_phone, group_name, message_text, received_at) VALUES (?, ?, ?, ?, ?)',
                [msg.sender_name || '', msg.sender_phone || '', group_name || msg.group_name || '', msg.message_text.trim(), msg.received_at || new Date().toISOString()]
            );
            imported++;
        }

        res.status(201).json({ imported, message: `${imported} message(s) imported` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/whatsapp/convert/:id - convert message to ticket
router.post('/convert/:id', async (req, res) => {
    try {
        const msg = await db.get('SELECT * FROM whatsapp_messages WHERE id = ?', [req.params.id]);
        if (!msg) return res.status(404).json({ error: 'Message not found' });

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
        contact_name, contact_phone)
      VALUES (?, ?, ?, ?, ?, ?, 'whatsapp', ?, ?, ?)
    `, [
            refNumber,
            title || `WhatsApp from ${msg.sender_name || msg.sender_phone}`,
            description || msg.message_text,
            finalCompanyId,
            assigned_tech_id || null,
            priority || 'medium',
            category || 'other',
            msg.sender_name,
            msg.sender_phone
        ]);

        await db.run("UPDATE whatsapp_messages SET status = 'converted' WHERE id = ?", [req.params.id]);

        const groupInfo = msg.group_name ? ` (Group: ${msg.group_name})` : '';
        await db.run("INSERT INTO ticket_updates (ticket_id, update_text, updated_by, update_type) VALUES (?, ?, 'System', 'note')",
            [result.lastInsertRowid, `Ticket created from WhatsApp message from ${msg.sender_name} (${msg.sender_phone})${groupInfo}`]);

        const ticket = await db.get('SELECT * FROM tickets WHERE id = ?', [result.lastInsertRowid]);
        res.status(201).json(ticket);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/whatsapp/dismiss/:id
router.post('/dismiss/:id', async (req, res) => {
    try {
        await db.run("UPDATE whatsapp_messages SET status = 'dismissed' WHERE id = ?", [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/whatsapp/dismiss-bulk - dismiss multiple messages
router.post('/dismiss-bulk', async (req, res) => {
    try {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids)) return res.status(400).json({ error: 'No IDs provided' });

        for (const id of ids) {
            await db.run("UPDATE whatsapp_messages SET status = 'dismissed' WHERE id = ?", [id]);
        }
        res.json({ success: true, dismissed: ids.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
