const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { db, initializeDatabase } = require('./db');
const { requireAuth, requireAdmin } = require('./middleware/auth');
const { startScheduler } = require('./services/scheduler');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

// Public routes (no auth required)
app.use('/api/auth', require('./routes/auth'));

// Health check (public)
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Protected routes (require login)
app.use('/api/tickets', requireAuth, require('./routes/tickets'));
app.use('/api/companies', requireAuth, require('./routes/companies'));
app.use('/api/techs', requireAuth, require('./routes/techs'));
app.use('/api/email', requireAuth, require('./routes/email'));
app.use('/api/whatsapp', requireAuth, require('./routes/whatsapp'));
app.use('/api/notifications', requireAuth, require('./routes/notifications'));

// Admin-only routes
app.use('/api/settings', requireAuth, requireAdmin, require('./routes/settings'));
app.use('/api/users', requireAuth, requireAdmin, require('./routes/users'));

// Serve frontend in production
const distPath = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    // SPA fallback — serve index.html for all non-API routes
    app.get('*', (req, res) => {
        if (!req.path.startsWith('/api/')) {
            res.sendFile(path.join(distPath, 'index.html'));
        }
    });
}

// Initialize database and start server
async function start() {
    try {
        await initializeDatabase();
        console.log('[DB] Database initialized');

        // Start scheduler
        startScheduler();

        // Start email polling if configured
        const emailPoller = require('./services/emailPoller');
        await emailPoller.tryAutoStart();

        app.listen(PORT, '0.0.0.0', () => {
            console.log(`\n🎫 IT Ticket Server running on http://localhost:${PORT}`);
            console.log(`   API: http://localhost:${PORT}/api/health`);
            const os = require('os');
            const nets = os.networkInterfaces();
            for (const iface of Object.values(nets)) {
                for (const net of iface) {
                    if (net.family === 'IPv4' && !net.internal) {
                        console.log(`   Network: http://${net.address}:${PORT}`);
                    }
                }
            }
            console.log();
        });
    } catch (err) {
        console.error('[STARTUP] Failed to initialize:', err);
        process.exit(1);
    }
}

start();
