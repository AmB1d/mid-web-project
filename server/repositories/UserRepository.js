const User = require('../models/User');
const { getDatabase } = require('../config/database');

class UserRepository {
    constructor() {
        this.db = null;
    }

    async getDb() {
        if (!this.db) {
            this.db = await getDatabase();
        }
        return this.db;
    }

    // Create a new user
    async create(userData) {
        const db = await this.getDb();
        const result = await db.run(
            'INSERT INTO users (username, password, first_name, image_url) VALUES (?, ?, ?, ?)',
            [
                userData.username,
                userData.password,
                userData.firstName,
                userData.imageUrl || 'https://via.placeholder.com/150'
            ]
        );

        return await this.findById(result.lastID);
    }

    // Find user by ID
    async findById(id) {
        const db = await this.getDb();
        const row = await db.get('SELECT * FROM users WHERE id = ?', [id]);
        
        if (!row) {
            return null;
        }

        return new User({
            id: row.id,
            username: row.username,
            password: row.password,
            firstName: row.first_name,
            imageUrl: row.image_url,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        });
    }

    // Find user by username
    async findByUsername(username) {
        const db = await this.getDb();
        const row = await db.get('SELECT * FROM users WHERE username = ?', [username]);
        
        if (!row) {
            return null;
        }

        return new User({
            id: row.id,
            username: row.username,
            password: row.password,
            firstName: row.first_name,
            imageUrl: row.image_url,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        });
    }

    // Check if username exists
    async usernameExists(username) {
        const db = await this.getDb();
        const row = await db.get('SELECT COUNT(*) as count FROM users WHERE username = ?', [username]);
        return row.count > 0;
    }

    // Update user
    async update(id, userData) {
        const db = await this.getDb();
        const updates = [];
        const values = [];

        if (userData.firstName !== undefined) {
            updates.push('first_name = ?');
            values.push(userData.firstName);
        }

        if (userData.imageUrl !== undefined) {
            updates.push('image_url = ?');
            values.push(userData.imageUrl);
        }

        if (userData.password !== undefined) {
            updates.push('password = ?');
            values.push(userData.password);
        }

        if (updates.length === 0) {
            return await this.findById(id);
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');
        values.push(id);

        await db.run(
            `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
            values
        );

        return await this.findById(id);
    }

    // Delete user
    async delete(id) {
        const db = await this.getDb();
        await db.run('DELETE FROM users WHERE id = ?', [id]);
        return true;
    }

    // Get all users (for admin purposes)
    async findAll() {
        const db = await this.getDb();
        const rows = await db.query('SELECT * FROM users ORDER BY created_at DESC');
        
        return rows.map(row => new User({
            id: row.id,
            username: row.username,
            password: row.password,
            firstName: row.first_name,
            imageUrl: row.image_url,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        }));
    }
}

module.exports = UserRepository;
