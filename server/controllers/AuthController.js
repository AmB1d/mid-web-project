const authService = require('../services/authService');

class AuthController {
    constructor() {
        // Controller now uses Service layer
    }

    // Render register page
    async showRegister(req, res) {
        // If already logged in, redirect to search
        if (req.session.user) {
            return res.redirect('/search');
        }
        res.render('register', { 
            title: 'Register',
            error: null,
            user: null,
            formData: null
        });
    }

    // Handle user registration
    async register(req, res) {
        try {
            const { username, password, confirmPassword, firstName, imageUrl } = req.body;
            
            // Use Service layer for business logic
            const user = await authService.register({ username, password, confirmPassword, firstName, imageUrl });

            // Redirect to login with success message
            req.session.successMessage = 'Registration successful! Please login.';
            res.redirect('/login');
        } catch (error) {
            // Handle errors from Service layer
            res.render('register', {
                title: 'Register',
                error: error.message,
                user: null,
                formData: req.body
            });
        }
    }

    // Render login page
    async showLogin(req, res) {
        // If already logged in, redirect to search
        if (req.session.user) {
            return res.redirect('/search');
        }

        const successMessage = req.session.successMessage;
        const error = req.session.error;
        
        // Clear messages after displaying
        delete req.session.successMessage;
        delete req.session.error;

        res.render('login', {
            title: 'Login',
            error: error || null,
            successMessage: successMessage || null,
            user: null
        });
    }

    // Handle user login
    async login(req, res) {
        try {
            const { username, password } = req.body;

            // Use Service layer for business logic
            const user = await authService.login({ username, password });

            // Create session
            req.session.user = user.toPublicJSON();
            req.session.save((err) => {
                if (err) {
                    return res.render('login', {
                        title: 'Login',
                        error: 'Error creating session',
                        successMessage: null,
                        user: null
                    });
                }

                // Redirect to search page
                res.redirect('/search');
            });
        } catch (error) {
            // Handle errors from Service layer
            res.render('login', {
                title: 'Login',
                error: error.message,
                successMessage: null,
                user: null
            });
        }
    }

    // Handle logout
    async logout(req, res) {
        req.session.destroy((err) => {
            if (err) {
                console.error('Logout error:', err);
                return res.redirect('/');
            }
            res.redirect('/login');
        });
    }
}

module.exports = AuthController;
