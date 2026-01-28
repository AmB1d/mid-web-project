const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const path = require('path');
const fs = require('fs').promises;

// Ensure data directory exists before creating session store
const dataDir = path.resolve(__dirname, '..', 'data');

// Create directory synchronously to ensure it exists before session store is created
try {
    const fsSync = require('fs');
    if (!fsSync.existsSync(dataDir)) {
        fsSync.mkdirSync(dataDir, { recursive: true, mode: 0o755 });
        console.log('Session data directory created:', dataDir);
    } else {
        console.log('Session data directory already exists:', dataDir);
    }
} catch (error) {
    console.error('Error creating session data directory:', error);
    // Don't throw - let it try anyway
}

// Also ensure it exists asynchronously as backup
(async () => {
    try {
        await fs.mkdir(dataDir, { recursive: true });
        console.log('Session data directory ensured (async):', dataDir);
    } catch (error) {
        console.error('Error creating session data directory (async):', error);
    }
})();

module.exports = session({
    store: new SQLiteStore({
        db: 'sessions.sqlite',
        dir: dataDir,
    }),
    secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: false, // Set to false for now - Render handles HTTPS at the proxy level
        sameSite: 'lax', // Helps with cross-site requests
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    },
    name: 'sessionId' // Custom session name
});
