const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'it-tickets-secret-key-change-in-production';
const JWT_EXPIRES = '24h';

function generateToken(user) {
    return jwt.sign(
        { id: user.id, username: user.username, display_name: user.display_name, role: user.role, tech_id: user.tech_id || null },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES }
    );
}

function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}

function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
}

module.exports = { generateToken, requireAuth, requireAdmin, JWT_SECRET };
