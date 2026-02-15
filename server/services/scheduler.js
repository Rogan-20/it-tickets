const cron = require('node-cron');
const { db, getNextRefNumber } = require('../db');

function startScheduler() {
    // Check for recurring tickets every day at 8AM
    cron.schedule('0 8 * * *', async () => {
        console.log('[SCHEDULER] Checking for recurring tickets...');
        try {
            const recurringTickets = await db.all(`
        SELECT * FROM tickets 
        WHERE recurring_schedule IS NOT NULL 
        AND recurring_schedule != ''
        AND status NOT IN ('closed')
      `);

            const now = new Date();

            for (const ticket of recurringTickets) {
                let shouldCreate = false;
                const lastCreated = await db.get(`
          SELECT MAX(created_at) as last_date FROM tickets 
          WHERE recurring_parent_id = ?
        `, [ticket.id]);

                const lastDate = lastCreated?.last_date ? new Date(lastCreated.last_date) : new Date(ticket.created_at);
                const daysSince = Math.floor((now - lastDate) / (1000 * 60 * 60 * 24));

                switch (ticket.recurring_schedule) {
                    case 'daily':
                        shouldCreate = daysSince >= 1;
                        break;
                    case 'weekly':
                        shouldCreate = daysSince >= 7;
                        break;
                    case 'monthly':
                        shouldCreate = daysSince >= 30;
                        break;
                    case 'quarterly':
                        shouldCreate = daysSince >= 90;
                        break;
                }

                if (shouldCreate) {
                    const refNumber = await getNextRefNumber();
                    await db.run(`
            INSERT INTO tickets (ref_number, title, description, company_id, assigned_tech_id, priority, source, category,
              contact_name, contact_email, contact_phone, recurring_parent_id)
            VALUES (?, ?, ?, ?, ?, ?, 'recurring', ?, ?, ?, ?, ?)
          `, [
                        refNumber,
                        `[Recurring] ${ticket.title}`,
                        ticket.description,
                        ticket.company_id,
                        ticket.assigned_tech_id,
                        ticket.priority,
                        ticket.category,
                        ticket.contact_name,
                        ticket.contact_email,
                        ticket.contact_phone,
                        ticket.id
                    ]);
                    console.log(`[SCHEDULER] Created recurring ticket: ${refNumber} from parent ${ticket.ref_number}`);
                }
            }
        } catch (err) {
            console.error('[SCHEDULER] Error:', err);
        }
    });

    console.log('[SCHEDULER] Recurring ticket scheduler started (daily at 8AM)');
}

module.exports = { startScheduler };
