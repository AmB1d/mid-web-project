// Authentication middleware
function requireAuth(req, res, next) {
    if (req.session && req.session.user) {
        return next();
    }
    res.redirect('/login');
}

// Optional: Get current user if logged in (doesn't require auth)
async function getCurrentUser(req, res, next) {
    if (req.session && req.session.user) {
        const UserRepository = require('../repositories/UserRepository');
        const userRepo = new UserRepository();
        try {
            const user = await userRepo.findById(req.session.user.id);
            if (user) {
                req.currentUser = user;
            }
        } catch (error) {
            console.error('Error fetching current user:', error);
        }
    }
    next();
}

module.exports = {
    requireAuth,
    getCurrentUser
};
