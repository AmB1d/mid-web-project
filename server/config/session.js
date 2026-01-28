const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const path = require('path');

module.exports = session({
    store: new SQLiteStore({
        db: 'sessions.sqlite',
        dir: path.join(__dirname, '..', 'data'),
    }),
    secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: false, // Set to true in production with HTTPS
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
});
