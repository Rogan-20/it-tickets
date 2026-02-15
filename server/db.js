const path = require('path');
const fs = require('fs');

const DATABASE_URL = process.env.DATABASE_URL;
const IS_PG = !!DATABASE_URL;

let db;

// ── Helper: convert ? placeholders to $1,$2,... for PostgreSQL ──
function convertParams(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

// ── Helper: convert named @params to $N for PostgreSQL ──
function convertNamedParams(sql, namedObj) {
  const keys = [];
  const values = [];
  let i = 0;
  const converted = sql.replace(/@(\w+)/g, (_, name) => {
    keys.push(name);
    values.push(namedObj[name] !== undefined ? namedObj[name] : null);
    return `$${++i}`;
  });
  return { sql: converted, values };
}

if (IS_PG) {
  // ── PostgreSQL mode ──
  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  db = {
    _pool: pool,

    // Run a query and return all rows
    async all(sql, params = []) {
      if (typeof params === 'object' && !Array.isArray(params)) {
        const c = convertNamedParams(sql, params);
        const { rows } = await pool.query(c.sql, c.values);
        return rows;
      }
      const { rows } = await pool.query(convertParams(sql), params);
      return rows;
    },

    // Run a query and return first row
    async get(sql, params = []) {
      const rows = await db.all(sql, params);
      return rows[0] || null;
    },

    // Run an INSERT/UPDATE/DELETE and return { lastID, changes }
    async run(sql, params = []) {
      let finalSql = sql;
      let finalParams = params;

      if (typeof params === 'object' && !Array.isArray(params)) {
        const c = convertNamedParams(sql, params);
        finalSql = c.sql;
        finalParams = c.values;
      } else {
        finalSql = convertParams(sql);
      }

      // For INSERT, add RETURNING id to get the new ID
      if (/^\s*INSERT/i.test(finalSql) && !/RETURNING/i.test(finalSql)) {
        finalSql += ' RETURNING id';
      }

      const result = await pool.query(finalSql, finalParams);
      return {
        lastInsertRowid: result.rows?.[0]?.id,
        changes: result.rowCount
      };
    },

    // Transaction support
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const txDb = {
          async all(sql, params = []) {
            if (typeof params === 'object' && !Array.isArray(params)) {
              const c = convertNamedParams(sql, params);
              const { rows } = await client.query(c.sql, c.values);
              return rows;
            }
            const { rows } = await client.query(convertParams(sql), params);
            return rows;
          },
          async get(sql, params = []) {
            const rows = await txDb.all(sql, params);
            return rows[0] || null;
          },
          async run(sql, params = []) {
            let finalSql = sql;
            let finalParams = params;
            if (typeof params === 'object' && !Array.isArray(params)) {
              const c = convertNamedParams(sql, params);
              finalSql = c.sql;
              finalParams = c.values;
            } else {
              finalSql = convertParams(sql);
            }
            if (/^\s*INSERT/i.test(finalSql) && !/RETURNING/i.test(finalSql)) {
              finalSql += ' RETURNING id';
            }
            const result = await client.query(finalSql, finalParams);
            return { lastInsertRowid: result.rows?.[0]?.id, changes: result.rowCount };
          }
        };
        const result = await fn(txDb);
        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }
  };

  console.log('[DB] Using PostgreSQL');
} else {
  // ── SQLite mode (local development) ──
  let Database;
  try {
    Database = require('better-sqlite3');
  } catch (e) {
    console.error('[DB] better-sqlite3 not available. Set DATABASE_URL for PostgreSQL.');
    process.exit(1);
  }
  const dbPath = path.join(__dirname, '..', 'data', 'tickets.db');
  const dataDir = path.dirname(dbPath);
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  const sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  db = {
    _sqlite: sqlite,

    async all(sql, params = []) {
      if (typeof params === 'object' && !Array.isArray(params)) {
        return sqlite.prepare(sql).all(params);
      }
      return sqlite.prepare(sql).all(...params);
    },

    async get(sql, params = []) {
      if (typeof params === 'object' && !Array.isArray(params)) {
        return sqlite.prepare(sql).get(params) || null;
      }
      return sqlite.prepare(sql).get(...params) || null;
    },

    async run(sql, params = []) {
      let info;
      if (typeof params === 'object' && !Array.isArray(params)) {
        info = sqlite.prepare(sql).run(params);
      } else {
        info = sqlite.prepare(sql).run(...params);
      }
      return { lastInsertRowid: info.lastInsertRowid, changes: info.changes };
    },

    async transaction(fn) {
      const txFn = sqlite.transaction(async () => {
        return await fn(db);
      });
      return txFn();
    }
  };

  console.log('[DB] Using SQLite');
}

