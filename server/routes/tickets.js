const express = require('express');
const { db, getNextRefNumber } = require('../db');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '..', '..', 'uploads'));
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${uuidv4()}${ext}`);
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|gif|webp|bmp|svg/;
        const ext = allowed.test(path.extname(file.originalname).toLowerCase());
        const mime = allowed.test(file.mimetype.split('/')[1]);
        cb(null, ext || mime);
    }
});

// GET /api/tickets - list tickets with filters
router.get('/', async (req, res) => {
    try {
        const { status, priority, company_id, tech_id, search, source, category, limit = 100, offset = 0 } = req.query;

        let where = [];
        let params = {};

        if (status) { where.push('t.status = @status'); params.status = status; }
        if (priority) { where.push('t.priority = @priority'); params.priority = priority; }
        if (company_id) { where.push('t.company_id = @company_id'); params.company_id = company_id; }
        if (tech_id) { where.push('t.assigned_tech_id = @tech_id'); params.tech_id = tech_id; }
        if (source) { where.push('t.source = @source'); params.source = source; }
        if (category) { where.push('t.category = @category'); params.category = category; }
        if (search) {
            where.push('(t.title LIKE @search OR t.description LIKE @search OR t.ref_number LIKE @search OR t.contact_name LIKE @search)');
            params.search = `%${search}%`;
        }

        const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';

        const tickets = await db.all(`
      SELECT t.*, c.name as company_name, te.name as tech_name, te.type as tech_type,
        (SELECT COUNT(*) FROM ticket_updates WHERE ticket_id = t.id) as update_count,
        (SELECT COUNT(*) FROM ticket_photos WHERE ticket_id = t.id) as photo_count
      FROM tickets t
      LEFT JOIN companies c ON t.company_id = c.id
      LEFT JOIN techs te ON t.assigned_tech_id = te.id
      ${whereClause}
      ORDER BY 
        CASE t.priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
        t.created_at DESC
      LIMIT @limit OFFSET @offset
    `, { ...params, limit: parseInt(limit), offset: parseInt(offset) });

        const total = await db.get(`SELECT COUNT(*) as count FROM tickets t ${whereClause}`, params);

        const stats = {
            total: (await db.get('SELECT COUNT(*) as c FROM tickets')).c,
            new_count: (await db.get("SELECT COUNT(*) as c FROM tickets WHERE status = 'new'")).c,
            open: (await db.get("SELECT COUNT(*) as c FROM tickets WHERE status IN ('open','in_progress')")).c,
            critical: (await db.get("SELECT COUNT(*) as c FROM tickets WHERE priority = 'critical' AND status NOT IN ('resolved','closed')")).c,
            resolved_today: (await db.get("SELECT COUNT(*) as c FROM tickets WHERE status = 'resolved' AND DATE(updated_at) = CURRENT_DATE")).c || 0,
            waiting: (await db.get("SELECT COUNT(*) as c FROM tickets WHERE status = 'waiting'")).c,
        };

        res.json({ tickets, total: total.count, stats });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/tickets/:id - get single ticket with updates and photos
router.get('/:id', async (req, res) => {
    try {
        const ticket = await db.get(`
      SELECT t.*, c.name as company_name, c.contact_email as company_email, c.contact_phone as company_phone,
        te.name as tech_name, te.type as tech_type, te.email as tech_email, te.phone as tech_phone
      FROM tickets t
      LEFT JOIN companies c ON t.company_id = c.id
      LEFT JOIN techs te ON t.assigned_tech_id = te.id
      WHERE t.id = ?
    `, [req.params.id]);

        if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

        const updates = await db.all('SELECT * FROM ticket_updates WHERE ticket_id = ? ORDER BY created_at DESC', [req.params.id]);
        const photos = await db.all('SELECT * FROM ticket_photos WHERE ticket_id = ? ORDER BY uploaded_at DESC', [req.params.id]);

        res.json({ ...ticket, updates, photos });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/tickets - create ticket
router.post('/', upload.array('photos', 10), async (req, res) => {
    try {
        const { title, description, company_id, company_name, assigned_tech_id, priority, source, category,
            contact_name, contact_email, contact_phone, recurring_schedule, due_date } = req.body;

        if (!title) return res.status(400).json({ error: 'Title is required' });

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
        contact_name, contact_email, contact_phone, recurring_schedule, due_date)
      VALUES (@ref, @title, @desc, @company, @tech, @priority, @source, @category,
        @cname, @cemail, @cphone, @recurring, @due)
    `, {
            ref: refNumber,
            title,
            desc: description || '',
            company: finalCompanyId,
            tech: assigned_tech_id || null,
            priority: priority || 'medium',
            source: source || 'walk_in',
            category: category || 'other',
            cname: contact_name || '',
            cemail: contact_email || '',
            cphone: contact_phone || '',
            recurring: recurring_schedule || null,
            due: due_date || null
        });

        const ticketId = result.lastInsertRowid;

        // Handle photo uploads
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                await db.run('INSERT INTO ticket_photos (ticket_id, filename, original_name, filepath) VALUES (?, ?, ?, ?)',
                    [ticketId, file.filename, file.originalname, `/uploads/${file.filename}`]);
            }
        }

        await db.run("INSERT INTO ticket_updates (ticket_id, update_text, updated_by, update_type) VALUES (?, ?, ?, 'note')",
            [ticketId, 'Ticket created', 'System']);

        const ticket = await db.get('SELECT * FROM tickets WHERE id = ?', [ticketId]);
        res.status(201).json(ticket);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/tickets/:id - update ticket
