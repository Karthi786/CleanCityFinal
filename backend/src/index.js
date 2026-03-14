const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5001;

/*
========================================
CORS CONFIGURATION
Allow requests from Netlify frontend
========================================
*/
app.use(cors({
    origin: [
        "https://cleancitymdu.netlify.app",
        "http://localhost:3001",
        "http://127.0.0.1:5500",
        "http://localhost:5500"
    ],
    credentials: true
}));

/*
========================================
LOG REQUESTS
========================================
*/
app.use((req, res, next) => {
    console.log(`[API REQUEST] ${req.method} ${req.originalUrl}`);
    next();
});

/*
========================================
BODY PARSERS
========================================
*/
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

/*
========================================
SERVE FRONTEND (ONLY FOR LOCAL TESTING)
========================================
*/
const FRONTEND_DIR = path.join(__dirname, '..', '..', 'frontend');
app.use(express.static(FRONTEND_DIR));

/*
========================================
API ROUTES
========================================
*/
app.use('/api/auth', require('./routes/auth'));
app.use('/api/issues', require('./routes/issues'));
app.use('/api/users', require('./routes/users'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/campaigns', require('./routes/campaigns'));
app.use('/api/leaderboard', require('./routes/leaderboard'));

/*
========================================
HEALTH CHECK (Render monitoring)
========================================
*/
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'CleanMadurai API',
        timestamp: new Date().toISOString()
    });
});

/*
========================================
HANDLE UNKNOWN ROUTES
========================================
*/
app.use((req, res) => {

    if (req.path.startsWith('/api')) {
        return res.status(404).json({
            error: 'API route not found.'
        });
    }

    res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});

/*
========================================
GLOBAL ERROR HANDLER
========================================
*/
app.use((err, req, res, next) => {

    console.error('Unhandled error:', err);

    res.status(500).json({
        error: 'Internal server error.'
    });
});

/*
========================================
START SERVER
========================================
*/
app.listen(PORT, () => {

    console.log(`
╔══════════════════════════════════════════════╗
║        CleanMadurai API Server               ║
║  Local  → http://localhost:${PORT}           ║
║  API    → http://localhost:${PORT}/api       ║
║  Health → /health                            ║
╚══════════════════════════════════════════════╝
`);

});

module.exports = app;
