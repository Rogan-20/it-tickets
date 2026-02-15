const express = require('express');
const { db } = require('../db');
const webpush = require('web-push');
const cron = require('node-cron');

const router = express.Router();

// Generate VAPID keys if not already done
let vapidKeys;
try {
    const fs = require('fs');
    const path = require('path');
    const keysPath = path.join(__dirname, '..', '..', 'data', 'vapid-keys.json');
    if (fs.existsSync(keysPath)) {
        vapidKeys = JSON.parse(fs.readFileSync(keysPath, 'utf-8'));
    } else {
        vapidKeys = webpush.generateVAPIDKeys();
        const dataDir = path.dirname(keysPath);
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
        fs.writeFileSync(keysPath, JSON.stringify(vapidKeys, null, 2));
    }
} catch (e) {
    vapidKeys = webpush.generateVAPIDKeys();
}

webpush.setVapidDetails(
    'mailto:tickets@localhost',
    vapidKeys.publicKey,
    vapidKeys.privateKey
);

// GET /api/notifications/vapid-key
router.get('/vapid-key', (req, res) => {
    res.json({ publicKey: vapidKeys.publicKey });
});

// POST /api/notifications/subscribe
router.post('/subscribe', async (req, res) => {
    try {
        const { endpoint, keys, user_name } = req.body;
        if (!endpoint || !keys) return res.status(400).json({ error: 'Invalid subscription' });

        await db.run(`
      INSERT INTO push_subscriptions (endpoint, keys_p256dh, keys_auth, user_name)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(endpoint) DO UPDATE SET keys_p256dh = excluded.keys_p256dh, keys_auth = excluded.keys_auth, user_name = excluded.user_name
    `, [endpoint, keys.p256dh, keys.auth, user_name || 'Unknown']);

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Send notification to all subscribers
async function sendNotificationToAll(title, body, url) {
    const subscriptions = await db.all('SELECT * FROM push_subscriptions');
    const payload = JSON.stringify({ title, body, url: url || '/' });

    const results = [];
    for (const sub of subscriptions) {
        try {
            await webpush.sendNotification({
                endpoint: sub.endpoint,
                keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth }
            }, payload);
            results.push({ endpoint: sub.endpoint, success: true });
        } catch (err) {
            if (err.statusCode === 404 || err.statusCode === 410) {
                await db.run('DELETE FROM push_subscriptions WHERE id = ?', [sub.id]);
            }
            results.push({ endpoint: sub.endpoint, success: false, error: err.message });
        }
    }
    return results;
}

// POST /api/notifications/send-reminders (manual trigger)
router.post('/send-reminders', async (req, res) => {
    try {
        const row = await db.get("SELECT COUNT(*) as c FROM tickets WHERE status NOT IN ('resolved','closed')");
        const openCount = row.c;
        if (openCount > 0) {
            const results = await sendNotificationToAll(
                '🔧 Ticket Reminder',
                `You have ${openCount} open ticket${openCount > 1 ? 's' : ''} — tap to review and update.`,
                '/tickets'
            );
            res.json({ sent: results.length, results });
        } else {
            res.json({ sent: 0, message: 'No open tickets' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Schedule daily 5 PM reminders
cron.schedule('0 17 * * 1-5', async () => {
    console.log('[CRON] Sending end-of-day ticket reminders...');
    try {
        const row = await db.get("SELECT COUNT(*) as c FROM tickets WHERE status NOT IN ('resolved','closed')");
        const openCount = row.c;
        if (openCount > 0) {
            await sendNotificationToAll(
                '🔧 End of Day Reminder',
                `You have ${openCount} open ticket${openCount > 1 ? 's' : ''} — please update before leaving.`,
                '/tickets'
            );
        }
    } catch (err) {
        console.error('[CRON] Reminder failed:', err);
    }
});

module.exports = router;
module.exports.sendNotificationToAll = sendNotificationToAll;
