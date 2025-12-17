// Authentication and user management utilities with API

// Check if user is logged in
function isLoggedIn() {
    const token = localStorage.getItem('authToken');
    const currentUser = sessionStorage.getItem('currentUser');
    return token !== null && currentUser !== null;
}

// Get current user
function getCurrentUser() {
    const currentUser = sessionStorage.getItem('currentUser');
    return currentUser ? JSON.parse(currentUser) : null;
}

// Logout user
async function logout() {
    try {
        await api.logout();
    } catch (error) {
        console.error('Logout error:', error);
    } finally {
        removeAuthToken();
        sessionStorage.removeItem('currentUser');
        window.location.href = 'login.html';
    }
}

// Display user header if logged in
function displayUserHeader() {
    const userHeader = document.getElementById('userHeader');
    if (!userHeader) return;
    
    const currentUser = getCurrentUser();
    if (currentUser) {
        const imageUrl = currentUser.imageUrl || 'https://via.placeholder.com/40';
        userHeader.innerHTML = `
            <div class="bg-light border-bottom py-2">
                <div class="container d-flex justify-content-between align-items-center">
                    <div class="d-flex align-items-center gap-2">
                        <img src="${imageUrl}" alt="${currentUser.firstName}" 
                             class="rounded-circle" style="width: 40px; height: 40px; object-fit: cover; border: 2px solid var(--accent-primary);" 
                             onerror="this.src='https://via.placeholder.com/40'">
                        <span class="fw-bold">Hello, ${currentUser.firstName} (${currentUser.username})</span>
                    </div>
                </div>
            </div>
        `;
    } else {
        userHeader.innerHTML = '';
    }
}

// Protect pages that require login
function requireLogin() {
    if (!isLoggedIn()) {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

// Verify token with server
async function verifyToken() {
    try {
        const user = await api.getCurrentUser();
        // Update session storage with fresh user data
        sessionStorage.setItem('currentUser', JSON.stringify(user));
        return true;
    } catch (error) {
        // Token invalid, logout
        removeAuthToken();
        sessionStorage.removeItem('currentUser');
        if (window.location.pathname !== '/login.html' && window.location.pathname !== '/register.html') {
            window.location.href = 'login.html';
        }
        return false;
    }
}

// Initialize auth on page load
document.addEventListener('DOMContentLoaded', async function() {
    // Verify token if logged in
    if (isLoggedIn()) {
        await verifyToken();
    }
    
    displayUserHeader();
    
    // Add logout button handlers
    const logoutBtns = document.querySelectorAll('#logoutBtn');
    logoutBtns.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            logout();
        });
    });
});