router.put('/:id', async (req, res) => {
    try {
        const ticket = await db.get('SELECT * FROM tickets WHERE id = ?', [req.params.id]);
        if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

        const { title, description, company_id, assigned_tech_id, priority, status, category,
            contact_name, contact_email, contact_phone, recurring_schedule, due_date } = req.body;

        const changes = [];

        if (status && status !== ticket.status) {
            changes.push(`Status changed from ${ticket.status} to ${status}`);
        }
        if (assigned_tech_id && assigned_tech_id !== ticket.assigned_tech_id) {
            const tech = await db.get('SELECT name FROM techs WHERE id = ?', [assigned_tech_id]);
            changes.push(`Assigned to ${tech ? tech.name : 'Unknown'}`);
        }
        if (priority && priority !== ticket.priority) {
            changes.push(`Priority changed from ${ticket.priority} to ${priority}`);
        }

        await db.run(`
      UPDATE tickets SET 
        title = COALESCE(@title, title),
        description = COALESCE(@description, description),
        company_id = COALESCE(@company_id, company_id),
        assigned_tech_id = COALESCE(@assigned_tech_id, assigned_tech_id),
        priority = COALESCE(@priority, priority),
        status = COALESCE(@status, status),
        category = COALESCE(@category, category),
        contact_name = COALESCE(@contact_name, contact_name),
        contact_email = COALESCE(@contact_email, contact_email),
        contact_phone = COALESCE(@contact_phone, contact_phone),
        recurring_schedule = COALESCE(@recurring_schedule, recurring_schedule),
        due_date = COALESCE(@due_date, due_date),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = @id
    `, {
            id: req.params.id,
            title: title || null,
            description: description !== undefined ? description : null,
            company_id: company_id || null,
            assigned_tech_id: assigned_tech_id || null,
            priority: priority || null,
            status: status || null,
            category: category || null,
            contact_name: contact_name !== undefined ? contact_name : null,
            contact_email: contact_email !== undefined ? contact_email : null,
            contact_phone: contact_phone !== undefined ? contact_phone : null,
            recurring_schedule: recurring_schedule !== undefined ? recurring_schedule : null,
            due_date: due_date !== undefined ? due_date : null
        });

        if (changes.length > 0) {
            const updateType = changes.some(c => c.includes('Status')) ? 'status_change' :
                changes.some(c => c.includes('Assigned')) ? 'assignment' : 'note';
            await db.run('INSERT INTO ticket_updates (ticket_id, update_text, updated_by, update_type) VALUES (?, ?, ?, ?)',
                [req.params.id, changes.join('; '), req.body.updated_by || 'System', updateType]);
        }

        const updated = await db.get(`
      SELECT t.*, c.name as company_name, te.name as tech_name
      FROM tickets t
      LEFT JOIN companies c ON t.company_id = c.id
      LEFT JOIN techs te ON t.assigned_tech_id = te.id
      WHERE t.id = ?
    `, [req.params.id]);

        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/tickets/:id/updates - add update note
router.post('/:id/updates', async (req, res) => {
    try {
        const { update_text, updated_by, update_type } = req.body;
        if (!update_text) return res.status(400).json({ error: 'Update text is required' });

        await db.run('INSERT INTO ticket_updates (ticket_id, update_text, updated_by, update_type) VALUES (?, ?, ?, ?)',
            [req.params.id, update_text, updated_by || 'Tech', update_type || 'note']);

        await db.run('UPDATE tickets SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [req.params.id]);

        const updates = await db.all('SELECT * FROM ticket_updates WHERE ticket_id = ? ORDER BY created_at DESC', [req.params.id]);
        res.status(201).json(updates);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/tickets/:id/photos - upload photos to existing ticket
router.post('/:id/photos', upload.array('photos', 10), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No photos uploaded' });

        for (const file of req.files) {
            await db.run('INSERT INTO ticket_photos (ticket_id, filename, original_name, filepath) VALUES (?, ?, ?, ?)',
                [req.params.id, file.filename, file.originalname, `/uploads/${file.filename}`]);
        }

        const photos = await db.all('SELECT * FROM ticket_photos WHERE ticket_id = ? ORDER BY uploaded_at DESC', [req.params.id]);
        res.status(201).json(photos);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/tickets/:id
router.delete('/:id', async (req, res) => {
    try {
        await db.run('DELETE FROM tickets WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
