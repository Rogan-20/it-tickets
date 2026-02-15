const Imap = require('imap');
const { simpleParser } = require('mailparser');
const { db } = require('../db');

let imapConnection = null;
let pollInterval = null;
let isPolling = false;

async function getEmailSettings() {
    const rows = await db.all("SELECT key, value FROM settings WHERE key LIKE 'email_%'");
    const settings = {};
    rows.forEach(r => { settings[r.key] = r.value; });
    return settings;
}

async function isConfigured() {
    const s = await getEmailSettings();
    return !!(s.email_host && s.email_user && s.email_password);
}

async function saveEmail(parsed, uid) {
    const fromAddr = parsed.from?.value?.[0]?.address || '';
    const fromName = parsed.from?.value?.[0]?.name || fromAddr.split('@')[0] || 'Unknown';
    const messageId = parsed.messageId || `uid-${uid}`;
    const subject = parsed.subject || '(no subject)';
    const body = parsed.text || parsed.html?.replace(/<[^>]*>/g, ' ').substring(0, 5000) || '';

    const existing = await db.get('SELECT id FROM email_pending WHERE message_id = ?', [messageId]);
    if (existing) return null;

    const result = await db.run(`
    INSERT INTO email_pending (message_id, from_address, from_name, subject, body, received_at, status)
    VALUES (?, ?, ?, ?, ?, ?, 'pending')
  `, [messageId, fromAddr, fromName, subject, body.trim(), parsed.date ? parsed.date.toISOString() : new Date().toISOString()]);

    return result.lastInsertRowid;
}

async function fetchNewEmails() {
    if (isPolling) return { fetched: 0, message: 'Already polling' };
    const configured = await isConfigured();
    if (!configured) return { fetched: 0, message: 'Email not configured' };

    isPolling = true;
    const settings = await getEmailSettings();

    return new Promise((resolve) => {
        const imap = new Imap({
            user: settings.email_user,
            password: settings.email_password,
            host: settings.email_host,
            port: parseInt(settings.email_port || '993'),
            tls: settings.email_tls !== 'false',
            tlsOptions: { rejectUnauthorized: false },
            connTimeout: 15000,
            authTimeout: 15000
        });

        let fetchCount = 0;

        imap.once('ready', () => {
            const folder = settings.email_folder || 'INBOX';
            imap.openBox(folder, false, (err, box) => {
                if (err) {
                    console.error('[EMAIL] Failed to open folder:', err.message);
                    imap.end();
                    isPolling = false;
                    resolve({ fetched: 0, error: err.message });
                    return;
                }

                imap.search(['UNSEEN'], (err, uids) => {
                    if (err || !uids?.length) {
                        imap.end();
                        isPolling = false;
                        resolve({ fetched: 0, message: uids?.length === 0 ? 'No new emails' : err?.message });
                        return;
                    }

                    const toFetch = uids.slice(-50);
                    const f = imap.fetch(toFetch, { bodies: '', markSeen: settings.email_mark_read !== 'false' });

                    f.on('message', (msg, seqno) => {
                        let uid = null;
                        msg.on('attributes', (attrs) => { uid = attrs.uid; });
                        msg.on('body', (stream) => {
                            let buffer = '';
                            stream.on('data', chunk => { buffer += chunk.toString('utf8'); });
                            stream.on('end', async () => {
                                try {
                                    const parsed = await simpleParser(buffer);
                                    const saved = await saveEmail(parsed, uid);
                                    if (saved) fetchCount++;
                                } catch (e) {
                                    console.error('[EMAIL] Parse error:', e.message);
                                }
                            });
                        });
                    });

                    f.once('end', () => {
                        setTimeout(() => {
                            imap.end();
                            isPolling = false;
                            console.log(`[EMAIL] Fetched ${fetchCount} new emails`);
                            resolve({ fetched: fetchCount, message: `${fetchCount} new email(s) imported` });
                        }, 1000);
                    });
                });
            });
        });

        imap.once('error', (err) => {
            console.error('[EMAIL] IMAP error:', err.message);
            isPolling = false;
            resolve({ fetched: 0, error: err.message });
        });

        imap.once('end', () => {
            isPolling = false;
        });

        imap.connect();
    });
}

function startAutoPolling(intervalMinutes = 2) {
    stopAutoPolling();
    const ms = intervalMinutes * 60 * 1000;
    console.log(`[EMAIL] Auto-polling every ${intervalMinutes} min`);

    setTimeout(() => fetchNewEmails().catch(e => console.error('[EMAIL] Poll error:', e)), 10000);

    pollInterval = setInterval(() => {
        fetchNewEmails().catch(e => console.error('[EMAIL] Poll error:', e));
    }, ms);
}

function stopAutoPolling() {
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
        console.log('[EMAIL] Auto-polling stopped');
    }
}

async function getStatus() {
    const configured = await isConfigured();
    const settings = await getEmailSettings();
    return {
        configured,
        polling: !!pollInterval,
        isPolling,
        host: settings.email_host || null,
        user: settings.email_user || null,
        folder: settings.email_folder || 'INBOX',
        interval: settings.email_poll_interval || '2'
    };
}

// Auto-start is deferred to after DB init (called from server.js)
async function tryAutoStart() {
    const configured = await isConfigured();
    if (configured) {
        const settings = await getEmailSettings();
        const interval = parseInt(settings.email_poll_interval || '2');
        startAutoPolling(interval);
    }
}

module.exports = { fetchNewEmails, startAutoPolling, stopAutoPolling, getStatus, isConfigured, tryAutoStart };