// ── Schema creation ──
async function initializeDatabase() {
  if (IS_PG) {
    // PostgreSQL schema — use pool.query directly (not db.run which adds RETURNING id)
    const pool = db._pool;

    await pool.query(`
      CREATE TABLE IF NOT EXISTS companies (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        contact_email TEXT,
        contact_phone TEXT,
        address TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS techs (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        type TEXT NOT NULL DEFAULT 'internal',
        status TEXT NOT NULL DEFAULT 'active',
        created_at TIMESTAMP DEFAULT NOW()
      )`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS tickets (
        id SERIAL PRIMARY KEY,
        ref_number TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        description TEXT,
        company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
        assigned_tech_id INTEGER REFERENCES techs(id) ON DELETE SET NULL,
        priority TEXT NOT NULL DEFAULT 'medium',
        status TEXT NOT NULL DEFAULT 'new',
        source TEXT DEFAULT 'walk_in',
        category TEXT DEFAULT 'other',
        contact_name TEXT,
        contact_email TEXT,
        contact_phone TEXT,
        recurring_parent_id INTEGER REFERENCES tickets(id) ON DELETE SET NULL,
        recurring_schedule TEXT,
        due_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS ticket_updates (
        id SERIAL PRIMARY KEY,
        ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
        update_text TEXT NOT NULL,
        updated_by TEXT,
        update_type TEXT DEFAULT 'note',
        created_at TIMESTAMP DEFAULT NOW()
      )`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS ticket_photos (
        id SERIAL PRIMARY KEY,
        ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
        filename TEXT NOT NULL,
        original_name TEXT,
        filepath TEXT NOT NULL,
        uploaded_at TIMESTAMP DEFAULT NOW()
      )`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id SERIAL PRIMARY KEY,
        endpoint TEXT NOT NULL UNIQUE,
        keys_p256dh TEXT NOT NULL,
        keys_auth TEXT NOT NULL,
        user_name TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS email_pending (
        id SERIAL PRIMARY KEY,
        message_id TEXT,
        from_address TEXT,
        from_name TEXT,
        subject TEXT,
        body TEXT,
        received_at TIMESTAMP,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW()
      )`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMP DEFAULT NOW()
      )`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_messages (
        id SERIAL PRIMARY KEY,
        sender_name TEXT,
        sender_phone TEXT,
        group_name TEXT,
        message_text TEXT,
        status TEXT DEFAULT 'pending',
        received_at TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW()
      )`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'receptionist',
        active INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )`);

    // Indexes
    await pool.query('CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_tickets_company ON tickets(company_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_tickets_tech ON tickets(assigned_tech_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_ticket_updates_ticket ON ticket_updates(ticket_id)');
  } else {
    // SQLite schema (unchanged from original)
    db._sqlite.exec(`
      CREATE TABLE IF NOT EXISTS companies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        contact_email TEXT,
        contact_phone TEXT,
        address TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS techs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        type TEXT NOT NULL DEFAULT 'internal' CHECK(type IN ('internal','external','remote')),
        status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ref_number TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        description TEXT,
        company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
        assigned_tech_id INTEGER REFERENCES techs(id) ON DELETE SET NULL,
        priority TEXT NOT NULL DEFAULT 'medium',
        status TEXT NOT NULL DEFAULT 'new',
        source TEXT DEFAULT 'walk_in',
        category TEXT DEFAULT 'other',
        contact_name TEXT,
        contact_email TEXT,
        contact_phone TEXT,
        recurring_parent_id INTEGER REFERENCES tickets(id) ON DELETE SET NULL,
        recurring_schedule TEXT,
        due_date DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS ticket_updates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
        update_text TEXT NOT NULL,
        updated_by TEXT,
        update_type TEXT DEFAULT 'note',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS ticket_photos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
        filename TEXT NOT NULL,
        original_name TEXT,
        filepath TEXT NOT NULL,
        uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        endpoint TEXT NOT NULL UNIQUE,
        keys_p256dh TEXT NOT NULL,
        keys_auth TEXT NOT NULL,
        user_name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS email_pending (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message_id TEXT,
        from_address TEXT,
        from_name TEXT,
        subject TEXT,
        body TEXT,
        received_at DATETIME,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS whatsapp_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender_name TEXT,
        sender_phone TEXT,
        group_name TEXT,
        message_text TEXT,
        status TEXT DEFAULT 'pending',
        received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'receptionist',
        active INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
      CREATE INDEX IF NOT EXISTS idx_tickets_company ON tickets(company_id);
      CREATE INDEX IF NOT EXISTS idx_tickets_tech ON tickets(assigned_tech_id);
      CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority);
      CREATE INDEX IF NOT EXISTS idx_ticket_updates_ticket ON ticket_updates(ticket_id);
    `);
  }

  // Create default admin if needed
  const bcrypt = require('bcryptjs');
  const userCount = await db.get('SELECT COUNT(*) as c FROM users');
  if (!userCount || userCount.c === 0) {
    const hash = bcrypt.hashSync('admin123', 10);
    await db.run('INSERT INTO users (username, display_name, password_hash, role) VALUES (?, ?, ?, ?)',
      ['admin', 'Administrator', hash, 'admin']);
    console.log('[AUTH] Default admin user created (admin / admin123)');
  }
}

// Helper to generate ticket reference numbers
async function getNextRefNumber() {
  const row = await db.get('SELECT MAX(id) as max_id FROM tickets');
  const nextId = ((row && row.max_id) || 0) + 1;
  return `TKT-${String(nextId).padStart(5, '0')}`;
}

module.exports = { db, getNextRefNumber, initializeDatabase };
