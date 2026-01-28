// Authentication utilities for session-based auth

// Logout user (redirects to server logout route)
async function logout() {
    window.location.href = '/logout';
}

// Add logout button handlers
document.addEventListener('DOMContentLoaded', function() {
    const logoutBtns = document.querySelectorAll('#logoutBtn, a[href="/logout"]');
    logoutBtns.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            logout();
        });
    });
});
