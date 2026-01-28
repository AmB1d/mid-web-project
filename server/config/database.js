const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs').promises;

class Database {
    constructor() {
        this.db = null;
        this.dbPath = path.join(__dirname, '..', 'data', 'database.db');
    }

    async initialize() {
        try {
            // Ensure data directory exists
            const dataDir = path.dirname(this.dbPath);
            await fs.mkdir(dataDir, { recursive: true });

            // Create database connection
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    console.error('Error opening database:', err);
                    throw err;
                }
                console.log('Connected to SQLite database');
            });

            // Create tables
            await this.createTables();
            
            // Migrate existing users from JSON if needed
            await this.migrateUsersFromJSON();

            return this.db;
        } catch (error) {
            console.error('Database initialization error:', error);
            throw error;
        }
    }

    async createTables() {
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                // Users table
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS users (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        username TEXT UNIQUE NOT NULL,
                        password TEXT NOT NULL,
                        first_name TEXT NOT NULL,
                        image_url TEXT DEFAULT 'https://via.placeholder.com/150',
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `, (err) => {
                    if (err) {
                        console.error('Error creating users table:', err);
                        reject(err);
                        return;
                    }
                });

                // Sessions table (for express-session store)
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS sessions (
                        session_id TEXT PRIMARY KEY,
                        user_id INTEGER,
                        expires INTEGER NOT NULL,
                        data TEXT,
                        FOREIGN KEY (user_id) REFERENCES users(id)
                    )
                `, (err) => {
                    if (err) {
                        console.error('Error creating sessions table:', err);
                        reject(err);
                        return;
                    }
                });

                // Playlists table
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS playlists (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER NOT NULL,
                        name TEXT NOT NULL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                    )
                `, (err) => {
                    if (err) {
                        console.error('Error creating playlists table:', err);
                        reject(err);
                        return;
                    }
                });

                // Songs table
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS songs (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        playlist_id INTEGER NOT NULL,
                        video_id TEXT,
                        title TEXT NOT NULL,
                        channel_title TEXT,
                        thumbnail TEXT,
                        duration TEXT,
                        view_count TEXT,
                        rating INTEGER DEFAULT 0,
                        file_url TEXT,
                        type TEXT DEFAULT 'youtube',
                        added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE
                    )
                `, (err) => {
                    if (err) {
                        console.error('Error creating songs table:', err);
                        reject(err);
                        return;
                    }
                    console.log('All database tables created successfully');
                    resolve();
                });
            });
        });
    }

    async migrateUsersFromJSON() {
        try {
            const usersJsonPath = path.join(__dirname, '..', 'data', 'users.json');
            const usersJsonExists = await fs.access(usersJsonPath).then(() => true).catch(() => false);
            
            if (!usersJsonExists) {
                return;
            }

            const usersData = await fs.readFile(usersJsonPath, 'utf8');
            const users = JSON.parse(usersData);

            if (!Array.isArray(users) || users.length === 0) {
                return;
            }

            // Check if migration was already done (if database has users, skip migration)
            const existingUsers = await this.query('SELECT COUNT(*) as count FROM users');
            if (existingUsers[0].count > 0) {
                // Database already has users, only migrate new users that don't exist
                let newUsersCount = 0;
                
                for (const user of users) {
                    try {
                        // Check if user exists
                        const existing = await this.get('SELECT id FROM users WHERE username = ?', [user.username]);
                        
                        if (!existing) {
                            // Only insert new users that don't exist
                            await this.run(
                                'INSERT INTO users (username, password, first_name, image_url) VALUES (?, ?, ?, ?)',
                                [
                                    user.username,
                                    user.password, // Already hashed
                                    user.firstName || user.first_name,
                                    user.imageUrl || user.image_url || 'https://via.placeholder.com/150'
                                ]
                            );
                            console.log(`Migrated new user: ${user.username}`);
                            newUsersCount++;
                        }
                    } catch (err) {
                        if (err.message.includes('UNIQUE constraint')) {
                            // User already exists, skip
                        } else {
                            console.error(`Error migrating user ${user.username}:`, err);
                        }
                    }
                }
                
                if (newUsersCount === 0) {
                    // All users already migrated, no need to log anything
                } else {
                    console.log(`Migration completed: ${newUsersCount} new user(s) added`);
                }
                return;
            }

            // First time migration - migrate all users
            console.log(`Migrating ${users.length} users from JSON to database (first time)...`);
            
            for (const user of users) {
                try {
                    await this.run(
                        'INSERT INTO users (username, password, first_name, image_url) VALUES (?, ?, ?, ?)',
                        [
                            user.username,
                            user.password, // Already hashed
                            user.firstName || user.first_name,
                            user.imageUrl || user.image_url || 'https://via.placeholder.com/150'
                        ]
                    );
                    console.log(`Migrated user: ${user.username}`);
                } catch (err) {
                    if (err.message.includes('UNIQUE constraint')) {
                        console.log(`User ${user.username} already exists, skipping`);
                    } else {
                        console.error(`Error migrating user ${user.username}:`, err);
                    }
                }
            }

            console.log('User migration completed');
        } catch (error) {
            console.error('Error during user migration:', error);
            // Don't throw - migration is optional
        }
    }

    query(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    get(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ lastID: this.lastID, changes: this.changes });
                }
            });
        });
    }

    close() {
        return new Promise((resolve, reject) => {
            if (this.db) {
                this.db.close((err) => {
                    if (err) {
                        reject(err);
                    } else {
                        console.log('Database connection closed');
                        resolve();
                    }
                });
            } else {
                resolve();
            }
        });
    }
}

// Singleton instance
let dbInstance = null;

async function getDatabase() {
    if (!dbInstance) {
        dbInstance = new Database();
        await dbInstance.initialize();
    }
    return dbInstance;
}

module.exports = { Database, getDatabase };
