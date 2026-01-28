const bcrypt = require('bcryptjs');
const UserRepository = require('../repositories/UserRepository');
const User = require('../models/User');

class AuthService {
    constructor() {
        this.userRepository = new UserRepository();
    }

    async register({ username, password, confirmPassword, firstName, imageUrl }) {
        // Validation
        if (!username || !password || !confirmPassword || !firstName) {
            throw new Error('All fields are required');
        }

        // Check password confirmation
        if (password !== confirmPassword) {
            throw new Error('Passwords do not match');
        }

        // Validate imageUrl if provided
        if (imageUrl && imageUrl.trim() !== '') {
            try {
                new URL(imageUrl);
            } catch (e) {
                throw new Error('Invalid image URL format');
            }
        }

        // Password validation
        const passwordValidation = User.validatePassword(password);
        if (!passwordValidation.isValid) {
            throw new Error(passwordValidation.errors[0]);
        }

        // Check if username already exists
        const usernameExists = await this.userRepository.usernameExists(username);
        if (usernameExists) {
            throw new Error(`Username "${username}" already exists. Please choose a different username.`);
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const userData = {
            username: username.trim(),
            password: hashedPassword,
            firstName: firstName.trim(),
            imageUrl: (imageUrl && imageUrl.trim() !== '') ? imageUrl.trim() : 'https://via.placeholder.com/150'
        };

        const user = await this.userRepository.create(userData);
        return user;
    }

    async login({ username, password }) {
        if (!username || !password) {
            throw new Error('Username and password are required');
        }

        // Find user by username
        const user = await this.userRepository.findByUsername(username);

        if (!user) {
            throw new Error('Invalid username or password');
        }

        // Verify password
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            throw new Error('Invalid username or password');
        }

        return user;
    }
}

module.exports = new AuthService();
