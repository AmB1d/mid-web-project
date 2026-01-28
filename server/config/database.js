const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');

class Database {
    constructor() {
        this.db = null;
        // Use absolute path to ensure we're in the right location
        this.dbPath = path.resolve(__dirname, '..', 'data', 'database.db');
    }

    async initialize() {
        try {
            // Ensure data directory exists with proper permissions
            const dataDir = path.dirname(this.dbPath);
            console.log(`Creating data directory: ${dataDir}`);
            
            // Try to create directory multiple times if needed
            let retries = 3;
            while (retries > 0) {
                try {
                    await fs.mkdir(dataDir, { recursive: true });
                    // Verify it was created
                    await fs.access(dataDir);
                    console.log(`Data directory created successfully: ${dataDir}`);
                    break;
                } catch (err) {
                    retries--;
                    if (retries === 0) {
                        console.error(`Failed to create data directory after retries: ${dataDir}`);
                        console.error('Error:', err);
                        throw err;
                    }
                    console.log(`Retrying directory creation (${retries} retries left)...`);
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
            
            // Also ensure playlists directory exists
            const playlistsDir = path.join(dataDir, 'playlists');
            console.log(`Creating playlists directory: ${playlistsDir}`);
            await fs.mkdir(playlistsDir, { recursive: true });
            await fs.access(playlistsDir);
            console.log(`Playlists directory created successfully: ${playlistsDir}`);
            
            // Verify directory was created and is writable
            try {
                await fs.access(dataDir, fsSync.constants.W_OK);
                console.log(`Data directory is writable: ${dataDir}`);
            } catch (err) {
                console.error(`Data directory is not writable: ${dataDir}`);
                throw new Error(`Data directory is not writable: ${dataDir}`);
            }

            // Create database connection with error handling
            console.log(`Opening database at: ${this.dbPath}`);
            return new Promise((resolve, reject) => {
                // Use absolute path and ensure directory exists
                // OPEN_READWRITE | OPEN_CREATE allows creating the file if it doesn't exist
                const flags = sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE;
                this.db = new sqlite3.Database(this.dbPath, flags, (err) => {
                    if (err) {
                        console.error('Error opening database:', err);
                        console.error('Error code:', err.code);
                        console.error('Error errno:', err.errno);
                        console.error('Database path:', this.dbPath);
                        console.error('Data directory:', dataDir);
                        console.error('Current working directory:', process.cwd());
                        console.error('__dirname:', __dirname);
                        reject(err);
                        return;
                    }
                    console.log('Connected to SQLite database:', this.dbPath);
                    
                    // Create tables
                    this.createTables()
                        .then(() => {
                            // Migrate existing users from JSON if needed
                            return this.migrateUsersFromJSON();
                        })
                        .then(() => {
                            // Migrate existing playlists from JSON if needed
                            return this.migratePlaylistsFromJSON();
                        })
                        .then(() => {
                            resolve(this.db);
                        })
                        .catch((error) => {
                            console.error('Error during database setup:', error);
                            reject(error);
                        });
                });
            });
        } catch (error) {
            console.error('Database initialization error:', error);
            console.error('Error stack:', error.stack);
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

    async migratePlaylistsFromJSON() {
        try {
            const playlistsDir = path.join(__dirname, '..', 'data', 'playlists');
            
            // Check if playlists directory exists
            try {
                await fs.access(playlistsDir);
            } catch {
                return; // No playlists directory, nothing to migrate
            }

            // Read all JSON files in playlists directory
            const files = await fs.readdir(playlistsDir);
            const jsonFiles = files.filter(f => f.endsWith('.json'));

            if (jsonFiles.length === 0) {
                return;
            }

            // Check if there are already playlists in the database
            const existingPlaylists = await this.query('SELECT COUNT(*) as count FROM playlists');
            if (existingPlaylists[0].count > 0) {
                // Database already has playlists, skip migration
                return;
            }

            console.log(`Migrating playlists from ${jsonFiles.length} JSON file(s)...`);

            for (const file of jsonFiles) {
                const username = file.replace('.json', '');
                const filePath = path.join(playlistsDir, file);

                try {
                    const data = await fs.readFile(filePath, 'utf8');
                    const playlistData = JSON.parse(data);

                    if (!playlistData.playlists || !Array.isArray(playlistData.playlists)) {
                        continue;
                    }

                    // Get user ID
                    const user = await this.get('SELECT id FROM users WHERE username = ?', [username]);
                    if (!user) {
                        console.log(`User ${username} not found, skipping playlist migration`);
                        continue;
                    }

                    // Migrate each playlist
                    for (const playlist of playlistData.playlists) {
                        // Create playlist
                        const result = await this.run(
                            'INSERT INTO playlists (user_id, name) VALUES (?, ?)',
                            [user.id, playlist.name]
                        );

                        const playlistId = result.lastID;

                        // Migrate songs
                        if (playlist.songs && Array.isArray(playlist.songs)) {
                            for (const song of playlist.songs) {
                                await this.run(`
                                    INSERT INTO songs (playlist_id, video_id, title, channel_title, thumbnail, duration, view_count, rating, file_url, type)
                                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                                `, [
                                    playlistId,
                                    song.videoId || null,
                                    song.title || 'Unknown Title',
                                    song.channelTitle || 'Unknown Artist',
                                    song.thumbnail || 'https://via.placeholder.com/320x180',
                                    song.duration || '0:00',
                                    song.viewCount || '0',
                                    song.rating || 0,
                                    song.fileUrl || null,
                                    song.type || 'youtube'
                                ]);
                            }
                        }

                        console.log(`Migrated playlist "${playlist.name}" for user ${username} with ${playlist.songs?.length || 0} songs`);
                    }
                } catch (err) {
                    console.error(`Error migrating playlist file ${file}:`, err);
                }
            }

            console.log('Playlist migration completed');
        } catch (error) {
            console.error('Error during playlist migration:', error);
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
