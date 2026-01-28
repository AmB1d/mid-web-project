class User {
    constructor(data) {
        this.id = data.id || null;
        this.username = data.username || '';
        this.password = data.password || '';
        this.firstName = data.firstName || data.first_name || '';
        this.imageUrl = data.imageUrl || data.image_url || 'https://via.placeholder.com/150';
        this.createdAt = data.createdAt || data.created_at || null;
        this.updatedAt = data.updatedAt || data.updated_at || null;
    }

    // Get user data without password
    toPublicJSON() {
        return {
            id: this.id,
            username: this.username,
            firstName: this.firstName,
            imageUrl: this.imageUrl,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }

    // Get all user data (including password - use carefully)
    toJSON() {
        return {
            id: this.id,
            username: this.username,
            password: this.password,
            firstName: this.firstName,
            imageUrl: this.imageUrl,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }

    // Validate user data
    validate() {
        const errors = [];

        if (!this.username || this.username.trim() === '') {
            errors.push('Username is required');
        } else if (this.username.length < 3) {
            errors.push('Username must be at least 3 characters');
        }

        if (!this.firstName || this.firstName.trim() === '') {
            errors.push('First name is required');
        }

        if (this.imageUrl && this.imageUrl.trim() !== '') {
            try {
                new URL(this.imageUrl);
            } catch (e) {
                errors.push('Invalid image URL format');
            }
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    // Validate password
    static validatePassword(password) {
        const errors = [];

        if (!password || password.length < 6) {
            errors.push('Password must be at least 6 characters');
        }

        if (password && !/[a-zA-Zא-ת]/.test(password)) {
            errors.push('Password must contain at least one letter');
        }

        if (password && !/[0-9]/.test(password)) {
            errors.push('Password must contain at least one number');
        }

        if (password && !/[^a-zA-Z0-9א-ת]/.test(password)) {
            errors.push('Password must contain at least one non-alphanumeric character');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }
}

module.exports = User;
